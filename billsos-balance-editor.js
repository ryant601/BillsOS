(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BillsOSBalanceEditor = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function cents(value) { return Math.round(Number(value || 0) * 100) / 100; }
  function adjustmentFor(current, requested, existing) {
    return cents(Number(existing || 0) + Number(requested || 0) - Number(current || 0));
  }
  function parseMoney(value) {
    const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(number) ? number : 0;
  }
  function money(value) {
    return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function signedMoney(value) { return (value < 0 ? '−' : '+') + money(Math.abs(value)); }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]; }); }
  function monthNumber(panel) {
    const names = { june: '06', july: '07', aug: '08', august: '08', sep: '09', september: '09', oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12', 'jan-2027': '01', 'feb-2027': '02', 'mar-2027': '03', 'apr-2027': '04', 'may-2027': '05', 'jun-2027': '06', 'jul-2027': '07', 'aug-2027': '08', 'sep-2027': '09', 'oct-2027': '10', 'nov-2027': '11', 'dec-2027': '12' };
    const id = String(panel && panel.id || '').replace(/^panel-/, '').toLowerCase();
    if (names[id]) return names[id];
    const title = String(panel && panel.querySelector('h1,h2') && panel.querySelector('h1,h2').textContent || '').toLowerCase();
    return Object.keys(names).find(function (name) { return title.indexOf(name) >= 0; }) ? names[Object.keys(names).find(function (name) { return title.indexOf(name) >= 0; })] : '';
  }
  function dayDate(day) {
    if (day && /^20\d{2}-\d{2}-\d{2}$/.test(String(day.dataset.date || ''))) return day.dataset.date;
    const panel = day.closest('.month-panel');
    const mm = monthNumber(panel);
    const numberNode = day.querySelector('.dnum') || day.querySelector('.topline > b') || day.querySelector('.topline b');
    const dd = Number(day.dataset.day || (numberNode && numberNode.textContent) || 0);
    const year = Number(panel && panel.dataset.year) || 2026;
    return mm && dd ? year + '-' + mm + '-' + String(dd).padStart(2, '0') : '';
  }
  function balanceNodes(day) {
    return {
      beginning: day.querySelector('.calendar-day-beginning b') || day.querySelector('.bod b') || day.querySelector('.topline span:last-child b'),
      ending: day.querySelector('.calendar-day-ending b') || day.querySelector('.eod b') || day.querySelector('.endline b')
    };
  }
  function eventId(date, kind) { return 'balance-' + kind + '-' + date; }
  function existingEvent(data, date, kind) {
    return (Array.isArray(data && data.oneTimeEvents) ? data.oneTimeEvents : []).find(function (row) { return row && row.id === eventId(date, kind); });
  }
  function installStyles() {
    if (document.getElementById('billsosBalanceEditorStyles')) return;
    const style = document.createElement('style');
    style.id = 'billsosBalanceEditorStyles';
    style.textContent = '.billsosBalanceTarget{cursor:pointer;border-radius:7px;padding:2px 4px;margin:-2px -4px;transition:background .15s,box-shadow .15s}.billsosBalanceTarget:hover,.billsosBalanceTarget:focus-visible{background:rgba(47,112,72,.10);box-shadow:0 0 0 2px rgba(47,112,72,.12);outline:none}.billsosBalanceTarget::after{content:" ✎";font-size:.72em;opacity:.48}.bb-scrim{position:fixed;inset:0;z-index:1200;background:rgba(20,32,25,.34);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;padding:14px}.bb-sheet{width:min(430px,100%);background:#fff;color:#18231d;border-radius:22px;padding:20px;box-shadow:0 24px 70px rgba(20,32,25,.25)}.bb-sheet h2{margin:0;font-size:21px;letter-spacing:-.03em}.bb-date{margin:4px 0 18px;color:#6d786f;font-size:12px}.bb-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.bb-stat{padding:11px 8px;border:1px solid #dde5dc;border-radius:12px;background:#f7f9f5;min-width:0}.bb-stat span{display:block;color:#6d786f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.bb-stat strong{display:block;margin-top:5px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bb-sheet label{display:block;font-size:11px;font-weight:800;color:#526058}.bb-input{box-sizing:border-box;width:100%;margin-top:6px;border:1px solid #cfd9cf;border-radius:13px;padding:13px 14px;font:inherit;font-size:18px;font-weight:800}.bb-preview{margin:12px 0;padding:11px 12px;border-radius:12px;background:#eaf2e8;color:#315a3d;font-size:12px;line-height:1.45}.bb-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.bb-actions button{border:1px solid #d8e1d8;border-radius:999px;background:#fff;padding:12px;font:inherit;font-weight:800;cursor:pointer}.bb-actions .primary{border-color:transparent;background:#397650;color:#fff}.bb-actions button:disabled{opacity:.55;cursor:wait}.bb-error{min-height:18px;margin-top:8px;color:#a43d35;font-size:11px}@media(min-width:700px){.bb-scrim{align-items:center}.bb-sheet{border-radius:20px}}';
    document.head.appendChild(style);
  }
  function markTargets() {
    document.querySelectorAll('.calendar-day,.day:not(.blank)').forEach(function (day) {
      const nodes = balanceNodes(day);
      Object.keys(nodes).forEach(function (kind) {
        const node = nodes[kind];
        if (!node) return;
        node.classList.add('billsosBalanceTarget');
        node.dataset.balanceKind = kind;
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', 'Edit ' + kind + ' balance');
      });
    });
  }
  async function openEditor(target) {
    const day = target.closest('.calendar-day,.day');
    const date = dayDate(day);
    const kind = target.dataset.balanceKind;
    if (!date || !kind || document.querySelector('.bb-scrim')) return;
    const nodes = balanceNodes(day);
    const current = parseMoney(nodes[kind] && nodes[kind].textContent);
    const currentEnding = parseMoney(nodes.ending && nodes.ending.textContent);
    const panel = day.closest('.month-panel');
    const monthEndNode = panel && (panel.querySelector('#kend') || Array.from(panel.querySelectorAll('.calendar-day .calendar-day-ending b,.day:not(.blank) .eod b,.day:not(.blank) .endline b')).pop());
    const monthEnd = panel && Number.isFinite(Number(panel.dataset.monthEnding)) ? Number(panel.dataset.monthEnding) : parseMoney(monthEndNode && monthEndNode.textContent);
    let data;
    try {
      const response = await fetch('/api/bills?balanceEditor=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not load balances');
      data = await response.json();
    } catch (error) { alert(error.message || 'Could not open balance editor.'); return; }
    const prior = existingEvent(data, date, kind);
    const existing = Number(prior && prior.amount || 0);
    const scrim = document.createElement('div');
    scrim.className = 'bb-scrim';
    scrim.innerHTML = '<section class="bb-sheet" role="dialog" aria-modal="true" aria-labelledby="bbTitle"><h2 id="bbTitle">Edit ' + (kind === 'beginning' ? 'Beginning' : 'Ending') + ' Balance</h2><div class="bb-date">' + escapeHtml(new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })) + '</div><label>New balance<input class="bb-input" inputmode="decimal" type="number" step="0.01" value="' + current.toFixed(2) + '"></label><div class="bb-grid"><div class="bb-stat"><span>Current</span><strong data-current>' + money(current) + '</strong></div><div class="bb-stat"><span>New</span><strong data-new>' + money(current) + '</strong></div><div class="bb-stat"><span>Adjustment</span><strong data-adjustment>+$0.00</strong></div></div><div class="bb-preview" data-preview></div><div class="bb-error" role="alert"></div><div class="bb-actions"><button type="button" data-action="cancel">Cancel</button><button type="button" class="primary" data-action="save">Save</button></div></section>';
    document.body.appendChild(scrim);
    const input = scrim.querySelector('.bb-input');
    const save = scrim.querySelector('[data-action="save"]');
    function close() { scrim.remove(); }
    function update() {
      const requested = input.value.trim() === '' ? NaN : Number(input.value);
      const delta = Number.isFinite(requested) ? cents(requested - current) : 0;
      const adjustment = adjustmentFor(current, requested, existing);
      scrim.querySelector('[data-new]').textContent = Number.isFinite(requested) ? money(requested) : '—';
      scrim.querySelector('[data-adjustment]').textContent = signedMoney(adjustment);
      scrim.querySelector('[data-preview]').textContent = kind === 'beginning'
        ? 'This day will start at ' + money(requested) + '. Its ending balance becomes ' + money(currentEnding + delta) + (panel ? ', and the visible month ends at ' + money(monthEnd + delta) : '') + '. Earlier dates will not change.'
        : 'An explicit reconciliation of ' + signedMoney(adjustment) + ' will be recorded on this day. Later balances will update immediately.';
      save.disabled = !Number.isFinite(requested);
      return { requested: requested, adjustment: adjustment };
    }
    input.addEventListener('input', update);
    scrim.addEventListener('keydown', function (event) { if (event.key === 'Escape') close(); });
    scrim.addEventListener('click', async function (event) {
      if (event.target === scrim || event.target.dataset.action === 'cancel') return close();
      if (event.target.dataset.action !== 'save') return;
      const values = update();
      if (!Number.isFinite(values.requested)) return;
      save.disabled = true; save.textContent = 'Saving…';
      const rows = Array.isArray(data.oneTimeEvents) ? data.oneTimeEvents : [];
      const id = eventId(date, kind);
      const index = rows.findIndex(function (row) { return row && row.id === id; });
      const now = new Date().toISOString();
      const record = { id: id, name: kind === 'beginning' ? 'Beginning balance adjustment' : 'Ending balance reconciliation', date: date, amount: values.adjustment, type: kind === 'beginning' ? 'balance-opening-adjustment' : 'adjustment', correctionDirection: values.adjustment < 0 ? 'subtract' : 'add', notes: 'Explicit ' + kind + ' balance adjustment. Requested balance ' + money(values.requested) + '. Saved ' + now + '.', updatedAt: now };
      if (Math.abs(values.adjustment) < 0.005) { if (index >= 0) rows.splice(index, 1); }
      else if (index >= 0) rows[index] = record;
      else rows.push(record);
      data.oneTimeEvents = rows;
      try {
        const response = await fetch('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) });
        if (!response.ok) throw new Error('Could not save adjustment');
        location.reload();
      } catch (error) {
        scrim.querySelector('.bb-error').textContent = error.message || 'Could not save. Please try again.';
        save.disabled = false; save.textContent = 'Save';
      }
    });
    update(); input.focus(); input.select();
  }
  function install() {
    if (typeof document === 'undefined') return;
    installStyles(); markTargets();
    const observer = new MutationObserver(function () { markTargets(); });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', function (event) { const target = event.target.closest && event.target.closest('.billsosBalanceTarget'); if (target) { event.preventDefault(); event.stopPropagation(); openEditor(target); } }, true);
    document.addEventListener('keydown', function (event) { const target = event.target.closest && event.target.closest('.billsosBalanceTarget'); if (target && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEditor(target); } });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }
  return { adjustmentFor: adjustmentFor, parseMoney: parseMoney, eventId: eventId };
});
