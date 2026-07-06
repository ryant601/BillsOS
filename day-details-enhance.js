(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260703pill1';
  const MOBILE_FIT_HREF = '/mobile-fit.css?v=20260702fit3';
  const ACTION_LOG_LABEL = 'billsos action log';
  const BALANCE_CORRECTION_LABEL = 'balance correction';
  const SPENDING_FUNDING_LABEL = 'spending account funding';
  const AMOUNT_ADJUST_STORE = 'billsos-amount-adjust-v1';
  const YEAR = 2026;
  const FIRST_BEGIN = 3671;
  const JULY_REBASE_DAY = 2;
  const JULY_REBASE_END = 2310;
  const RULE_ID = '__billsos_system_rules__';
  const MONTHS = [['june', 6, 'June'], ['july', 7, 'July'], ['aug', 8, 'August'], ['sep', 9, 'September'], ['oct', 10, 'October'], ['nov', 11, 'November'], ['dec', 12, 'December']];

  function text(el) { return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim(); }
  function normalizedText(el) { return text(el).toLowerCase(); }
  function isActionLogMeta(item) { return normalizedText(item).indexOf(ACTION_LOG_LABEL) >= 0; }
  function isBalanceCorrection(item) { return normalizedText(item).indexOf(BALANCE_CORRECTION_LABEL) >= 0; }
  function isAutoSpendingFunding(item) { return normalizedText(item).indexOf(SPENDING_FUNDING_LABEL) >= 0; }
  function isCalculationOnly(item) { return isActionLogMeta(item) || isBalanceCorrection(item) || isAutoSpendingFunding(item); }
  function money(value) { return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  function moneyCents(value) { return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function signedMoney(value) { const n = Number(value || 0); return (n < 0 ? '−' : '+') + money(Math.abs(n)); }
  function parseMoney(value) { const n = Number(String(value || '').replace(/[−–—]/g, '-').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
  function absMoney(value) { return Math.abs(parseMoney(value)); }
  function days(month) { return new Date(YEAR, month, 0).getDate(); }
  function iso(month, day) { return YEAR + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
  function rowKey(event) { return (event.originalDate || event.date) + '|' + event.name + '|' + event.amount; }
  function escAttr(value) { return String(value || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cssEscape(value) { return window.CSS && CSS.escape ? CSS.escape(value) : String(value || '').replace(/["\\]/g, '\\$&'); }

  function amountFromKey(key) {
    const parts = String(key || '').split('|');
    const raw = parts.length ? Number(parts[parts.length - 1]) : NaN;
    return Number.isFinite(raw) ? raw : 0;
  }
  function readAmountAdjustments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AMOUNT_ADJUST_STORE) || '{}') || {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_err) {
      return {};
    }
  }
  function writeAmountAdjustments(adjustments) {
    try { localStorage.setItem(AMOUNT_ADJUST_STORE, JSON.stringify(adjustments || {})); } catch (_err) {}
  }
  function adjustedSignedAmount(key, fallbackAmount) {
    const base = Number.isFinite(Number(fallbackAmount)) ? Number(fallbackAmount) : amountFromKey(key);
    const edit = readAmountAdjustments()[key];
    const amount = edit && Number.isFinite(Number(edit.amount)) ? Math.abs(Number(edit.amount)) : Math.abs(base);
    return base < 0 ? -amount : amount;
  }
  function hasAmountAdjustment(key) {
    const edit = readAmountAdjustments()[key];
    return !!(edit && Number.isFinite(Number(edit.amount)));
  }
  function currentDueDate(key) {
    const original = String(key || '').split('|')[0] || '';
    try {
      const moves = JSON.parse(localStorage.getItem('billsos-pay-adjust-v1') || '{}') || {};
      const moved = moves[key] && moves[key].date;
      return /^20\d{2}-\d{2}-\d{2}$/.test(String(moved || '')) ? moved : original;
    } catch (_err) {
      return original;
    }
  }
  function shortDueDate(key) {
    const value = currentDueDate(key);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(value + 'T12:00:00');
    return (date.getMonth() + 1) + '/' + date.getDate();
  }
  function saveAmountAdjustment(key, amount) {
    const cleanAmount = Math.round(Math.abs(Number(amount || 0)) * 100) / 100;
    if (!Number.isFinite(cleanAmount) || cleanAmount < 0) return false;
    const baseAmount = Math.abs(amountFromKey(key));
    const adjustments = readAmountAdjustments();
    if (Math.abs(cleanAmount - baseAmount) < 0.005) delete adjustments[key];
    else adjustments[key] = { amount: cleanAmount, updatedAt: new Date().toISOString() };
    writeAmountAdjustments(adjustments);
    return true;
  }

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

  function installOneTimeTransferStyles() {
    if (document.getElementById('oneTimeTransferStyles')) return;
    const style = document.createElement('style');
    style.id = 'oneTimeTransferStyles';
    style.textContent = [
      '.ev.xfer{background:#E4F1EA!important;color:#276749!important;border:1px solid rgba(47,133,90,.24)!important;outline:none!important}',
      '.ev.xfer .nm,.ev.xfer span,.ev.xfer b{color:#276749!important}',
      '.ev.xfer .dot{background:#2F855A!important;box-shadow:0 0 0 2px rgba(47,133,90,.16)!important}',
      '.ev.xfer.done{opacity:.58}',
      '.week-strip .day .ev.xfer{background:#E4F1EA!important;color:#276749!important;border-color:rgba(47,133,90,.24)!important}',
      '.detailItem.xfer{background:#F0F8F3!important;border-color:rgba(47,133,90,.22)!important}',
      '.detailItem.xfer .amt,.detailItem.xfer .dir,.detailItem.xfer .name{color:#276749!important}',
      '.mobile-sheet .detailItem.xfer{background:#F0F8F3!important;border-color:rgba(47,133,90,.22)!important}',
      '.ev.sweep{background:#F5EBDD!important;color:#7A4D16!important;border:1px solid rgba(192,86,33,.24)!important;outline:none!important}',
      '.ev.sweep span,.ev.sweep b{color:#7A4D16!important}',
      '.ev.sweep .dot{background:#C05621!important;box-shadow:0 0 0 2px rgba(192,86,33,.16)!important}',
      '.detailItem.sweep{background:#FBF4EA!important;border-color:rgba(192,86,33,.22)!important}',
      '.detailItem.sweep .amt,.detailItem.sweep .dir,.detailItem.sweep .name{color:#7A4D16!important}',
      'html[data-billsos-theme="dark"] .ev.xfer{background:rgba(38,74,52,.88)!important;color:#BFF2D4!important;border-color:rgba(104,211,145,.24)!important}',
      'html[data-billsos-theme="dark"] .ev.xfer span,html[data-billsos-theme="dark"] .ev.xfer b{color:#BFF2D4!important}',
      'html[data-billsos-theme="dark"] .detailItem.xfer{background:rgba(38,74,52,.66)!important;border-color:rgba(104,211,145,.22)!important}',
      'html[data-billsos-theme="dark"] .ev.sweep{background:rgba(70,50,28,.88)!important;color:#FFE1B2!important;border-color:rgba(246,173,85,.24)!important}',
      'html[data-billsos-theme="dark"] .ev.sweep span,html[data-billsos-theme="dark"] .ev.sweep b{color:#FFE1B2!important}',
      'html[data-billsos-theme="dark"] .detailItem.sweep{background:rgba(70,50,28,.66)!important;border-color:rgba(246,173,85,.22)!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function installAmountEditStyles() {
    if (document.getElementById('amountEditStyles')) return;
    const style = document.createElement('style');
    style.id = 'amountEditStyles';
    style.textContent = [
      '.day .ev,.day label.ev,.week-strip .ev,.week-strip label.ev{font-size:9px!important}',
      '.day .ev span,.day .ev b,.day .ev button,.day .ev small,.week-strip .ev span,.week-strip .ev b,.week-strip .ev button,.week-strip .ev small{font-size:9px!important}',
      '.day .ev:has(.amountEditBtn),.day label.ev:has(.amountEditBtn){display:grid!important;grid-template-columns:16px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:5px!important;row-gap:5px!important;align-items:start!important;min-height:66px!important;padding:7px!important}',
      '.day .ev:has(.amountEditBtn)>input[type="checkbox"],.day label.ev:has(.amountEditBtn)>input[type="checkbox"]{grid-column:1!important;grid-row:1!important}',
      '.day .ev:has(.amountEditBtn)>span,.day label.ev:has(.amountEditBtn)>span{grid-column:2!important;grid-row:1!important;display:-webkit-box!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;white-space:normal!important;overflow-wrap:anywhere!important;padding-right:18px!important;font-size:9px!important;font-weight:700!important;line-height:1.15!important}',
      '.day .ev:has(.amountEditBtn)>.amountEditBtn,.day label.ev:has(.amountEditBtn)>.amountEditBtn{grid-column:1 / -1!important;grid-row:2!important;justify-self:stretch!important;max-width:100%!important;text-align:left!important}',
      '.day .ev:has(.amountEditBtn)>.moveBtn,.day label.ev:has(.amountEditBtn)>.moveBtn{right:7px!important;top:7px!important;bottom:auto!important;width:18px!important;height:18px!important;min-width:18px!important;opacity:.42!important}',
      '.amountEditBtn{border:1px solid rgba(20,35,55,.12);background:rgba(255,255,255,.66);color:inherit;border-radius:8px;padding:4px 7px;font:inherit;font-size:9px;font-weight:800;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;box-shadow:none}',
      '.amountEditBtn:hover,.amountEditBtn:focus{background:#fff;border-color:rgba(31,58,61,.34);outline:none}',
      '.ev.amount-edited .amountEditBtn,.detailItem.amount-edited .amt{box-shadow:0 0 0 2px rgba(168,101,26,.13);border-color:rgba(168,101,26,.35)!important}',
      '.detailItem .amt.amountEditable{cursor:pointer;border:1px solid rgba(20,35,55,.12);border-radius:999px;padding:4px 7px;background:rgba(255,255,255,.72)}',
      '.amountEditPopover{position:fixed;z-index:80;width:min(270px,calc(100vw - 24px));background:#fff;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22);display:grid;gap:9px;color:#14202c}',
      '.amountEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}',
      '.amountEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800;color:#14202c}',
      '.amountEditPopover .amountEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '.amountEditPopover button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px 10px;font-size:12px;font-weight:900;color:#14202c;cursor:pointer}',
      '.amountEditPopover button.primary{background:#14202c;color:#fff;border-color:#14202c}',
      '.amountEditPopover button.clear{grid-column:1 / -1;color:#7A4D16;background:#FBF4EA;border-color:rgba(168,101,26,.24)}',
      '.amountEditPopover .amountEditMeta{font-size:11px;line-height:1.35;color:#5f6b7a}',
      'html[data-billsos-theme="dark"] .amountEditBtn{background:rgba(15,23,42,.65);border-color:rgba(226,232,240,.18)}',
      'html[data-billsos-theme="dark"] .amountEditPopover{background:#111827;color:#f8fafc;border-color:rgba(226,232,240,.16)}',
      'html[data-billsos-theme="dark"] .amountEditPopover input{background:#020617;color:#f8fafc;border-color:rgba(226,232,240,.18)}',
      'html[data-billsos-theme="dark"] .amountEditPopover button{background:#1f2937;color:#f8fafc;border-color:rgba(226,232,240,.16)}',
      'html[data-billsos-theme="dark"] .amountEditPopover button.primary{background:#f8fafc;color:#111827}',
      '@media (min-width:901px) and (max-width:2000px){.month-shell{grid-template-columns:minmax(0,1fr)!important}.resizeHandle{display:none!important}.drawer{position:static!important;grid-column:1!important;margin-top:12px!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function readSystemRules(data) {
    const row = (data.oneTimeEvents || []).find(function (item) { return item && item.id === RULE_ID; });
    if (!row || !row.notes) return {};
    try { return JSON.parse(row.notes) || {}; } catch (_err) { return {}; }
  }

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
    function push(day, name, amount, cls, type) {
      const n = Number(day || 0);
      if (n >= 1 && n <= dim) rows.push({ date: iso(month, n), day: n, name: name || 'Item', amount: Number(amount || 0), cls: cls || 'out', type: type || '' });
    }

    (data.bills || []).forEach(function (bill) {
      if (bill.active === false || (bill.frequency && bill.frequency !== 'monthly') || (bill.startMonth && bill.startMonth > monthKey) || (bill.endMonth && bill.endMonth < monthKey)) return;
      push(Math.min(Number(bill.dueDay || 1), dim), bill.name || 'Bill', -Math.abs(Number(bill.amount || 0)), 'out', bill.payMethod || bill.paymentMethod || bill.type);
    });
    (data.oneTimeEvents || []).forEach(function (item) {
      if (item.id === RULE_ID) return;
      oneDates(item, monthKey).forEach(function (date) {
        const amount = Number(item.amount || 0);
        const isIncome = item.type === 'income';
        const isTransfer = item.type === 'transfer';
        push(Number(date.slice(8, 10)), item.name || 'One-time item', isIncome ? Math.abs(amount) : -Math.abs(amount), isIncome ? 'in' : (isTransfer ? 'xfer' : 'out'), item.type);
      });
    });
    (data.income || []).forEach(function (income) {
      if (income.active === false) return;
      const amount = Math.abs(Number(income.amount || 0));
      const name = income.name || 'Income';
      const schedule = income.schedule || 'manual';
      if (schedule === 'semi-monthly-15-30') { push(15, name, amount, 'in', 'income'); push(Math.min(30, dim), name, amount, 'in', 'income'); }
      else if (schedule === 'biweekly') [1, 15, 29].forEach(function (day) { if (day <= dim) push(day, name, amount, 'in', 'income'); });
      else push(1, name, amount, 'in', 'income');
    });

    const rules = readSystemRules(data);
    const sweep = rules.sweep && typeof rules.sweep === 'object' ? rules.sweep : {};
    const targets = sweep.targets && typeof sweep.targets === 'object' && !Array.isArray(sweep.targets) ? sweep.targets : {};
    const target = targets[monthKey];
    if (sweep.enabled !== false && target && Number(target.amount) > 0) {
      const day = Math.min(dim, Math.max(1, Number(target.day || dim)));
      push(day, target.label || sweep.label || 'Sweep transfer', -Math.abs(Number(target.amount || 0)), 'sweep system', 'rule');
    }

    return rows.sort(function (a, b) { return a.date.localeCompare(b.date) || b.amount - a.amount; });
  }

  function effectiveRows(rows, month) {
    const monthKey = YEAR + '-' + String(month).padStart(2, '0');
    const amountAdjustments = readAmountAdjustments();
    let adjust = {};
    try { adjust = JSON.parse(localStorage.getItem('billsos-pay-adjust-v1') || '{}') || {}; } catch (_err) {}
    return rows.map(function (row) {
      const event = Object.assign({}, row);
      const key = rowKey(event);
      const move = adjust[key];
      const amountEdit = amountAdjustments[key];
      event.originalKey = key;
      event.originalDate = event.date;
      event.originalDay = event.day;
      if (amountEdit && Number.isFinite(Number(amountEdit.amount))) {
        event.originalAmount = event.amount;
        event.amount = (event.amount < 0 ? -1 : 1) * Math.abs(Number(amountEdit.amount));
        event.amountAdjusted = true;
      }
      if (move && move.date) { event.date = move.date; event.day = Number(move.date.slice(8, 10)); event.adjusted = move; }
      return event;
    }).filter(function (event) { return event.date.slice(0, 7) === monthKey; }).sort(function (a, b) { return a.date.localeCompare(b.date) || b.amount - a.amount; });
  }

  function buildModel(data) {
    const model = {};
    let balance = FIRST_BEGIN;
    MONTHS.forEach(function (monthDef) {
      let begin = balance;
      let rows = effectiveRows(generateRows(data, monthDef[1]), monthDef[1]);
      if (monthDef[0] === 'july') {
        begin = JULY_REBASE_END;
        rows = effectiveRows(generateRows(data, monthDef[1]), monthDef[1]).filter(function (row) { return row.day > JULY_REBASE_DAY; });
      }
      const income = rows.filter(function (row) { return row.amount > 0; }).reduce(function (sum, row) { return sum + row.amount; }, 0);
      const outflow = rows.filter(function (row) { return row.amount < 0; }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const sweep = rows.filter(function (row) { return row.amount < 0 && /sweep/i.test(row.name); }).reduce(function (sum, row) { return sum + Math.abs(row.amount); }, 0);
      const end = begin + income - outflow;
      model[monthDef[0]] = { month: monthDef, begin: begin, rows: rows, income: income, outflow: outflow, sweep: sweep, end: end, rebaseDay: monthDef[0] === 'july' ? JULY_REBASE_DAY : null, rebaseEnd: monthDef[0] === 'july' ? JULY_REBASE_END : null };
      balance = end;
    });
    return model;
  }

  function visibleMonthKey() {
    const title = text(document.querySelector('.monthHead h2')).toLowerCase();
    const found = MONTHS.find(function (month) { return title.indexOf(month[2].toLowerCase()) >= 0; });
    return found ? found[0] : null;
  }

  function selectedDayNode() {
    const selected = document.querySelector('.day.selected');
    if (selected && !selected.classList.contains('blank')) return selected;
    const title = text(document.getElementById('detailTitle'));
    const match = title.match(/Day\s+(\d+)/i);
    if (!match) return null;
    const day = Number(match[1]);
    return Array.from(document.querySelectorAll('.day:not(.blank)')).find(function (node) { return Number(text(node.querySelector('.topline b')) || 0) === day; }) || null;
  }

  function getDoneMap() { try { return JSON.parse(localStorage.getItem('billsos-generated-done-v5') || '{}') || {}; } catch (_err) { return {}; } }
  function dayNodeFor(day) { return Array.from(document.querySelectorAll('.day:not(.blank)')).find(function (node) { return Number(text(node.querySelector('.topline b')) || 0) === Number(day); }) || null; }

  function ensureSweepCalendarRows(current) {
    if (!current || !current.rows) return;
    const done = getDoneMap();
    document.querySelectorAll('[data-billsos-manual-sweep="1"]').forEach(function (node) { node.remove(); });
    current.rows.filter(function (row) { return row.amount < 0 && /sweep/i.test(row.name); }).forEach(function (row) {
      const key = row.originalKey || rowKey(row);
      if (document.querySelector('.day label.ev input[data-id="' + cssEscape(key) + '"]')) return;
      const day = dayNodeFor(row.day);
      const events = day && day.querySelector('.events');
      if (!events) return;
      const label = document.createElement('label');
      label.className = 'ev sweep system' + (done[key] ? ' done' : '');
      label.setAttribute('data-billsos-manual-sweep', '1');
      label.innerHTML = '<input type="checkbox" data-id="' + escAttr(key) + '"' + (done[key] ? ' checked' : '') + '><span>' + escAttr(row.name) + '</span><b>' + moneyCents(Math.abs(row.amount)) + '</b>';
      events.appendChild(label);
    });
  }

  function dedupeSweepRows() {
    document.querySelectorAll('.day:not(.blank)').forEach(function (day) {
      const sweeps = Array.from(day.querySelectorAll('.ev')).filter(function (row) { return /sweep/i.test(text(row)); });
      if (sweeps.length < 2) return;
      const keep = sweeps.find(function (row) { return !row.hasAttribute('data-billsos-sweep') && !row.hasAttribute('data-billsos-manual-sweep') && !row.classList.contains('system'); }) ||
        sweeps.find(function (row) { return !row.hasAttribute('data-billsos-sweep') && !row.hasAttribute('data-billsos-manual-sweep'); }) || sweeps[0];
      sweeps.forEach(function (row) { if (row !== keep) row.remove(); });
    });
  }

  let balanceSyncTimer = 0;
  let balanceSyncBusy = false;
  let transferColorTimer = 0;
  let transferColorBusy = false;
  let lastKnownData = null;

  function oneTimeTransferKeys(data) {
    const keys = new Set();
    MONTHS.forEach(function (monthDef) {
      const monthKey = YEAR + '-' + String(monthDef[1]).padStart(2, '0');
      (data.oneTimeEvents || []).forEach(function (item) {
        if (item.id === RULE_ID || item.type !== 'transfer') return;
        oneDates(item, monthKey).forEach(function (date) {
          const amount = -Math.abs(Number(item.amount || 0));
          keys.add(date + '|' + (item.name || 'One-time item') + '|' + amount);
        });
      });
    });
    return keys;
  }

  async function colorOneTimeTransfersFromData() {
    if (transferColorBusy) return;
    transferColorBusy = true;
    try {
      installOneTimeTransferStyles();
      const response = await fetch('/api/bills?transferColor=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      lastKnownData = data;
      const keys = oneTimeTransferKeys(data);
      document.querySelectorAll('.day label.ev input[data-id], .day .ev input[data-id]').forEach(function (input) {
        const row = input.closest('.ev');
        const dataId = input.getAttribute('data-id') || '';
        const isTransfer = keys.has(dataId);
        const isSweep = /sweep/i.test(dataId) || (row && /sweep/i.test(text(row)));
        if (!row) return;
        row.classList.toggle('xfer', isTransfer);
        row.classList.toggle('sweep', isSweep);
        if (isTransfer || isSweep) row.classList.remove('out');
      });
      document.querySelectorAll('#detailContent .detailItem[data-detail-id], .mobile-sheet .detailItem[data-detail-id]').forEach(function (item) {
        const key = item.getAttribute('data-detail-id') || '';
        item.classList.toggle('xfer', keys.has(key));
        item.classList.toggle('sweep', /sweep/i.test(key) || /sweep/i.test(text(item)));
      });
    } catch (_err) {
    } finally {
      transferColorBusy = false;
    }
  }

  function scheduleTransferColorSync() { window.clearTimeout(transferColorTimer); transferColorTimer = window.setTimeout(colorOneTimeTransfersFromData, 140); }

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
      lastKnownData = data;
      const model = buildModel(data || {});
      const current = model[monthKey];
      if (!current) return;
      ensureSweepCalendarRows(current);
      syncAmountEditors();

      const kbegin = document.getElementById('kbegin');
      const kin = document.getElementById('kin');
      const kout = document.getElementById('kout');
      const kend = document.getElementById('kend');
      const ksweep = document.getElementById('ksweep');
      if (kbegin) kbegin.textContent = money(current.begin);
      if (kin) kin.textContent = money(current.income);
      if (kout) kout.textContent = money(current.outflow);
      if (kend) kend.textContent = money(current.end);
      if (ksweep) ksweep.textContent = money(current.sweep || 0);

      const byDay = {};
      current.rows.forEach(function (row) { byDay[row.day] = (byDay[row.day] || 0) + row.amount; });
      let running = current.begin;
      mount.querySelectorAll('.day:not(.blank)').forEach(function (dayNode) {
        const dayNum = Number(text(dayNode.querySelector('.topline b')) || 0);
        if (!dayNum) return;
        const startNode = dayNode.querySelector('.topline span:last-child b');
        const endNode = dayNode.querySelector('.endline b');
        if (startNode) startNode.textContent = money(running);
        if (monthKey === 'july' && dayNum <= JULY_REBASE_DAY) {
          if (endNode) endNode.textContent = money(JULY_REBASE_END);
          running = JULY_REBASE_END;
          return;
        }
        running += Number(byDay[dayNum] || 0);
        if (endNode) endNode.textContent = money(running);
      });
    } catch (_err) {
    } finally {
      balanceSyncBusy = false;
    }
  }

  function scheduleBalanceSync() {
    window.clearTimeout(balanceSyncTimer);
    balanceSyncTimer = window.setTimeout(function () {
      if (typeof window.BillsOSRecalculateVisibleBalances === 'function') window.BillsOSRecalculateVisibleBalances();
    }, 120);
  }

  function removeCalendarCalculationOnlyRows() {
    document.querySelectorAll('.day label.ev, .day .ev').forEach(function (item) { if (isCalculationOnly(item)) item.remove(); });
  }

  function removeDrawerCalculationOnlyRows() {
    const detail = document.getElementById('detailContent');
    if (!detail) return;
    const items = Array.from(detail.querySelectorAll('.detailItem'));
    if (!items.length) return;
    let removed = false;
    items.forEach(function (item) { if (isCalculationOnly(item)) { item.remove(); removed = true; } });
    if (removed && !detail.querySelector('.detailItem')) { detail.className = 'detailEmpty'; detail.textContent = 'No visible actions on this day.'; }
  }

  function ensureSweepDrawerRows() {
    const node = selectedDayNode();
    const detail = document.getElementById('detailContent');
    if (!node || !detail || detail.classList.contains('detailEmpty')) return;
    node.querySelectorAll('.ev.sweep input[data-id]').forEach(function (input) {
      const key = input.getAttribute('data-id');
      if (!key || detail.querySelector('.detailItem[data-detail-id="' + cssEscape(key) + '"]')) return;
      const row = input.closest('.ev');
      const name = text(row.querySelector('span')) || 'Sweep transfer';
      const amount = adjustedSignedAmount(key);
      const item = document.createElement('div');
      item.className = 'detailItem sweep';
      item.setAttribute('data-detail-id', key);
      item.innerHTML = '<div class="dir out">−</div><div class="detailMain"><div class="name">' + escAttr(name) + '</div></div><div class="amt">' + escAttr(moneyCents(Math.abs(amount))) + '</div>';
      detail.appendChild(item);
    });
  }

  function shouldAllowAmountEdit(key, item) {
    if (!key || isCalculationOnly(item)) return false;
    const amount = amountFromKey(key);
    return amount < 0;
  }

  function syncCalendarAmountEditors() {
    const adjustments = readAmountAdjustments();
    document.querySelectorAll('.day label.ev input[data-id], .day .ev input[data-id]').forEach(function (input) {
      const row = input.closest('.ev');
      const key = input.getAttribute('data-id') || '';
      if (!row || !shouldAllowAmountEdit(key, row)) return;
      const amount = adjustedSignedAmount(key);
      let btn = row.querySelector('.amountEditBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'amountEditBtn';
        btn.setAttribute('aria-label', 'Edit amount');
        btn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          openAmountEditor(key, btn);
        });
        const move = row.querySelector('.moveBtn');
        if (move && move.parentNode === row) row.insertBefore(btn, move);
        else row.appendChild(btn);
      }
      btn.dataset.amountKey = key;
      const due = shortDueDate(key);
      const label = moneyCents(Math.abs(amount)) + (due ? '  ·  ' + due : '');
      if (btn.textContent !== label) btn.textContent = label;
      const nameNode = row.querySelector(':scope > span');
      const name = text(nameNode);
      if (nameNode) nameNode.title = name;
      btn.setAttribute('aria-label', 'Edit amount and due date for ' + name);
      row.classList.toggle('amount-edited', !!adjustments[key]);
      const existingAmount = row.querySelector('b:not(.ignoreAmount)');
      if (existingAmount && existingAmount !== btn) existingAmount.textContent = moneyCents(Math.abs(amount));
    });
  }

  function syncDrawerAmountEditors() {
    const adjustments = readAmountAdjustments();
    document.querySelectorAll('#detailContent .detailItem[data-detail-id], .mobile-sheet .detailItem[data-detail-id]').forEach(function (item) {
      const key = item.getAttribute('data-detail-id') || '';
      const amountNode = item.querySelector('.amt');
      if (!amountNode || !shouldAllowAmountEdit(key, item)) return;
      const amount = adjustedSignedAmount(key);
      amountNode.textContent = moneyCents(Math.abs(amount));
      amountNode.classList.add('amountEditable');
      amountNode.setAttribute('role', 'button');
      amountNode.setAttribute('tabindex', '0');
      amountNode.setAttribute('aria-label', 'Edit amount');
      amountNode.dataset.amountKey = key;
      item.classList.toggle('amount-edited', !!adjustments[key]);
    });
  }

  function syncAmountEditors() {
    installAmountEditStyles();
    syncCalendarAmountEditors();
    syncDrawerAmountEditors();
  }

  function closeAmountEditor() {
    const existing = document.querySelector('.amountEditPopover');
    if (existing) existing.remove();
  }

  function openAmountEditor(key, anchor) {
    if (!key || !anchor) return;
    closeAmountEditor();
    const base = Math.abs(amountFromKey(key));
    const current = Math.abs(adjustedSignedAmount(key));
    const popover = document.createElement('div');
    popover.className = 'amountEditPopover';
    popover.innerHTML =
      '<label>Amount</label>' +
      '<input inputmode="decimal" autocomplete="off" value="' + escAttr(current.toFixed(2)) + '">' +
      '<div class="amountEditActions">' +
      '<button type="button" class="primary" data-action="save">Save</button>' +
      '<button type="button" data-action="cancel">Cancel</button>' +
      (hasAmountAdjustment(key) ? '<button type="button" class="clear" data-action="clear">Reset to estimate</button>' : '') +
      '</div>' +
      '<div class="amountEditMeta">Original estimate: ' + escAttr(moneyCents(base)) + '</div>';
    document.body.appendChild(popover);

    const rect = anchor.getBoundingClientRect();
    const top = Math.min(window.innerHeight - popover.offsetHeight - 12, Math.max(12, rect.bottom + 8));
    const left = Math.min(window.innerWidth - popover.offsetWidth - 12, Math.max(12, rect.left));
    popover.style.top = top + 'px';
    popover.style.left = left + 'px';

    const input = popover.querySelector('input');
    const meta = popover.querySelector('.amountEditMeta');
    const save = function () {
      const next = parseMoney(input.value);
      if (!Number.isFinite(next) || next < 0) {
        meta.textContent = 'Enter a valid amount.';
        return;
      }
      if (!saveAmountAdjustment(key, next)) {
        meta.textContent = 'Amount could not be saved.';
        return;
      }
      closeAmountEditor();
      syncAmountEditors();
      scheduleBalanceSync();
      scheduleTransferColorSync();
      scheduleSync();
    };
    popover.addEventListener('click', function (event) {
      const action = event.target && event.target.getAttribute && event.target.getAttribute('data-action');
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'save') save();
      if (action === 'cancel') closeAmountEditor();
      if (action === 'clear') {
        const adjustments = readAmountAdjustments();
        delete adjustments[key];
        writeAmountAdjustments(adjustments);
        closeAmountEditor();
        syncAmountEditors();
        scheduleBalanceSync();
        scheduleTransferColorSync();
        scheduleSync();
      }
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); save(); }
      if (event.key === 'Escape') { event.preventDefault(); closeAmountEditor(); }
    });
    setTimeout(function () { input.focus(); input.select(); }, 0);
  }

  function drawerItems() {
    const detail = document.getElementById('detailContent');
    if (!detail) return [];
    return Array.from(detail.children).filter(function (child) { return child.classList && child.classList.contains('detailItem') && !isCalculationOnly(child); });
  }

  function insertDrawerNetSummary() {
    const detail = document.getElementById('detailContent');
    if (!detail) return;
    const existing = detail.querySelector('.drawerNetSummary');
    const items = drawerItems();
    if (!items.length) { if (existing) existing.remove(); return; }
    let inflow = 0;
    let outflow = 0;
    items.forEach(function (item) {
      const amount = absMoney(text(item.querySelector('.amt')));
      const direction = item.querySelector('.dir');
      if (direction && direction.classList.contains('in')) inflow += amount;
      else outflow += amount;
    });
    const net = inflow - outflow;
    const signature = [items.length, inflow, outflow, net].join('|');
    if (existing && existing.dataset.summarySignature === signature) return;
    const summary = existing || document.createElement('div');
    summary.className = 'drawerNetSummary';
    summary.dataset.summarySignature = signature;
    summary.style.cssText = 'display:grid;grid-template-columns:1fr;gap:7px;margin:0 0 10px;padding:10px 11px;border:1px solid rgba(31,58,61,.18);border-radius:14px;background:rgba(251,247,239,.9);font-size:12px';
    summary.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--mut);font-weight:800">Inflows</span><b style="color:var(--green)">' + money(inflow) + '</b></div>' + '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--mut);font-weight:800">Outflows</span><b style="color:var(--outflow)">' + money(outflow) + '</b></div>' + '<div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(20,35,55,.1);padding-top:7px"><span style="font-weight:900">Net</span><b style="font-size:13px">' + signedMoney(net) + '</b></div>';
    if (!existing) detail.insertBefore(summary, detail.firstChild);
  }

  function insertBalanceBridge() {
    const detail = document.getElementById('detailContent');
    if (!detail) return;
    const existing = detail.querySelector('.drawerBalanceBridge');
    const node = selectedDayNode();
    const first = document.querySelector('.day:not(.blank)');
    if (!node || !first) { if (existing) existing.remove(); return; }
    const monthStart = parseMoney(text(first.querySelector('.topline span:last-child b')));
    const dayStart = parseMoney(text(node.querySelector('.topline span:last-child b')));
    const dayEnd = parseMoney(text(node.querySelector('.endline b')));
    const beforeNet = dayStart - monthStart;
    const todayNet = dayEnd - dayStart;
    const throughNet = dayEnd - monthStart;
    const sig = [monthStart, beforeNet, todayNet, throughNet, dayEnd].join('|');
    if (existing && existing.dataset.bridgeSignature === sig) return;
    const bridge = existing || document.createElement('div');
    bridge.className = 'drawerBalanceBridge';
    bridge.dataset.bridgeSignature = sig;
    bridge.style.cssText = 'display:grid;gap:7px;margin:0 0 10px;padding:10px 11px;border:1px solid rgba(31,58,61,.18);border-radius:14px;background:#fff;font-size:12px';
    bridge.innerHTML = '<div style="font-weight:900;margin-bottom:1px">Balance bridge</div>' + '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--mut);font-weight:800">Anchor</span><b>' + money(monthStart) + '</b></div>' + '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--mut);font-weight:800">Before this day</span><b>' + signedMoney(beforeNet) + '</b></div>' + '<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--mut);font-weight:800">This day</span><b>' + signedMoney(todayNet) + '</b></div>' + '<div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(20,35,55,.1);padding-top:7px"><span style="font-weight:900">Ending balance</span><b>' + money(dayEnd) + '</b></div>';
    const after = detail.querySelector('.drawerNetSummary');
    if (!existing) detail.insertBefore(bridge, after ? after.nextSibling : detail.firstChild);
  }

  function syncDrawer() {
    dedupeSweepRows();
    scheduleBalanceSync();
    scheduleTransferColorSync();
    removeCalendarCalculationOnlyRows();
    removeDrawerCalculationOnlyRows();
    ensureSweepDrawerRows();
    syncAmountEditors();
    insertDrawerNetSummary();
    insertBalanceBridge();
    const items = document.querySelectorAll('#detailContent .detailItem');
    if (!items.length) return;
    items.forEach(function (item) {
      const key = item.getAttribute('data-detail-id');
      const match = key ? document.querySelector('.day label.ev input[data-id="' + cssEscape(key) + '"]') : null;
      const row = match ? match.closest('.ev') : null;
      const existing = item.querySelector(CHECKBOX_SELECTOR);
      const checked = !!(match && match.checked);
      if (row) {
        item.classList.toggle('xfer', row.classList.contains('xfer'));
        item.classList.toggle('sweep', row.classList.contains('sweep'));
      }
      if (!existing && match) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Mark complete');
        box.dataset.ddSync = '1';
        box.checked = checked;
        box.addEventListener('change', function () { if (!match || match.checked === box.checked) return; match.checked = box.checked; match.dispatchEvent(new Event('change', { bubbles: true })); });
        const main = item.querySelector('.detailMain');
        if (main && main.parentNode === item) item.insertBefore(box, main); else item.insertBefore(box, item.firstChild);
      } else if (existing) existing.checked = checked;
    });
  }

  let timer = 0;
  function scheduleSync() { window.clearTimeout(timer); timer = window.setTimeout(syncDrawer, 50); }

  document.addEventListener('click', function (event) {
    const amountTarget = event.target && event.target.closest && event.target.closest('.amountEditable');
    if (amountTarget && amountTarget.dataset.amountKey) {
      event.preventDefault();
      event.stopPropagation();
      openAmountEditor(amountTarget.dataset.amountKey, amountTarget);
      return;
    }
    if (event.target && event.target.closest && !event.target.closest('.amountEditPopover') && !event.target.closest('.amountEditBtn') && !event.target.closest('.amountEditable')) closeAmountEditor();
  }, true);
  document.addEventListener('keydown', function (event) {
    const target = event.target && event.target.closest && event.target.closest('.amountEditable');
    if (target && target.dataset.amountKey && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openAmountEditor(target.dataset.amountKey, target);
    }
  }, true);

  installCalmHouseholdTheme();
  installOneTimeTransferStyles();
  installAmountEditStyles();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener('load', function () { installCalmHouseholdTheme(); installOneTimeTransferStyles(); installAmountEditStyles(); scheduleSync(); scheduleBalanceSync(); scheduleTransferColorSync(); });
  window.addEventListener('hashchange', function () { scheduleSync(); scheduleBalanceSync(); scheduleTransferColorSync(); });
  document.addEventListener('click', function (event) { if (event.target && event.target.closest('#tabs button')) { closeAmountEditor(); scheduleBalanceSync(); scheduleTransferColorSync(); } });
  window.BillsOSAmountAdjustments = {
    read: readAmountAdjustments,
    save: saveAmountAdjustment,
    clear: function (key) { const adjustments = readAmountAdjustments(); delete adjustments[key]; writeAmountAdjustments(adjustments); scheduleSync(); scheduleBalanceSync(); }
  };
  scheduleSync();
  scheduleBalanceSync();
  scheduleTransferColorSync();
})();
