(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260702mobile1';
  const MOBILE_FIT_HREF = '/mobile-fit.css?v=20260702fit3';
  const ACTION_LOG_LABEL = 'billsos action log';
  const BALANCE_CORRECTION_LABEL = 'balance correction';
  const YEAR = 2026;
  const FIRST_BEGIN = 3671;
  const RULE_ID = '__billsos_system_rules__';
  const MONTHS = [
    ['june', 6, 'June'],
    ['july', 7, 'July'],
    ['aug', 8, 'August'],
    ['sep', 9, 'September'],
    ['oct', 10, 'October'],
    ['nov', 11, 'November'],
    ['dec', 12, 'December']
  ];

  function installStylesheet(href, dataKey, dataValue) {
    if (document.querySelector('link[' + dataKey + '="' + dataValue + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(dataKey, dataValue);
    document.head.appendChild(link);
  }

  function installCalmHouseholdTheme() {
    installStylesheet(CALM_THEME_HREF, 'data-billsos-calm-household', '1');
    installStylesheet(MOBILE_FIT_HREF, 'data-billsos-mobile-fit', '1');
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function normalizedText(el) {
    return text(el).toLowerCase();
  }

  function isActionLogMeta(item) {
    return normalizedText(item).indexOf(ACTION_LOG_LABEL) >= 0;
  }

  function isBalanceCorrection(item) {
    return normalizedText(item).indexOf(BALANCE_CORRECTION_LABEL) >= 0;
  }

  function isCalculationOnly(item) {
    return isActionLogMeta(item) || isBalanceCorrection(item);
  }

  function money(value) {
    return Number(value || 0).toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
  }

  function days(month) {
    return new Date(YEAR, month, 0).getDate();
  }

  function iso(month, day) {
    return YEAR + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function rowKey(event) {
    return (event.originalDate || event.date) + '|' + event.name + '|' + event.amount;
  }

  function systemRules(data) {
    const defaults = {
      spendingFunding: { enabled: true, amount: 1500, count: 2, timing: 'same-day-income' },
      sweep: {
        enabled: true,
        preferredBuffer: 1250,
        hardBuffer: 1000,
        day: 28,
        label: 'Sweep transfer',
        targets: {
          '2026-07': { day: 31, amount: 705.05, label: 'Sweep to savings / debt' },
          '2026-09': { day: 30, amount: 1123.2, label: 'Sweep to savings / debt' }
        }
      }
    };
    try {
      const row = (data.oneTimeEvents || []).find(function (item) { return item && item.id === RULE_ID; });
      const parsed = row && row.notes ? JSON.parse(row.notes) : {};
      if (parsed.spendingFunding) Object.assign(defaults.spendingFunding, parsed.spendingFunding);
      if (parsed.sweep) Object.assign(defaults.sweep, parsed.sweep);
      defaults.sweep.targets = Object.assign({}, defaults.sweep.targets, (parsed.sweep && parsed.sweep.targets) || {});
      if (defaults.spendingFunding.timing === 'after-income') defaults.spendingFunding.timing = 'same-day-income';
    } catch (_err) {}
    return defaults;
  }

  function oneDates(item, monthKey) {
    const out = [];
    const matches = String(item.notes || '').match(/20\d{2}-\d{2}-\d{2}/g) || [];
    matches.forEach(function (date) {
      if (date.slice(0, 7) === monthKey && out.indexOf(date) < 0) out.push(date);
    });
    if (!out.length && item.date && String(item.date).slice(0, 7) === monthKey) out.push(item.date);
    return out;
  }

  function generateRows(data, month, begin) {
    const monthKey = YEAR + '-' + String(month).padStart(2, '0');
    const dim = days(month);
    const rows = [];

    function push(day, name, amount, cls, type) {
      const n = Number(day || 0);
      if (n >= 1 && n <= dim) {
        rows.push({ date: iso(month, n), day: n, name: name || 'Item', amount: Number(amount || 0), cls: cls || 'out', type: type || '' });
      }
    }

    function safeSweepAmount(day, requested) {
      const byDay = {};
      let balance = Number(begin || 0);
      let minAfter = null;
      rows.forEach(function (row) {
        byDay[row.day] = (byDay[row.day] || 0) + Number(row.amount || 0);
      });
      for (let d = 1; d <= dim; d += 1) {
        balance += Number(byDay[d] || 0);
        if (d >= day) minAfter = minAfter === null ? balance : Math.min(minAfter, balance);
      }
      const safe = Math.max(0, Math.floor(Number(minAfter || 0) * 100) / 100);
      return Math.max(0, Math.min(Math.abs(Number(requested || 0)), safe));
    }

    (data.bills || []).forEach(function (bill) {
      if (bill.active === false) return;
      if (bill.frequency && bill.frequency !== 'monthly') return;
      if (bill.startMonth && bill.startMonth > monthKey) return;
      if (bill.endMonth && bill.endMonth < monthKey) return;
      push(Math.min(Number(bill.dueDay || 1), dim), bill.name || 'Bill', -Math.abs(Number(bill.amount || 0)), 'out', bill.payMethod || bill.paymentMethod || bill.type);
    });

    (data.oneTimeEvents || []).forEach(function (item) {
      if (item.id === RULE_ID) return;
      oneDates(item, monthKey).forEach(function (date) {
        const amount = Number(item.amount || 0);
        const isIncome = item.type === 'income';
        push(Number(date.slice(8, 10)), item.name || 'One-time item', isIncome ? Math.abs(amount) : -Math.abs(amount), isIncome ? 'in' : 'out', item.type);
      });
    });

    (data.income || []).forEach(function (income) {
      if (income.active === false) return;
      const amount = Math.abs(Number(income.amount || 0));
      const name = income.name || 'Income';
      const schedule = income.schedule || 'manual';
      if (schedule === 'semi-monthly-15-30') {
        push(15, name, amount, 'in', 'income');
        push(Math.min(30, dim), name, amount, 'in', 'income');
      } else if (schedule === 'biweekly') {
        [1, 15, 29].forEach(function (day) { if (day <= dim) push(day, name, amount, 'in', 'income'); });
      } else {
        push(1, name, amount, 'in', 'income');
      }
    });

    const rules = systemRules(data);
    const spending = rules.spendingFunding;
    if (spending.enabled !== false && Number(spending.amount) > 0) {
      let incomeDays = rows.filter(function (row) { return row.amount > 0 && /alissa|humc/i.test(row.name); }).map(function (row) { return row.day; }).sort(function (a, b) { return a - b; });
      if (!incomeDays.length) incomeDays = rows.filter(function (row) { return row.amount > 0; }).map(function (row) { return row.day; }).sort(function (a, b) { return a - b; });
      for (let i = 0; i < Number(spending.count || 0); i += 1) {
        const base = spending.timing === 'fixed-1-15' ? (i ? 15 : 1) : (incomeDays[i] || [1, 15, 29][i] || 1);
        const add = spending.timing === 'day-after-income' ? 1 : 0;
        push(Math.min(dim, Math.max(1, base + add)), 'Spending account funding', -Math.abs(Number(spending.amount)), 'out system', 'rule');
      }
    }

    const sweep = rules.sweep;
    const target = sweep.targets && sweep.targets[monthKey];
    if (sweep.enabled !== false && monthKey !== '2026-06') {
      if (target && Number(target.amount) > 0) {
        const day = Math.min(dim, Number(target.day || dim));
        const amount = safeSweepAmount(day, target.amount);
        if (amount > 0) push(day, target.label || sweep.label || 'Sweep transfer', -amount, 'out system', 'rule');
      } else {
        const income = rows.filter(function (row) { return row.amount > 0; }).reduce(function (sum, row) { return sum + row.amount; }, 0);
        const outflow = rows.filter(function (row) { return row.amount < 0; }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
        const available = Number(begin || 0) + income - outflow - Number(sweep.preferredBuffer || 0);
        const day = Math.min(dim, Math.max(1, Number(sweep.day || 28)));
        const amount = safeSweepAmount(day, Math.round(available * 100) / 100);
        if (available > 0 && amount > 0) push(day, sweep.label || 'Sweep transfer', -amount, 'out system', 'rule');
      }
    }

    return rows.sort(function (a, b) { return a.date.localeCompare(b.date) || b.amount - a.amount; });
  }

  function effectiveRows(rows, month) {
    const monthKey = YEAR + '-' + String(month).padStart(2, '0');
    let adjust = {};
    try { adjust = JSON.parse(localStorage.getItem('billsos-pay-adjust-v1') || '{}') || {}; } catch (_err) {}
    return rows.map(function (row) {
      const event = Object.assign({}, row);
      const key = rowKey(event);
      const move = adjust[key];
      event.originalKey = key;
      event.originalDate = event.date;
      event.originalDay = event.day;
      if (move && move.date) {
        event.date = move.date;
        event.day = Number(move.date.slice(8, 10));
        event.adjusted = move;
      }
      return event;
    }).filter(function (event) {
      return event.date.slice(0, 7) === monthKey;
    }).sort(function (a, b) { return a.date.localeCompare(b.date) || b.amount - a.amount; });
  }

  function buildModel(data) {
    const model = {};
    let balance = FIRST_BEGIN;
    MONTHS.forEach(function (monthDef) {
      const begin = balance;
      const rows = effectiveRows(generateRows(data, monthDef[1], begin), monthDef[1]);
      const income = rows.filter(function (row) { return row.amount > 0; }).reduce(function (sum, row) { return sum + row.amount; }, 0);
      const outflow = rows.filter(function (row) { return row.amount < 0; }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const end = begin + income - outflow;
      model[monthDef[0]] = { month: monthDef, begin: begin, rows: rows, income: income, outflow: outflow, end: end };
      balance = end;
    });
    return model;
  }

  function visibleMonthKey() {
    const title = text(document.querySelector('.monthHead h2')).toLowerCase();
    const found = MONTHS.find(function (month) { return title.indexOf(month[2].toLowerCase()) >= 0; });
    return found ? found[0] : null;
  }

  let balanceSyncTimer = 0;
  let balanceSyncBusy = false;
  let balanceSyncSignature = '';

  async function syncVisibleBalancesFromData() {
    if (balanceSyncBusy) return;
    const mount = document.getElementById('mount');
    const monthKey = visibleMonthKey();
    if (!mount || !monthKey) return;
    balanceSyncBusy = true;
    try {
      const response = await fetch('/api/bills?balanceSync=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const model = buildModel(data || {});
      const current = model[monthKey];
      if (!current) return;
      const signature = monthKey + '|' + current.begin + '|' + current.income + '|' + current.outflow + '|' + current.end + '|' + (data.updatedAt || '');
      if (signature === balanceSyncSignature) return;
      balanceSyncSignature = signature;

      const projectedSweep = current.rows.filter(function (row) { return row.amount < 0 && /sweep/i.test(row.name); }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const kbegin = document.getElementById('kbegin');
      const kin = document.getElementById('kin');
      const kout = document.getElementById('kout');
      const kend = document.getElementById('kend');
      const ksweep = document.getElementById('ksweep');
      if (kbegin) kbegin.textContent = money(current.begin);
      if (kin) kin.textContent = money(current.income);
      if (kout) kout.textContent = money(current.outflow);
      if (kend) kend.textContent = money(current.end);
      if (ksweep) ksweep.textContent = money(projectedSweep);

      const byDay = {};
      current.rows.forEach(function (row) {
        byDay[row.day] = (byDay[row.day] || 0) + row.amount;
      });
      let running = current.begin;
      mount.querySelectorAll('.day:not(.blank)').forEach(function (dayNode) {
        const dayNum = Number(text(dayNode.querySelector('.topline b')) || 0);
        if (!dayNum) return;
        const startNode = dayNode.querySelector('.topline span:last-child b');
        const endNode = dayNode.querySelector('.endline b');
        if (startNode) startNode.textContent = money(running);
        running += Number(byDay[dayNum] || 0);
        if (endNode) endNode.textContent = money(running);
      });
    } catch (_err) {
      // Leave rendered balances untouched if saved data cannot be read.
    } finally {
      balanceSyncBusy = false;
    }
  }

  function scheduleBalanceSync() {
    window.clearTimeout(balanceSyncTimer);
    balanceSyncTimer = window.setTimeout(syncVisibleBalancesFromData, 120);
  }

  function removeCalendarCalculationOnlyRows() {
    document.querySelectorAll('.day label.ev, .day .ev').forEach(function (item) {
      if (!isCalculationOnly(item)) return;
      item.remove();
    });
  }

  function removeDrawerCalculationOnlyRows() {
    const detail = document.getElementById('detailContent');
    if (!detail) return;

    const items = Array.from(detail.querySelectorAll('.detailItem'));
    if (!items.length) return;

    let removed = false;
    items.forEach(function (item) {
      if (!isCalculationOnly(item)) return;
      item.remove();
      removed = true;
    });

    if (removed && !detail.querySelector('.detailItem')) {
      detail.className = 'detailEmpty';
      detail.textContent = 'No visible actions on this day.';
    }
  }

  function syncDrawer() {
    scheduleBalanceSync();
    removeCalendarCalculationOnlyRows();
    removeDrawerCalculationOnlyRows();

    const items = document.querySelectorAll('#detailContent .detailItem');
    if (!items.length) return;

    items.forEach(function (item) {
      const key = item.getAttribute('data-detail-id');
      const match = key ? document.querySelector('.day label.ev input[data-id="' + CSS.escape(key) + '"]') : null;
      const existing = item.querySelector(CHECKBOX_SELECTOR);
      const checked = !!(match && match.checked);

      if (!existing && match) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Mark complete');
        box.dataset.ddSync = '1';
        box.checked = checked;
        box.addEventListener('change', function () {
          const calendarBox = match;
          if (!calendarBox) return;
          if (calendarBox.checked === box.checked) return;
          calendarBox.checked = box.checked;
          calendarBox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const main = item.querySelector('.detailMain');
        if (main && main.parentNode === item) item.insertBefore(box, main);
        else item.insertBefore(box, item.firstChild);
      } else if (existing) {
        existing.checked = checked;
      }
    });
  }

  let timer = 0;
  function scheduleSync() {
    window.clearTimeout(timer);
    timer = window.setTimeout(syncDrawer, 50);
  }

  installCalmHouseholdTheme();

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  window.addEventListener('load', function () {
    installCalmHouseholdTheme();
    scheduleSync();
    scheduleBalanceSync();
  });
  window.addEventListener('hashchange', function () {
    balanceSyncSignature = '';
    scheduleSync();
    scheduleBalanceSync();
  });
  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest('#tabs button')) {
      balanceSyncSignature = '';
      scheduleBalanceSync();
    }
  });
  scheduleSync();
  scheduleBalanceSync();
})();