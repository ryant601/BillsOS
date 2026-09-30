(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BillsOSNegativeBalanceRecommendations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LOW_BALANCE_CENTS = 30000;

  function cents(value) { return Math.round(Number(value || 0) * 100); }
  function targetCents(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : LOW_BALANCE_CENTS;
  }
  function dateOf(row) { return String(row.iso || row.date || ''); }
  function excluded(row) {
    const name = String(row.name || '');
    const text = name + ' ' + String(row.category || '') + ' ' + String(row.cls || '');
    const fundsSpendingAccount = /\bfund(?:ing)?(?:\s+the)?\s+(?:everyday\s+)?spending(?:\s+account)?\b/i.test(text);
    return fundsSpendingAccount || /transfer|funding|sweep|correction|reconciliation|balance-opening/i.test(text) ||
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
  function metrics(days, offsets, lowBalanceCents) {
    const threshold = lowBalanceCents == null ? LOW_BALANCE_CENTS : lowBalanceCents;
    const balances = days.map(function (day) { return cents(day.ending) + (offsets[day.date] || 0); });
    return { negativeDays: balances.filter(function (value) { return value < 0; }).length,
      below300Days: balances.filter(function (value) { return value < threshold; }).length,
      lowest: Math.min.apply(null, balances) / 100 };
  }
  function monthImpacts(days, afterBalances, lowBalanceCents) {
    const threshold = lowBalanceCents == null ? LOW_BALANCE_CENTS : lowBalanceCents;
    const groups = {};
    days.forEach(function (day, index) {
      const month = day.date.slice(0, 7);
      if (!groups[month]) groups[month] = { month: month, before: [], after: [] };
      groups[month].before.push(cents(day.ending));
      groups[month].after.push(afterBalances[index]);
    });
    return Object.keys(groups).sort().map(function (month) {
      const group = groups[month], before = group.before, after = group.after;
      const count = function (values, threshold) {
        return values.filter(function (value) { return value < threshold; }).length;
      };
      return { month: month, negativeBefore: count(before, 0), negativeAfter: count(after, 0),
        below300Before: count(before, threshold), below300After: count(after, threshold),
        lowestBefore: Math.min.apply(null, before) / 100, lowestAfter: Math.min.apply(null, after) / 100,
        endingBefore: before[before.length - 1] / 100, endingAfter: after[after.length - 1] / 100 };
    }).filter(function (item) {
      return item.negativeBefore !== item.negativeAfter || item.below300Before !== item.below300After ||
        item.lowestBefore !== item.lowestAfter || item.endingBefore !== item.endingAfter;
    });
  }
  function planExpense(allDays, amountValue, startDate, endDate, horizonDays, allowSplit) {
    const amount = Math.abs(cents(amountValue));
    if (!amount || !startDate || !endDate || endDate < startDate) return [];
    const days = (allDays || []).filter(function (day) { return day.date >= startDate; })
      .slice(0, Number(horizonDays || 120));
    if (!days.length) return [];
    const positions = {};
    days.forEach(function (day, index) { positions[day.date] = index; });
    const dates = days.filter(function (day) { return day.date <= endDate; }).map(function (day) { return day.date; });
    const baseBalances = days.map(function (day) { return cents(day.ending); });
    const base = metrics(days, {});
    const options = [];
    function add(parts) {
      const afterBalances = baseBalances.map(function (balance, index) {
        let spent = 0;
        parts.forEach(function (part) {
          if (index >= positions[part.date]) spent += part.amount;
        });
        return balance - spent;
      });
      const after = {
        negativeDays: afterBalances.filter(function (balance) { return balance < 0; }).length,
        below300Days: afterBalances.filter(function (balance) { return balance < LOW_BALANCE_CENTS; }).length,
        lowest: Math.min.apply(null, afterBalances) / 100
      };
      options.push({
        kind: parts.length > 1 ? 'split' : 'single',
        parts: parts.map(function (part) { return { date: part.date, amount: part.amount / 100 }; }),
        negativeDaysBefore: base.negativeDays, negativeDaysAfter: after.negativeDays,
        below300DaysBefore: base.below300Days, below300DaysAfter: after.below300Days,
        lowestBefore: base.lowest, lowestAfter: after.lowest,
        monthImpacts: monthImpacts(days, afterBalances)
      });
    }
    dates.forEach(function (date) { add([{ date: date, amount: amount }]); });
    if (allowSplit && dates.length > 1) {
      const firstPart = Math.floor(amount / 2), secondPart = amount - firstPart;
      dates.forEach(function (first, firstIndex) {
        dates.slice(firstIndex + 1).forEach(function (second) {
          add([{ date: first, amount: firstPart }, { date: second, amount: secondPart }]);
        });
      });
    }
    options.sort(function (a, b) {
      return a.negativeDaysAfter - b.negativeDaysAfter ||
        a.below300DaysAfter - b.below300DaysAfter ||
        b.lowestAfter - a.lowestAfter ||
        a.kind.localeCompare(b.kind) ||
        a.parts[a.parts.length - 1].date.localeCompare(b.parts[b.parts.length - 1].date);
    });
    const seen = new Set();
    return options.filter(function (option) {
      const key = option.parts.map(function (part) { return part.date + ':' + part.amount; }).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3).map(function (option, index) {
      option.recommended = index === 0;
      return option;
    });
  }
  function recommend(rows, summary, today, targetFloor) {
    if (!summary || !Array.isArray(summary.days) || !summary.days.length) return [];
    const days = summary.days.filter(function (day) { return day.date >= today; });
    if (!days.length) return [];
    const threshold = targetCents(targetFloor);
    const base = metrics(days, {}, threshold);
    if (!base.below300Days) return [];
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
          const after = metrics(days, offsets, threshold);
          const rescued = base.below300Days - after.below300Days;
          const negativeResolved = base.negativeDays - after.negativeDays;
          if ((rescued <= 0 && negativeResolved <= 0) || after.negativeDays > base.negativeDays) return;
          candidates.push({ kind: index ? 'split' : 'move', name: String(row.name || 'Payment'),
            from: from, to: destination.date, amount: moved / 100,
            originalAmount: amount / 100, negativeDaysBefore: base.negativeDays,
            negativeDaysAfter: after.negativeDays, below300DaysBefore: base.below300Days,
            below300DaysAfter: after.below300Days, negativeDaysResolved: negativeResolved,
            lowestBefore: base.lowest, lowestAfter: after.lowest, daysResolved: rescued,
            delayDays: Math.round((Date.parse(destination.date + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000),
            targetFloor: threshold / 100 });
        });
      });
    });
    candidates.sort(function (a, b) {
      return b.negativeDaysResolved - a.negativeDaysResolved || a.delayDays - b.delayDays ||
        b.daysResolved - a.daysResolved || b.lowestAfter - a.lowestAfter ||
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

  function recommendAhead(rows, allDays, today, horizonDays, targetFloor) {
    const first = String(today || ''), days = (allDays || []).filter(function (day) { return day.date >= first; })
      .slice(0, Number(horizonDays || 120));
    if (!days.length) return [];
    const threshold = targetCents(targetFloor);
    const base = metrics(days, {}, threshold);
    if (!base.below300Days) return [];
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
      const deadline = from.slice(0, 8) + String(cutoff(row)).padStart(2, '0');
      const firstDates = [from].concat(incomeDays.filter(function (day) {
        return day.date < from && positions[from] - positions[day.date] <= 30;
      }).map(function (day) { return day.date; }));
      const secondDates = Array.from(new Set(incomeDays.map(function (day) { return day.date; }).concat(deadline)));
      secondDates.forEach(function (second) {
        const gap = positions[second] - positions[from];
        if (gap <= 0 || gap > 30 || !withinDeadline(row, second) || !Object.prototype.hasOwnProperty.call(positions, second)) return;
        firstDates.forEach(function (firstDate) {
        const firstPart = Math.floor(total / 2), secondPart = total - firstPart;
        const afterBalances = days.map(function (day) {
          let offset = day.date >= from ? total : 0;
          if (day.date >= firstDate) offset -= firstPart;
          if (day.date >= second) offset -= secondPart;
          return cents(day.ending) + offset;
        });
        const after = metrics(days, Object.fromEntries(days.map(function (day, index) {
          return [day.date, afterBalances[index] - cents(day.ending)];
        })), threshold);
        const newLow = days.some(function (day, index) {
          return cents(day.ending) >= threshold && afterBalances[index] < threshold;
        });
        const resolved = base.below300Days - after.below300Days;
        if (resolved <= 0 || newLow || after.negativeDays > base.negativeDays) return;
        results.push({ kind: kind, name: name, from: from, firstDate: firstDate, secondDate: second,
          firstAmount: firstPart / 100, secondAmount: secondPart / 100, originalAmount: total / 100,
          daysResolved: resolved, negativeDaysBefore: base.negativeDays,
          negativeDaysAfter: after.negativeDays, below300DaysBefore: base.below300Days,
          below300DaysAfter: after.below300Days, negativeDaysResolved: base.negativeDays - after.negativeDays,
          lowestBefore: base.lowest, lowestAfter: after.lowest,
          monthImpacts: monthImpacts(days, afterBalances, threshold), targetFloor: threshold / 100 });
        });
      });
    });
    results.sort(function (a, b) {
      return b.negativeDaysResolved - a.negativeDaysResolved || b.daysResolved - a.daysResolved ||
        a.negativeDaysAfter - b.negativeDaysAfter ||
        b.lowestAfter - a.lowestAfter || a.from.localeCompare(b.from) ||
        a.firstDate.localeCompare(b.firstDate) || a.secondDate.localeCompare(b.secondDate);
    });
    const seen = new Set();
    return results.filter(function (item) {
      const key = item.kind + '|' + item.from;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }

  return { recommend: recommend, recommendAhead: recommendAhead, planExpense: planExpense };
});
