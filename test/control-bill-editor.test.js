const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'control.html'), 'utf8');
const engine = require('../cashflow-engine');

test('bill editor exposes clear lifecycle actions', () => {
  assert.match(html, />Edit</);
  assert.match(html, />End from this month</);
  assert.match(html, /Delete entirely/);
  assert.match(html, /'Pause'/);
});

test('bill mutations persist immediately with rollback and feedback', () => {
  assert.match(html, /async function persistState/);
  assert.match(html, /await persistState\(\(i>=0\?'Updated ':'Added '\)\+row\.name,previous\)/);
  assert.match(html, /Removed from /);
  assert.match(html, /Save failed — your change was not applied/);
});

test('bill editor provides a browser-independent Start Month selector and persists the engine field', () => {
  assert.match(html, /function installBillStartSelector/);
  assert.match(html, /select\.id='billStart'/);
  assert.match(html, /select\.value=currentMonth\(\)/);
  assert.match(html, /startMonth:document\.getElementById\('billStart'\)\.value\|\|null/);
  assert.match(html, /!row\.startMonth/);
  assert.match(html, /monthFromDate\(b\.startDate\)/);
  assert.match(html, /delete row\.startDate/);
});

test('a saved recurring bill begins in its selected calendar month', () => {
  const data = { bills: [{ id: 'start-month-regression', name: 'Regression bill', amount: 123.45, dueDay: 20, frequency: 'monthly', startMonth: '2026-09', active: true }], income: [], oneTimeEvents: [] };
  assert.equal(engine.rowsForMonth(data, 8, 0).some(row => row.sourceId === 'start-month-regression'), false);
  assert.equal(engine.rowsForMonth(data, 9, 0).some(row => row.sourceId === 'start-month-regression' && row.iso === '2026-09-20'), true);
  assert.equal(engine.rowsForMonth(data, 10, 0).some(row => row.sourceId === 'start-month-regression'), true);
});

test('ending a bill preserves history and cross-device sync reloads data', () => {
  assert.match(html, /b\.endMonth=previousMonth\(month\)/);
  assert.match(html, /b\.active=true/);
  assert.match(html, /setInterval\(syncSavedBills,15000\)/);
});

test('one-time item edits persist immediately without changing the data model', () => {
  assert.match(html, /state\.oneTimeEvents\[i\]=row/);
  assert.match(html, /await persistState\(\(i>=0\?'Updated ':'Added '\)\+row\.name,previous\)/);
  assert.match(html, /type:direction==='income'\?'income':'adjustment'/);
  assert.match(html, /state\.oneTimeEvents=state\.oneTimeEvents\.filter/);
});

test('one-time save confirms calendar persistence and resets the form', () => {
  assert.match(html, /id="oneSaveButton"/);
  assert.match(html, /Saved to calendar/);
  assert.match(html, /renderAll\(\);clearOneTimeForm\(true\);if\(await persistState/);
  assert.match(html, /restoreOneTimeForm\(row,direction\)/);
  assert.match(html, /your entries were restored/);
  assert.match(html, /b\.id===highlightedOneTimeId\?'saved-row'/);
});
