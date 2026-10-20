'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');

function harness(saved) {
  const elements = new Map(), values = new Map(saved ? [['bills-last-view-live', saved]] : []);
  const localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  function node(id) {
    const classes = new Set(), handlers = {};
    const item = { id, dataset: {}, hidden: false, disabled: false, value: '', textContent: '', attributes: {}, style: {},
      classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) },
      setAttribute(name, value) { this.attributes[name] = value; }, getAttribute(name) { return this.attributes[name]; },
      addEventListener(type, handler) { handlers[type] = handler; }, dispatch(type, event) { if (handlers[type]) handlers[type](event); },
      click() { if (!this.disabled && this.onclick) this.onclick(); }, focus() { document.focused = this; },
      matches: selector => selector === '[data-month-id]' && !!item.dataset.monthId,
      getBoundingClientRect: () => ({ left: 30, right: 350, top: 150, bottom: 190, width: 320, height: 290 }),
      querySelector: () => null, querySelectorAll: () => []
    };
    elements.set(id, item);
    return item;
  }
  const document = { focused: null, getElementById: id => elements.get(id) || null,
    querySelectorAll(selector) {
      if (selector.includes('[data-picker-year]')) return grids;
      if (selector.includes('[data-month-id]')) return buttons;
      return [];
    }
  };
  ['mount','tabs','monthNavPrev','monthNavNext','monthNavToday','monthNavChoose','monthNavLabel','monthPickerYear','monthPickerClose'].forEach(node);
  const picker = node('monthPicker');
  picker.showModal = () => { picker.open = true; };
  picker.close = () => { picker.open = false; picker.dispatch('close'); };
  picker.querySelector = () => buttons.find(button => button.getAttribute('aria-pressed') === 'true');
  const grids = [], buttons = [];
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [2026, 9, 20, 12])); } }
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]
    .replace('bindRiskFloor();\nload();', 'window.testNav={months,shortIds,monthNavigatorHtml,bindMonthNavigator,showMonth,startMonth,currentMonthId};');
  const window = {};
  new Function('document','localStorage','window','Date','innerWidth','innerHeight',script)(document,localStorage,window,FixedDate,390,844);
  const api = window.testNav;
  [2026,2027].forEach(year => {
    const grid = node('grid-' + year); grid.dataset.pickerYear = String(year);
    grid.querySelectorAll = () => buttons.filter(button => Number(button.dataset.year) === year);
    grids.push(grid);
  });
  api.months.forEach(month => {
    const id = api.shortIds[month[0]], button = node('btn-' + id);
    button.dataset.monthId = id; button.dataset.year = month[3];
    button.closest = () => grids.find(grid => Number(grid.dataset.pickerYear) === month[3]);
    buttons.push(button); node('panel-' + id);
  });
  api.bindMonthNavigator();
  api.showMonth(api.startMonth());
  return { api, elements, values, document, picker, grids, buttons };
}

test('compact month picker keeps twelve slots per year and all available Home link targets', () => {
  const h = harness(), markup = h.api.monthNavigatorHtml();
  assert.equal((markup.match(/data-picker-year=/g) || []).length, 2);
  assert.equal((markup.match(/aria-label="[A-Z][a-z]+ 202[67]"/g) || []).length, 24);
  assert.equal((markup.match(/ disabled/g) || []).length, 5);
  h.api.months.forEach(month => assert.ok(markup.includes('id="btn-' + h.api.shortIds[month[0]] + '"')));
  assert.match(markup, /aria-haspopup="dialog"/);
  assert.match(markup, /id="monthNavToday"/);
  assert.doesNotMatch(markup, /year-pill|past-months-toggle/);
});

test('previous and next cross December and January and stop at the available range', () => {
  const h = harness(), el = id => h.elements.get(id);
  h.api.showMonth('dec'); el('monthNavNext').click();
  assert.equal(el('monthNavLabel').textContent, 'January 2027');
  assert.equal(h.values.get('bills-last-view-live'), 'jan-2027');
  el('monthNavPrev').click();
  assert.equal(el('monthNavLabel').textContent, 'December 2026');
  h.api.showMonth('june'); assert.equal(el('monthNavPrev').disabled, true);
  h.api.showMonth('dec-2027'); assert.equal(el('monthNavNext').disabled, true);
  assert.equal([...h.elements.values()].filter(item => item.id.startsWith('panel-') && item.classList.contains('show')).length, 1);
});

test('picker changes year, selects a month, and returns focus to its trigger', () => {
  const h = harness(), el = id => h.elements.get(id);
  el('monthNavChoose').click();
  assert.equal(h.picker.open, true);
  assert.equal(h.document.focused.id, 'btn-oct');
  el('monthPickerYear').value = '2027'; el('monthPickerYear').onchange();
  assert.equal(h.grids.find(grid => grid.dataset.pickerYear === '2026').hidden, true);
  assert.equal(h.grids.find(grid => grid.dataset.pickerYear === '2027').hidden, false);
  el('btn-mar-2027').click();
  assert.equal(el('monthNavLabel').textContent, 'March 2027');
  assert.equal(h.picker.open, false);
  assert.equal(el('monthNavChoose').getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.focused.id, 'monthNavChoose');
});

test('Today and Home month targets update the visible calendar and its heading together', () => {
  const h = harness(), el = id => h.elements.get(id);
  el('btn-jan-2027').click();
  assert.equal(el('panel-jan-2027').classList.contains('show'), true);
  assert.equal(el('monthNavLabel').textContent, 'January 2027');
  el('monthNavToday').click();
  assert.equal(el('monthNavLabel').textContent, 'October 2026');
  assert.equal(el('panel-oct').classList.contains('show'), true);
});

test('picker arrow keys move focus within the displayed year', () => {
  const h = harness(), el = id => h.elements.get(id);
  h.picker.dispatch('keydown', { target: el('btn-oct'), key: 'ArrowRight', preventDefault() {} });
  assert.equal(h.document.focused.id, 'btn-nov');
});
