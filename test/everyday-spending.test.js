'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Everyday Spending native section contains the current snapshot and BillsOS navigation', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'spending', 'index.html'), 'utf8');
  assert.match(html, /Everyday Spending/);
  assert.match(html, /Spending since transfer/);
  assert.match(html, /\$2,250\.00/);
  assert.match(html, /\$1,504\.66/);
  assert.match(html, /\$1,039\.28/);
  assert.match(html, /Dining &amp; Drinks/);
  assert.match(html, /Groceries/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/control"/);
});

test('dashboard preload injects Everyday Spending navigation and cache version', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'cache-coherence-preload.js'), 'utf8');
  assert.match(preload, /20260828spending1/);
  assert.match(preload, /href=\\"\/spending\/\\"/);
  assert.match(preload, /ensureSpendingNavigation/);
});
