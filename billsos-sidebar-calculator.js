(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BillsOSCalculator = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function round(value) { return Math.round((Number(value) + Number.EPSILON) * 100000000) / 100000000; }
  function operate(left, operator, right) {
    const a = Number(left), b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
    if (operator === '+') return round(a + b);
    if (operator === '−') return round(a - b);
    if (operator === '×') return round(a * b);
    if (operator === '÷') return b === 0 ? NaN : round(a / b);
    return b;
  }
  function createCalculator() {
    let display = '0', stored = null, operator = null, replace = false, expression = '';
    function value() { return Number(display); }
    function result() { return { display: display, expression: expression, operator: operator }; }
    function clear() { display = '0'; stored = null; operator = null; replace = false; expression = ''; return result(); }
    function press(key) {
      if (/^\d$/.test(key)) {
        display = replace || display === '0' || display === 'Error' ? key : display + key;
        replace = false;
      } else if (key === '.') {
        if (replace || display === 'Error') { display = '0.'; replace = false; }
        else if (display.indexOf('.') < 0) display += '.';
      } else if (key === 'C') return clear();
      else if (key === '⌫') {
        display = replace || display === 'Error' || display.length <= 1 ? '0' : display.slice(0, -1);
        replace = false;
      } else if (['+', '−', '×', '÷'].indexOf(key) >= 0) {
        if (operator && !replace) {
          const computed = operate(stored, operator, value());
          if (!Number.isFinite(computed)) { display = 'Error'; stored = null; operator = null; expression = 'Cannot divide by zero'; replace = true; return result(); }
          display = String(computed); stored = computed;
        } else stored = value();
        operator = key; expression = display + ' ' + key; replace = true;
      } else if (key === '=') {
        if (!operator || display === 'Error') return result();
        const right = value(), computed = operate(stored, operator, right);
        expression = String(stored) + ' ' + operator + ' ' + String(right) + ' =';
        display = Number.isFinite(computed) ? String(computed) : 'Error';
        stored = Number.isFinite(computed) ? computed : null; operator = null; replace = true;
      }
      return result();
    }
    return { press: press, result: result, clear: clear };
  }

  function installStyles() {
    if (document.getElementById('billsosCalculatorCss')) return;
    const style = document.createElement('style');
    style.id = 'billsosCalculatorCss';
    style.textContent = '.bo-sidebar{overflow-y:auto;overscroll-behavior:contain}.bo-calculator{flex:0 0 auto;margin:9px 0 0;border:1px solid var(--bo-line,#dde5dc);border-radius:13px;background:rgba(255,255,255,.72);overflow:hidden}.bo-calc-heading{display:flex;align-items:center;gap:11px;min-height:40px;padding:9px 13px 5px;color:var(--bo-ink,#18231d);font-size:13px;font-weight:700}.bo-calc-heading .bo-icon{width:24px}.bo-calc-body{display:block;padding:4px 9px 10px}.bo-calc-screen{min-height:58px;margin-bottom:8px;padding:8px 10px;border:1px solid var(--bo-line,#dde5dc);border-radius:10px;background:var(--bo-card,#fff);text-align:right;overflow:hidden}.bo-calc-expression{height:15px;color:var(--bo-muted,#6d786f);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bo-calc-value{margin-top:3px;color:var(--bo-ink,#18231d);font-size:21px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:auto}.bo-calc-keys{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.bo-calc-key{min-width:0;min-height:38px;border:1px solid var(--bo-line,#dde5dc);border-radius:9px;background:var(--bo-card,#fff);color:var(--bo-ink,#18231d);font:inherit;font-size:13px;font-weight:750;cursor:pointer}.bo-calc-key:hover{background:var(--bo-soft,#e8f1e7)}.bo-calc-key.operator{color:var(--bo-green,#2f7048);background:var(--bo-soft,#e8f1e7)}.bo-calc-key.equals{background:linear-gradient(135deg,var(--bo-green,#2f7048),var(--bo-green2,#5c916a));border-color:transparent;color:#fff}.bo-calc-key.wide{grid-column:span 2}@media(max-width:760px){.bo-calculator{margin-top:10px}.bo-calc-key{min-height:44px;font-size:15px}}html[data-billsos-theme="dark"] .bo-calculator{background:#1b2025!important;border-color:#30383d!important}html[data-billsos-theme="dark"] .bo-calc-heading,html[data-billsos-theme="dark"] .bo-calc-value{color:#f2f4f3!important}html[data-billsos-theme="dark"] .bo-calc-screen,html[data-billsos-theme="dark"] .bo-calc-key{background:#20252a!important;border-color:#343c41!important;color:#f2f4f3!important}html[data-billsos-theme="dark"] .bo-calc-key.operator{background:#25362c!important;color:#9bd0aa!important}';
    document.head.appendChild(style);
  }
  function mount() {
    if (document.getElementById('billsosSidebarCalculator')) return true;
    const nav = document.querySelector('.bo-nav');
    if (!nav) return false;
    const widget = document.createElement('section');
    widget.id = 'billsosSidebarCalculator'; widget.className = 'bo-calculator';
    widget.innerHTML = '<div class="bo-calc-heading"><span class="bo-icon">±</span><span>Calculator</span></div><div class="bo-calc-body"><div class="bo-calc-screen" aria-live="polite"><div class="bo-calc-expression"></div><div class="bo-calc-value">0</div></div><div class="bo-calc-keys">' + ['C','⌫','÷','×','7','8','9','−','4','5','6','+','1','2','3','=','0','.'].map(function (key) { return '<button type="button" class="bo-calc-key ' + (['+','−','×','÷'].indexOf(key)>=0?'operator ':'') + (key==='='?'equals ':'') + (key==='0'?'wide':'') + '" data-calc-key="' + key + '">' + key + '</button>'; }).join('') + '</div></div>';
    nav.appendChild(widget);
    const calculator = createCalculator();
    function render(state) { widget.querySelector('.bo-calc-expression').textContent = state.expression; widget.querySelector('.bo-calc-value').textContent = state.display; }
    widget.querySelectorAll('[data-calc-key]').forEach(function (button) { button.onclick = function () { render(calculator.press(button.dataset.calcKey)); }; });
    return true;
  }
  function install() {
    installStyles();
    if (!mount()) { setTimeout(mount, 250); setTimeout(mount, 900); }
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install(); }
  return { operate: operate, createCalculator: createCalculator };
});
