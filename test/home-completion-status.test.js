const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'html-hotfix-loader.js'), 'utf8');

test('Home reads the canonical calendar completion and adjustment stores', () => {
  assert.match(source, /DONE_KEY='billsos-generated-done-v5'/);
  assert.match(source, /stateMap\(data,DONE_KEY,'completed'\)/);
  assert.match(source, /stateMap\(data,AMOUNT_KEY,'amountAdjustments'\)/);
  assert.match(source, /stateMap\(data,DATE_KEY,'dateAdjustments'\)/);
  assert.match(source, /completed:!!completed\[key\]/);
});

test('Home keeps completed upcoming rows visible with an explicit status', () => {
  assert.match(source, /var status=x\.completed\?'Completed':'Due'/);
  assert.match(source, /bo-upcoming-status/);
  assert.match(source, /upcoming\.map\(function\(x\)\{return upcomingRow\(x,false\)\}\)/);
  assert.match(source, /openUpcoming=upcoming\.filter\(function\(x\)\{return !x\.completed\}\)/);
  assert.match(source, /openUpcoming\.length\+' due'/);
  assert.match(source, /new Date\(dateValue\+'T00:00:00'\)/);
});

test('Home uses the shared cash-flow rows and calendar row key', () => {
  assert.match(source, /engine\.rowsForMonth\(data,value\[1\],0\)/);
  assert.match(source, /function rowKey\(row\)\{return String\(row\.iso\|\|row\.date\|\|''\)\+'\|'\+row\.name\+'\|'\+row\.amount\}/);
  assert.match(source, /row&&row\.amount<0&&billsById\[row\.sourceId\]/);
});
