(function () {
  'use strict';

  const YEAR = 2026;
  const FIRST_BEGIN = 3671;
  const JULY_REBASE_DAY = 2;
  const JULY_REBASE_END = 2310;
  const RULE_ID = '__billsos_system_rules__';
  const AMOUNT_STORE = 'billsos-amount-adjust-v1';
  const DATE_STORE = 'billsos-pay-adjust-v1';
  const MONTHS = [['june', 6, 'June'], ['july', 7, 'July'], ['aug', 8, 'August'], ['sep', 9, 'September'], ['oct', 10, 'October'], ['nov', 11, 'November'], ['dec', 12, 'December']];

  function text(el) { return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim(); }
  function money(value) { return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  function days(month) { return new Date(YEAR, month, 0).getDate(); }
  function iso(month, day) { return YEAR + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
  function rowKey(event) { return (event.originalDate || event.date) + '|' + event.name + '|' + event.amount; }
  function readStore(key) { try { const parsed = JSON.parse(localStorage.getItem(key) || '{}') || {}; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch (_err) { return {}; } }
  function oneDates(item, monthKey) {
    const out = [];
    const matches = String(item.notes || '').match(/20\d{2}-\d{2}-\d{2}/g) || [];
    matches.forEach(function (date) { if (date.slice(0, 7) === monthKey && out.indexOf(date) < 0) out.push(date); });
    if (!out.length && item.date && String(item.date).slice(0, 7) === monthKey) out.push(item.date);
    return out;
  }
  function generateRows(data, month) {
    const monthKey = YEAR + '-' + String(month).padStart(2, '0');
    const dim = days(month);
    const rows = [];
    function push(day, name, amount) {
      const n = Number(day || 0);
      if (n >= 1 && n <= dim) rows.push({ date: iso(month, n), day: n, name: name || 'Item', amount: Number(amount || 0) });
    }
    (data.bills || []).forEach(function (bill) {
      if (bill.active === false || (bill.frequency && bill.frequency !== 'monthly') || (bill.startMonth && bill.startMonth > monthKey) || (bill.endMonth && bill.endMonth < monthKey)) return;
      push(Math.min(Number(bill.dueDay || 1), dim), bill.name || 'Bill', -Math.abs(Number(bill.amount || 0)));
    });
    (data.oneTimeEvents || []).forEach(function (item) {
      if (item.id === RULE_ID) return;
      oneDates(item, monthKey).forEach(function (date) {
        const amount = Number(item.amount || 0);
        push(Number(date.slice(8, 10)), item.name || 'One-time item', item.type === 'income' ? Math.abs(amount) : -Math.abs(amount));
      });
    });
    (data.income || []).forEach(function (income) {
      if (income.active === false) return;
      const amount = Math.abs(Number(income.amount || 0));
      const name = income.name || 'Income';
      const schedule = income.schedule || 'manual';
      if (schedule === 'semi-monthly-15-30') { push(15, name, amount); push(Math.min(30, dim), name, amount); }
      else if (schedule === 'biweekly') [1, 15, 29].forEach(function (day) { if (day <= dim) push(day, name, amount); });
      else push(1, name, amount);
    });
    return rows;
  }
  function effectiveRows(rows, month) {
    const monthKey = YEAR + '-' + String(month).padStart(2, '0');
    const amountAdjustments = readStore(AMOUNT_STORE);
    const dateAdjustments = readStore(DATE_STORE);
    return rows.map(function (row) {
      const event = Object.assign({}, row);
      const key = rowKey(event);
      const amountEdit = amountAdjustments[key];
      const move = dateAdjustments[key];
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
      let rows = effectiveRows(generateRows(data, monthDef[1]), monthDef[1]);
      if (monthDef[0] === 'july') { begin = JULY_REBASE_END; rows = rows.filter(function (row) { return row.day > JULY_REBASE_DAY; }); }
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
    const title = text(document.querySelector('.monthHead h2')).toLowerCase();
    return MONTHS.find(function (month) { return title.indexOf(month[2].toLowerCase()) >= 0; });
  }
  function setValue(id, value) { const el = document.getElementById(id); if (el) el.textContent = money(value); }

  window.BillsOSRecalculateVisibleBalances = async function () {
    const monthDef = visibleMonth();
    const mount = document.getElementById('mount');
    if (!monthDef || !mount) return;
    const response = await fetch('/api/bills?amountBalance=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) return;
    const model = buildModel(await response.json());
    const current = model[monthDef[0]];
    if (!current) return;

    setValue('kbegin', current.begin);
    setValue('kin', current.income);
    setValue('kout', current.outflow);
    setValue('kend', current.end);
    setValue('ksweep', current.sweep);

    const byDay = {};
    current.rows.forEach(function (row) { byDay[row.day] = (byDay[row.day] || 0) + row.amount; });
    let running = current.begin;
    mount.querySelectorAll('.day:not(.blank)').forEach(function (dayNode) {
      const dayNum = Number(text(dayNode.querySelector('.topline b')) || 0);
      if (!dayNum) return;
      const startNode = dayNode.querySelector('.topline span:last-child b');
      const endNode = dayNode.querySelector('.endline b');
      if (startNode) startNode.textContent = money(running);
      if (monthDef[0] === 'july' && dayNum <= JULY_REBASE_DAY) {
        running = JULY_REBASE_END;
        if (endNode) endNode.textContent = money(running);
        return;
      }
      running += Number(byDay[dayNum] || 0);
      if (endNode) endNode.textContent = money(running);
    });

    const selected = document.querySelector('.day.selected');
    const detailSub = document.getElementById('detailSub');
    if (selected && detailSub) {
      const start = text(selected.querySelector('.topline span:last-child b')) || '—';
      const end = text(selected.querySelector('.endline b')) || '—';
      detailSub.textContent = 'Starting ' + start + ' · Ending ' + end;
    }
  };
})();
