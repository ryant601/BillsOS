'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'control.html'), 'utf8');

test('income tab provides a dedicated one-time income editor', () => {
  assert.match(html, /id="oneTimeIncomeItems">One-Time Income/);
  assert.match(html, /id="oneIncomeName"/);
  assert.match(html, /id="oneIncomeAmount"/);
  assert.match(html, /id="oneIncomeDate"/);
  assert.match(html, /onclick="saveOneTimeIncomeFromForm\(\)"/);
  assert.match(html, /id="oneIncomeTable"/);
});

test('one-time income saves as a positive synced calendar event', () => {
  assert.match(html, /async function saveOneTimeIncomeFromForm\(\)/);
  assert.match(html, /amount=Math\.abs\(Number\(/);
  assert.match(html, /type:'income'/);
  assert.match(html, /state\.oneTimeEvents\.push\(row\)/);
  assert.match(html, /await persistState\(/);
  assert.match(html, /function renderAll\(\)\{renderBills\(\);renderOne\(\);renderIncome\(\);renderOneTimeIncome\(\);renderRaw\(\)\}/);
});

test('one-time income can be edited and removed from the income tab', () => {
  assert.match(html, /function editOneTimeIncome\(id\)/);
  assert.match(html, /item\.type==='income'/);
  assert.match(html, /onclick="editOneTimeIncome\(/);
  assert.match(html, /onclick="deleteOne\(/);
  assert.match(html, /document\.getElementById\('oneIncomeId'\)\.value/);
});
