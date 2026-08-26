(function () {
  'use strict';

  const YEAR = 2026;
  const FIRST_BEGIN = 0;
  const LOW_BALANCE_WARNING = 300;
  const RULE_ID = '__billsos_system_rules__';
  const AMOUNT_STORE = 'billsos-amount-adjust-v1';
  const DATE_STORE = 'billsos-pay-adjust-v1';
  const MONTHS = [['june', 6, 'June', 2026], ['july', 7, 'July', 2026], ['aug', 8, 'August', 2026], ['sep', 9, 'September', 2026], ['oct', 10, 'October', 2026], ['nov', 11, 'November', 2026], ['dec', 12, 'December', 2026], ['january-2027', 1, 'January', 2027], ['february-2027', 2, 'February', 2027], ['march-2027', 3, 'March', 2027], ['april-2027', 4, 'April', 2027], ['may-2027', 5, 'May', 2027], ['june-2027', 6, 'June', 2027], ['july-2027', 7, 'July', 2027], ['august-2027', 8, 'August', 2027], ['september-2027', 9, 'September', 2027], ['october-2027', 10, 'October', 2027], ['november-2027', 11, 'November', 2027], ['december-2027', 12, 'December', 2027]];

  function text(el) { return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim(); }
  function money(value) { return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  function moneyCents(value) { return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function days(month, year) { return new Date(year || YEAR, month, 0).getDate(); }
  function iso(month, day, year) { return (year || YEAR) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
  function rowKey(event) { return (event.originalDate || event.date) + '|' + event.name + '|' + event.amount; }
  function readStore(key) { try { const parsed = JSON.parse(localStorage.getItem(key) || '{}') || {}; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch (_err) { return {}; } }
  function keyIdentity(key) {
    const parts = String(key || '').split('|');
    if (parts.length < 3) return '';
    return parts.slice(1).join('|');
  }
  function matchingOverride(map, key) {
    if (map && map[key]) return map[key];
    const identity = keyIdentity(key);
    if (!identity) return null;
    const matches = Object.keys(map || {}).filter(function (candidate) { return keyIdentity(candidate) === identity; });
    if (!matches.length) return null;
    matches.sort(function (a, b) {
      const at = Date.parse((map[a] && map[a].updatedAt) || '') || 0;
      const bt = Date.parse((map[b] && map[b].updatedAt) || '') || 0;
      return bt - at;
    });
    return map[matches[0]] || null;
  }
  function oneDates(item, monthKey) {
    const out = [];
    const explicit = [item && item.date, item && item.iso, item && item.startDate, item && item.effectiveDate].filter(function (date) { return /^20\d{2}-\d{2}-\d{2}$/.test(String(date || '')); });
    explicit.forEach(function (date) { if (date.slice(0, 7) === monthKey && out.indexOf(date) < 0) out.push(date); });
    return out;
  }
  function signedAdjustmentAmount(item) {
    const amount = Number(item.amount || 0);
    if (/adjustment|correction/i.test(String(item.type || '')) || /adjustment|correction/i.test(String(item.name || ''))) return amount;
    if (item.type === 'income') return Math.abs(amount);
    return -Math.abs(amount);
  }
  function generateRows(data, month, year) {
    year = year || YEAR;
    if (window.BillsOSCashflow && typeof window.BillsOSCashflow.rowsForMonth === 'function') {
      return window.BillsOSCashflow.rowsForMonth(data, month, 0, year).map(function (row) {
        return {
          date: row.iso,
          day: row.day,
          name: row.name,
          amount: row.amount,
          type: row.type,
          sourceId: row.sourceId || ''
        };
      });
    }
    const monthKey = year + '-' + String(month).padStart(2, '0');
    const dim = days(month, year);
    const rows = [];
    function push(day, name, amount, type) {
      const n = Number(day || 0);
      if (n >= 1 && n <= dim) rows.push({ date: iso(month, n, year), day: n, name: name || 'Item', amount: Number(amount || 0), type: type || '' });
    }
    (data.bills || []).forEach(function (bill) {
      if (bill.active === false || (bill.frequency && bill.frequency !== 'monthly') || (bill.startMonth && bill.startMonth > monthKey) || (bill.endMonth && bill.endMonth < monthKey)) return;
      const dueDay = Number(bill.dueDay);
      if (Number.isInteger(dueDay) && dueDay >= 1) push(Math.min(dueDay, dim), bill.name || 'Bill', -Math.abs(Number(bill.amount || 0)), bill.type || 'bill');
    });
    (data.oneTimeEvents || []).forEach(function (item) {
      if (item.id === RULE_ID) return;
      oneDates(item, monthKey).forEach(function (date) {
        push(Number(date.slice(8, 10)), item.name || 'Cash flow adjustment', signedAdjustmentAmount(item), item.type || 'adjustment');
      });
    });
    (data.income || []).forEach(function (income) {
      if (income.active === false) return;
      const amount = Math.abs(Number(income.amount || 0));
      const name = income.name || 'Income';
      const schedule = income.schedule || 'manual';
      if (schedule === 'semi-monthly-15-30') { push(15, name, amount, 'income'); push(Math.min(30, dim), name, amount, 'income'); }
      else if ((schedule === 'biweekly' || schedule === 'monthly' || schedule === 'manual') && /^20\d{2}-\d{2}-\d{2}$/.test(String(income.startDate || ''))) {
        const start = income.startDate;
        if (schedule === 'monthly') push(Math.min(Number(start.slice(8, 10)), dim), name, amount, 'income');
        else if (schedule === 'manual' && start.slice(0, 7) === monthKey) push(Number(start.slice(8, 10)), name, amount, 'income');
      }
    });
    return rows;
  }
  function effectiveRows(rows, month, year) {
    const monthKey = (year || YEAR) + '-' + String(month).padStart(2, '0');
    const amountAdjustments = readStore(AMOUNT_STORE);
    const dateAdjustments = readStore(DATE_STORE);
    return rows.map(function (row) {
      const event = Object.assign({}, row);
      const key = rowKey(event);
      const amountEdit = matchingOverride(amountAdjustments, key);
      const move = matchingOverride(dateAdjustments, key);
      event.originalKey = key;
      event.originalDate = event.date;
      if (amountEdit && Number.isFinite(Number(amountEdit.amount))) event.amount = (event.amount < 0 ? -1 : 1) * Math.abs(Number(amountEdit.amount));
      if (move && move.date) { event.date = move.date; event.day = Number(move.date.slice(8, 10)); }
      return event;
    }).filter(function (event) { return event.date.slice(0, 7) === monthKey; });
  }
  function buildModel(data) {
    const model = {};
    let balance = FIRST_BEGIN;
    MONTHS.forEach(function (monthDef) {
      let begin = balance;
      let rows = effectiveRows(generateRows(data, monthDef[1], monthDef[3]), monthDef[1], monthDef[3]);
      const income = rows.filter(function (row) { return row.amount > 0; }).reduce(function (sum, row) { return sum + row.amount; }, 0);
      const outflow = rows.filter(function (row) { return row.amount < 0; }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const sweep = rows.filter(function (row) { return row.amount < 0 && /sweep/i.test(row.name); }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const end = begin + income - outflow;
      model[monthDef[0]] = { begin: begin, rows: rows, income: income, outflow: outflow, sweep: sweep, end: end };
      balance = end;
    });
    return model;
  }
  function visibleMonth() {
    const panel = document.querySelector('.month-panel.show');
    if (panel) return MONTHS.find(function (month) { return month[1] === Number(panel.dataset.month) && month[3] === Number(panel.dataset.year); });
    const title = text(document.querySelector('.monthHead h2')).toLowerCase();
    return MONTHS.find(function (month) { return title.indexOf(month[2].toLowerCase()) >= 0 && title.indexOf(String(month[3])) >= 0; });
  }
  function setValue(id, value) { const el = document.getElementById(id); if (el) el.textContent = money(value); }
  function syncDayBalanceClass(dayNode, balance) {
    const negative = balance < 0;
    dayNode.classList.toggle('negative', negative);
    dayNode.classList.toggle('is-warn', !negative && balance < LOW_BALANCE_WARNING);
    dayNode.classList.remove('low');
  }
  function dayNodeFor(day) {
    return Array.from(document.querySelectorAll('#mount .day:not(.blank)')).find(function (node) {
      return Number(text(node.querySelector('.topline b')) || 0) === Number(day);
    }) || null;
  }
  function syncAdjustmentCalendarRows(current) {
    if (!current || !current.rows) return;
    current.rows.filter(function (row) { return row.type === 'adjustment'; }).forEach(function (row) {
      const dayNode = dayNodeFor(row.day);
      if (!dayNode) return;
      const candidates = Array.from(dayNode.querySelectorAll('.ev'));
      const calendarRow = candidates.find(function (node) {
        const nameNode = node.querySelector(':scope > span') || node.querySelector('.nm') || node.querySelector('span');
        return text(nameNode) === row.name;
      });
      if (!calendarRow) return;
      const isInflow = row.amount > 0;
      calendarRow.classList.toggle('in', isInflow);
      calendarRow.classList.toggle('out', !isInflow);
      calendarRow.classList.remove('xfer');
      const input = calendarRow.querySelector('input[data-id]');
      if (input) input.setAttribute('data-id', row.originalKey || rowKey(row));
      const amountNode = calendarRow.querySelector('.amountEditBtn') || calendarRow.querySelector('b');
      if (amountNode) amountNode.textContent = moneyCents(Math.abs(row.amount));
    });
  }

  let recalculationBusy = false;
  window.BillsOSRecalculateVisibleBalances = async function () {
    if (recalculationBusy) return;
    const monthDef = visibleMonth();
    const mount = document.getElementById('mount');
    if (!monthDef || !mount) return;
    recalculationBusy = true;
    try {
      const response = await fetch('/api/bills?amountBalance=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      // Use the same cash-flow rows as the calendar renderer.  This matters for
      // policies such as split mortgage payments and for signed balance
      // corrections; rebuilding those rules here caused a later recalculation
      // to overwrite otherwise-correct calendar balances.
      const model = buildModel(await response.json());
      const current = model[monthDef[0]];
      if (!current) return;

      setValue('kbegin', current.begin);
      setValue('kin', current.income);
      setValue('kout', current.outflow);
      setValue('kend', current.end);
      setValue('ksweep', current.sweep);
      syncAdjustmentCalendarRows(current);

      const byDay = {}, openingByDay = {};
      current.rows.forEach(function (row) {
        if (row.type === 'balance-opening-adjustment') openingByDay[row.day] = (openingByDay[row.day] || 0) + row.amount;
        else byDay[row.day] = (byDay[row.day] || 0) + row.amount;
      });
      let running = current.begin;
      mount.querySelectorAll('.day:not(.blank)').forEach(function (dayNode) {
        const dayNum = Number(text(dayNode.querySelector('.topline b')) || 0);
        if (!dayNum) return;
        const startNode = dayNode.querySelector('.topline span:last-child b');
        const endNode = dayNode.querySelector('.endline b');
        running += Number(openingByDay[dayNum] || 0);
        if (startNode) startNode.textContent = money(running);
        running += Number(byDay[dayNum] || 0);
        if (endNode) endNode.textContent = money(running);
        syncDayBalanceClass(dayNode, running);
      });

      const selected = document.querySelector('.day.selected');
      const detailSub = document.getElementById('detailSub');
      if (selected && detailSub) {
        const start = text(selected.querySelector('.topline span:last-child b')) || '—';
        const end = text(selected.querySelector('.endline b')) || '—';
        detailSub.textContent = 'Starting ' + start + ' · Ending ' + end;
      }
    } finally {
      recalculationBusy = false;
    }
  };

  function scheduleRecalculation(delay) {
    window.setTimeout(function () {
      if (typeof window.BillsOSRecalculateVisibleBalances === 'function') window.BillsOSRecalculateVisibleBalances();
    }, delay || 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scheduleRecalculation(0); scheduleRecalculation(350); scheduleRecalculation(1200); });
  else { scheduleRecalculation(0); scheduleRecalculation(350); scheduleRecalculation(1200); }
  window.addEventListener('pageshow', function () { scheduleRecalculation(100); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) scheduleRecalculation(100); });
  document.addEventListener('click', function () { scheduleRecalculation(250); }, true);
})();
