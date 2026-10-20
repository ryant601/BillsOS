'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const list = require('../calendar-list-view.js');

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }

test('monthly list computes every daily balance and keeps risk days visible', () => {
  const summary = list.buildMonth([
    { day: 2, iso: '2026-09-02', amount: -900, name: 'Mortgage part 1' },
    { day: 16, iso: '2026-09-16', amount: 500, name: 'Paycheck' },
    { day: 20, iso: '2026-09-20', amount: -200, name: 'Mortgage part 2' }
  ], 2026, 9, 500, { warning: 300, today: '2026-09-20' });

  assert.equal(summary.days.length, 30);
  assert.equal(summary.ending, -100);
  assert.equal(summary.lowestBalance, -400);
  assert.equal(summary.lowestDate, '2026-09-02');
  assert.equal(summary.negativeDays, 25);
  assert.ok(summary.days.find(day => day.date === '2026-09-03').visible, 'empty negative days remain visible');
  assert.ok(summary.days.find(day => day.date === '2026-09-30').visible, 'month end remains visible');
});

test('negative and current weeks expand by default while healthy weeks stay compact', () => {
  const negative = list.buildMonth([{ day: 2, amount: -600 }], 2026, 9, 500, { today: '2026-09-20' });
  const riskWeek = negative.weeks.find(week => week.negativeDays > 0 && !week.hasToday);
  const todayWeek = negative.weeks.find(week => week.hasToday);
  assert.equal(riskWeek.defaultExpanded, true);
  assert.equal(todayWeek.defaultExpanded, true);

  const healthy = list.buildMonth([{ day: 2, amount: -10 }], 2026, 9, 5000, { today: '2026-10-01' });
  assert.ok(healthy.weeks.every(week => week.defaultExpanded === false));
  assert.equal(list.STORAGE_KEY, 'billsos-list-weeks-v1');
});

test('show and hide all weeks persists the active month and follows individual toggles', () => {
  const previousStorage = global.localStorage;
  const saved = new Map();
  global.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  try {
    const panel = { querySelector: selector => selector === '.calendar-all-weeks' ? bulk : null,
      querySelectorAll: selector => selector === '.calendar-week' ? weeks : [] };
    const bulk = { textContent: 'Show all weeks', dataset: {}, closest: () => panel,
      addEventListener: (_type, handler) => { bulk.click = handler; } };
    function week(id, fallback) {
      const toggle = { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; }, addEventListener(_type, handler) { this.click = handler; },
        querySelector: () => action };
      const action = { textContent: '' }, body = { hidden: true };
      return { id, dataset: { defaultExpanded: fallback ? 'true' : 'false' }, closest: () => panel,
        classList: { toggle() {} }, querySelector: selector => selector === '.calendar-week-toggle' ? toggle : body,
        toggle, body };
    }
    const weeks = [week('week-2026-10-1', false), week('week-2026-10-2', true)];
    const scope = { querySelectorAll: selector => selector === '.calendar-week' ? weeks :
      selector === '.calendar-all-weeks' ? [bulk] : [] };
    list.bind(scope);
    assert.equal(bulk.textContent, 'Show all weeks');
    bulk.click();
    assert.ok(weeks.every(item => !item.body.hidden));
    assert.equal(bulk.textContent, 'Hide all weeks');
    assert.deepEqual(JSON.parse(saved.get(list.STORAGE_KEY)), { 'week-2026-10-1': true, 'week-2026-10-2': true });
    weeks[0].toggle.click();
    assert.equal(bulk.textContent, 'Show all weeks');
    bulk.click();
    bulk.click();
    assert.ok(weeks.every(item => item.body.hidden));
    assert.deepEqual(JSON.parse(saved.get(list.STORAGE_KEY)), { 'week-2026-10-1': false, 'week-2026-10-2': false });
  } finally { global.localStorage = previousStorage; }
});

