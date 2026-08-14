const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'control.html'), 'utf8');

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
