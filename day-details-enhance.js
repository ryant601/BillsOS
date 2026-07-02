(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260702mobile1';
  const MOBILE_FIT_HREF = '/mobile-fit.css?v=20260702fit3';
  const ACTION_LOG_LABEL = 'billsos action log';
  const BALANCE_CORRECTION_LABEL = 'balance correction';
  const SPENDING_FUNDING_LABEL = 'spending account funding';
  const SWEEP_LABEL = 'sweep';
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
  function isAutoSweep(item) { return normalizedText(item).indexOf(SWEEP_LABEL) >= 0; }
  function isCalculationOnly(item) { return isActionLogMeta(item) || isBalanceCorrection(item) || isAutoSpendingFunding(item) || isAutoSweep(item); }
  function money(value) { return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
  function signedMoney(value) { const n = Number(value || 0); return (n < 0 ? '−' : '+') + money(Math.abs(n)); }
  function parseMoney(value) { const n = Number(String(value || '').replace(/[−–—]/g, '-').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
  function absMoney(value) { return Math.abs(parseMoney(value)); }
  function days(month) { return new Date(YEAR, month, 0).getDate(); }
  function iso(month, day) { return YEAR + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
  function rowKey(event) { return (event.originalDate || event.date) + '|' + event.name + '|' + event.amount; }

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
        push(Number(date.slice(8, 10)), item.name || 'One-time item', isIncome ? Math.abs(amount) : -Math.abs(amount), isIncome ? 'in' : 'out', item.type);
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
      const end = begin + income - outflow;
      model[monthDef[0]] = { month: monthDef, begin: begin, rows: rows, income: income, outflow: outflow, end: end, rebaseDay: monthDef[0] === 'july' ? JULY_REBASE_DAY : null, rebaseEnd: monthDef[0] === 'july' ? JULY_REBASE_END : null };
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

      const kbegin = document.getElementById('kbegin');
      const kin = document.getElementById('kin');
      const kout = document.getElementById('kout');
      const kend = document.getElementById('kend');
      const ksweep = document.getElementById('ksweep');
      if (kbegin) kbegin.textContent = money(current.begin);
      if (kin) kin.textContent = money(current.income);
      if (kout) kout.textContent = money(current.outflow);
      if (kend) kend.textContent = money(current.end);
      if (ksweep) ksweep.textContent = money(0);

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
      // Leave rendered balances untouched if saved data cannot be read.
    } finally {
      balanceSyncBusy = false;
    }
  }

  function scheduleBalanceSync() { window.clearTimeout(balanceSyncTimer); balanceSyncTimer = window.setTimeout(syncVisibleBalancesFromData, 120); }

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

  function selectedDayNode() {
    const selected = document.querySelector('.day.selected');
    if (selected && !selected.classList.contains('blank')) return selected;
    const title = text(document.getElementById('detailTitle'));
    const match = title.match(/Day\s+(\d+)/i);
    if (!match) return null;
    const day = Number(match[1]);
    return Array.from(document.querySelectorAll('.day:not(.blank)')).find(function (node) { return Number(text(node.querySelector('.topline b')) || 0) === day; }) || null;
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
    scheduleBalanceSync();
    removeCalendarCalculationOnlyRows();
    removeDrawerCalculationOnlyRows();
    insertDrawerNetSummary();
    insertBalanceBridge();
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
        box.addEventListener('change', function () { if (!match || match.checked === box.checked) return; match.checked = box.checked; match.dispatchEvent(new Event('change', { bubbles: true })); });
        const main = item.querySelector('.detailMain');
        if (main && main.parentNode === item) item.insertBefore(box, main); else item.insertBefore(box, item.firstChild);
      } else if (existing) existing.checked = checked;
    });
  }

  let timer = 0;
  function scheduleSync() { window.clearTimeout(timer); timer = window.setTimeout(syncDrawer, 50); }

  installCalmHouseholdTheme();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener('load', function () { installCalmHouseholdTheme(); scheduleSync(); scheduleBalanceSync(); });
  window.addEventListener('hashchange', function () { scheduleSync(); scheduleBalanceSync(); });
  document.addEventListener('click', function (event) { if (event.target && event.target.closest('#tabs button')) { scheduleBalanceSync(); } });
  scheduleSync();
  scheduleBalanceSync();
})();