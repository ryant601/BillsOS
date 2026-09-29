(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BillsOSNegativeBalanceRecommendations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function cents(value) { return Math.round(Number(value || 0) * 100); }
  function dateOf(row) { return String(row.iso || row.date || ''); }
  function excluded(row) {
    const name = String(row.name || '');
    const text = name + ' ' + String(row.type || '') + ' ' + String(row.cls || '');
    return /transfer|funding|sweep|correction|adjustment|reconciliation|balance-opening/i.test(text) ||
      (!/mortgage|jeep/i.test(name) && /upstart|chase/i.test(name));
  }
  function cutoff(row) {
    const name = String(row.name || '').toLowerCase();
    if (name.includes('mortgage')) return 17;
    if (name.includes('jeep')) return 25;
    return 31;
  }
  function withinDeadline(row, date) {
    return Number(date.slice(8, 10)) <= cutoff(row) && date.slice(0, 7) === dateOf(row).slice(0, 7);
  }
  function metrics(days, offsets) {
    const balances = days.map(function (day) { return cents(day.ending) + (offsets[day.date] || 0); });
    return { negativeDays: balances.filter(function (value) { return value < 0; }).length,
      lowest: Math.min.apply(null, balances) / 100 };
  }
  function recommend(rows, summary, today) {
    if (!summary || !Array.isArray(summary.days) || !summary.days.length) return [];
    const days = summary.days.filter(function (day) { return day.date >= today; });
    if (!days.length) return [];
    const base = metrics(days, {});
    if (!base.negativeDays) return [];
    const byDate = {};
    days.forEach(function (day) { byDate[day.date] = day; });
    const candidates = [];
    (rows || []).forEach(function (row) {
      const from = dateOf(row), amount = -cents(row.amount);
      if (!byDate[from] || amount <= 0 || excluded(row)) return;
      const fromIndex = days.findIndex(function (day) { return day.date === from; });
      const later = days.slice(fromIndex + 1, fromIndex + 15);
      // Prefer a date with planned income. A date in the calendar is a scenario,
      // never a claim that the biller permits its actual due date to move.
      const incomeDates = later.filter(function (day) {
        return day.items.some(function (item) { return cents(item.amount) > 0; });
      });
      incomeDates.filter(function (day) { return withinDeadline(row, day.date); }).forEach(function (destination) {
        [amount, Math.floor(amount / 2)].forEach(function (moved, index) {
          if (moved <= 0 || (index && moved === amount)) return;
          const offsets = {};
          days.forEach(function (day) {
            if (day.date >= from && day.date < destination.date) offsets[day.date] = moved;
          });
          const after = metrics(days, offsets);
          const rescued = base.negativeDays - after.negativeDays;
          if (rescued <= 0) return;
          candidates.push({ kind: index ? 'split' : 'move', name: String(row.name || 'Payment'),
            from: from, to: destination.date, amount: moved / 100,
            originalAmount: amount / 100, negativeDaysBefore: base.negativeDays,
            negativeDaysAfter: after.negativeDays, lowestBefore: base.lowest,
            lowestAfter: after.lowest, daysResolved: rescued });
        });
      });
    });
    candidates.sort(function (a, b) {
      return b.daysResolved - a.daysResolved || b.lowestAfter - a.lowestAfter ||
        a.amount - b.amount || a.to.localeCompare(b.to);
    });
    const seen = new Set();
    return candidates.filter(function (item) {
      const key = item.name + '|' + item.from + '|' + item.kind;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }

  function recommendAhead(rows, allDays, today, horizonDays) {
    const first = String(today || ''), days = (allDays || []).filter(function (day) { return day.date >= first; })
      .slice(0, Number(horizonDays || 120));
    if (!days.length) return [];
    const base = metrics(days, {});
    if (!base.negativeDays) return [];
    const positions = {};
    days.forEach(function (day, index) { positions[day.date] = index; });
    const incomeDays = days.filter(function (day) {
      return (day.items || []).some(function (item) { return cents(item.amount) > 0; });
    });
    const results = [];
    (rows || []).forEach(function (row) {
      const name = String(row.name || ''), kind = /mortgage/i.test(name) ? 'mortgage' : /jeep/i.test(name) ? 'jeep' : '';
      const from = dateOf(row), total = -cents(row.amount);
      if (!kind || excluded(row) || !Object.prototype.hasOwnProperty.call(positions, from) || total < 200) return;
      incomeDays.forEach(function (payday) {
        const second = payday.date;
        const gap = positions[second] - positions[from];
        if (gap <= 0 || gap > 14 || !withinDeadline(row, second)) return;
        const firstPart = Math.floor(total / 2), secondPart = total - firstPart;
        const afterBalances = days.map(function (day) {
          let offset = day.date >= from ? total : 0;
          if (day.date >= from) offset -= firstPart;
          if (day.date >= second) offset -= secondPart;
          return cents(day.ending) + offset;
        });
        const negativeDaysAfter = afterBalances.filter(function (balance) { return balance < 0; }).length;
        const newNegative = days.some(function (day, index) {
          return cents(day.ending) >= 0 && afterBalances[index] < 0;
        });
        const resolved = base.negativeDays - negativeDaysAfter;
        if (resolved <= 0 || newNegative) return;
        results.push({ kind: kind, name: name, from: from, firstDate: from, secondDate: second,
          firstAmount: firstPart / 100, secondAmount: secondPart / 100, originalAmount: total / 100,
          daysResolved: resolved, negativeDaysBefore: base.negativeDays,
          negativeDaysAfter: negativeDaysAfter, lowestBefore: base.lowest,
          lowestAfter: Math.min.apply(null, afterBalances) / 100 });
      });
    });
    results.sort(function (a, b) {
      return b.daysResolved - a.daysResolved || a.negativeDaysAfter - b.negativeDaysAfter ||
        a.from.localeCompare(b.from) || a.secondDate.localeCompare(b.secondDate);
    });
    const seen = new Set();
    return results.filter(function (item) {
      const key = item.kind + '|' + item.from;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }

  return { recommend: recommend, recommendAhead: recommendAhead };
});
