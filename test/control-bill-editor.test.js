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

test('a split bill stays one bill while producing each installment', () => {
  const jeep = {
    id: 'jeep-split', name: 'Jeep', amount: 700, dueDay: 20,
    frequency: 'monthly', startMonth: '2026-09', endMonth: '2026-10', active: true,
    paymentSplits: [{ id: 'jeep-1', day: 5, amount: 300 }, { id: 'jeep-2', day: 20, amount: 400 }]
  };
  const september = engine.rowsForMonth({ bills: [jeep], income: [], oneTimeEvents: [] }, 9, 0)
    .filter(row => row.sourceId === jeep.id);
  assert.equal(september.length, 2);
  assert.deepEqual(september.map(row => [row.day, row.amount, row.paymentPart, row.paymentParts]), [
    [5, -300, 1, 2], [20, -400, 2, 2]
  ]);
  assert.equal(engine.rowsForMonth({ bills: [jeep], income: [], oneTimeEvents: [] }, 11, 0)
    .some(row => row.sourceId === jeep.id), false);
});

test('One-Time Items supports bulk upcoming payment rows', () => {
  assert.match(html, />Add upcoming payments</);
  assert.match(html, />\+ Add payment</);
  assert.match(html, /function upcomingPaymentsFromForm/);
  assert.match(html, /data-payment-name/);
  assert.match(html, /name:payment\.name\|\|defaultName/);
  assert.match(html, /state\.oneTimeEvents\.push\(\.\.\.rows\)/);
  assert.match(html, /Each row can have its own calendar name, date, and amount/);
  assert.doesNotMatch(html, />Split payments</);
});

test('ending a bill preserves history and cross-device sync reloads data', () => {
  assert.match(html, /b\.endMonth=previousMonth\(month\)/);
  assert.match(html, /b\.active=true/);
  assert.match(html, /setInterval\(syncSavedBills,15000\)/);
});

test('one-time item edits persist immediately without changing the data model', () => {
  assert.match(html, /state\.oneTimeEvents\.push\(\.\.\.rows\)/);
  assert.match(html, /if\(editId\)state\.oneTimeEvents=state\.oneTimeEvents\.filter/);
  assert.match(html, /await persistState\(\(editId\?'Updated ':'Added '\)\+rows\.length/);
  assert.match(html, /type:direction==='income'\?'income':'adjustment'/);
  assert.match(html, /state\.oneTimeEvents=state\.oneTimeEvents\.filter/);
});

test('one-time save confirms calendar persistence and resets the form', () => {
  assert.match(html, /id="oneSaveButton"/);
  assert.match(html, /Saved to calendar/);
  assert.match(html, /renderAll\(\);clearOneTimeForm\(true\);if\(await persistState/);
  assert.match(html, /restoreOneTimeForm\(payments,direction,defaultName,notes,editId\)/);
  assert.match(html, /your entries were restored/);
  assert.match(html, /b\.id===highlightedOneTimeId\?'saved-row'/);
});