test('active calendar renders a list with persistent week controls and risk line of sight', () => {
  const html = read('generated-v5.html');
  const css = read('calendar-list-view.css');
  const editor = read('billsos-card-editor.js');
  const preload = read('cache-coherence-preload.js');

  assert.match(html, /calendar-list-view\.css\?v=20261001navydash1/);
  assert.match(html, /calendar-list-view\.js\?v=20261001navydash1/);
  assert.match(html, /class="calendar-list"/);
  assert.match(html, /class="calendar-all-weeks"/);
  assert.match(html, /data-calendar-view="calendar"/);
  assert.match(html, /week\.days\.map\(dayHtml\)/);
  assert.match(html, /BillsOSCalendarList\.bindView\(mount\)/);
  assert.match(css, /\.calendar-box-mode \.calendar-week-body/);
  assert.match(css, /\.calendar-day\.is-quiet\{display:none\}/);
  assert.equal(list.VIEW_KEY, 'billsos-calendar-view-v1');
  assert.match(html, /negative projected day/);
  assert.match(html, /Lowest/);
  assert.match(html, /data-month-ending/);
  assert.doesNotMatch(html, /<div class="grid">/);
  assert.match(css, /\.calendar-week\.has-negative/);
  assert.match(css, /\.calendar-week-body\[hidden\]/);
  assert.match(editor, /closest\('\.calendar-day,\.day'\)/);
  assert.match(editor, /Split payment/);
  assert.match(preload, /const BUILD = '20\d{6}[a-z0-9]+'/);
  assert.match(html, /id="openPaymentPlanner"/);
  assert.match(html, />Find a payment day</);
  assert.match(html, /id="openMonthItems"/);
  assert.match(html, />Month items</);
  assert.match(html, /function openMonthItems\(model\)/);
  assert.match(html, /\(data\.bills\|\|\[\]\)\.some\(sameName\)/);
  assert.match(html, /\(data\.oneTimeEvents\|\|\[\]\)\.some/);
  assert.match(css, /\.month-items-dialog/);
  assert.match(css, /background:transparent!important/);
  assert.match(html, /Best first option · Split mortgage or Jeep/);
  assert.match(html, /Move '\+money\(choice\.firstAmount\)\+' this month to help/);
  assert.match(html, /forward-recommendations-slot/);
  assert.doesNotMatch(html, /<a href="\/control">Control Center<\/a>/);
  assert.doesNotMatch(html, /<a href="\/legacy">Legacy<\/a>/);
  assert.doesNotMatch(preload, /updated = ensureCalendarEventScroll/);
  assert.doesNotMatch(preload, /updated = ensureCalendarRowControls/);
  assert.doesNotMatch(preload, /updated = ensureCalendarSingleLineBills/);
});

test('home outlook reads the authoritative month ending from the list panel', () => {
  const source = read('html-hotfix-loader.js');
  assert.match(source, /panel\.dataset\.monthEnding/);
  assert.match(source, /\.calendar-day-ending b/);
});

test('calendar list carries Control Center notes and edits one occurrence', () => {
  const engine = require('../cashflow-engine.js');
  const rows = engine.rowsForMonth({ bills: [{ id: 'mortgage', name: 'Mortgage', amount: 500, dueDay: 17, notes: 'Call lender' }] }, 10, 0, 2026);
  assert.equal(rows.find(row => row.name === 'Mortgage').notes, 'Call lender');
  assert.match(read('generated-v5.html'), /data-note-default/);
  assert.match(read('billsos-card-editor.js'), /noteFor\(row,key\)/);
  assert.match(read('billsos-card-editor.js'), /confirmCloudSave\(\)/);
  assert.match(read('calendar-list-view.css'), /billsosCardNote/);
});

test('calendar notes describe the current date move without baking it into the editable note', () => {
  const values = new Map();
  const localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const source = read('billsos-card-editor.js').replace(/\}\)\(\);\s*$/, 'window.testNotes={noteFor,noteBodyFor,moveNoteFor,saveNote};})();');
  const window = { addEventListener() {} };
  vm.runInNewContext(source, { window, localStorage, document: { readyState: 'loading', addEventListener() {} }, setTimeout() {}, setInterval() {} });
  const key = '2026-09-30|Insurance|-200', row = { dataset: { noteDefault: 'Control Center reminder' } };
  assert.equal(window.testNotes.noteFor(row, key), 'Control Center reminder');
  values.set('billsos-pay-adjust-v1', JSON.stringify({ [key]: { date: '2026-10-02', originalDate: '2026-09-30' } }));
  assert.equal(window.testNotes.noteFor(row, key), 'Moved Sep 30 → Oct 2 · Control Center reminder');
  values.set('billsos-notes-adjust-v1', JSON.stringify({ [key]: { notes: 'Call vendor' } }));
  assert.equal(window.testNotes.noteFor(row, key), 'Moved Sep 30 → Oct 2 · Call vendor');
  assert.equal(window.testNotes.noteBodyFor(row, key), 'Call vendor');
  assert.equal(window.testNotes.saveNote(key, '', false), true);
  assert.equal(window.testNotes.noteFor(row, key), 'Moved Sep 30 → Oct 2');
  assert.equal(window.testNotes.saveNote(key, '', true), true);
  assert.equal(window.testNotes.noteFor(row, key), 'Moved Sep 30 → Oct 2 · Control Center reminder');
  assert.match(read('billsos-card-editor.js'), /data-note-action="clear">Clear note/);
  values.set('billsos-pay-adjust-v1', JSON.stringify({ [key]: { deleted: true, originalDate: '2026-09-30' } }));
  assert.equal(window.testNotes.noteFor(row, key), 'Control Center reminder');
});

test('dashboard installs one current calendar sync script and date resets use tombstones', () => {
  const html = read('generated-v5.html');
  const loader = read('html-hotfix-loader.js');
  const editor = read('billsos-card-editor.js');
  assert.equal((html.match(/billsos-cross-device-sync-v2\.js/g) || []).length, 1);
  assert.match(loader, /upsertScript\(html, '<script id="billsosCrossDeviceSyncV2" defer src="\/billsos-cross-device-sync-v2\.js/);
  assert.doesNotMatch(loader, /src="\/billsos-cross-device-sync\.js/);
  assert.match(editor, /deleted:true,originalDate:orig,updatedAt:stamp/);
  assert.match(editor, /map\[key\]=\{deleted:true,originalDate:originalDate\(key\),updatedAt:new Date\(\)\.toISOString\(\)\}/);
});
