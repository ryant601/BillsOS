'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Everyday Spending native section contains the current snapshot', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'spending', 'index.html'), 'utf8');
  const snapshot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'current.json'), 'utf8'));
  assert.match(html, /Everyday Spending/);
  assert.match(html, /Spending since transfer/);
  assert.match(html, /fetch\('\/spending\/current\.json\?v=20260902-1633'/);
  assert.equal(snapshot.metrics.transferredIn, 2250);
  assert.equal(snapshot.metrics.totalSpent, 2361.36);
  assert.equal(snapshot.metrics.remainingAvailable, 291.91);
  assert.ok(snapshot.transactions.some(row => row.c === 'Dining'));
  assert.ok(snapshot.transactions.some(row => row.c === 'Groceries'));
});

test('dashboard preload injects Everyday Spending navigation and cache version', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'cache-coherence-preload.js'), 'utf8');
  assert.match(preload, /20260903freshdesign1/);
  assert.match(preload, /a\.href='\/spending\/'/);
  assert.match(preload, /nav\.querySelector\('a\[href="\/spending\/"\]'\)/);
  assert.match(preload, /ensureSpendingSidebar/);
});

test('Everyday Spending shell clears the fixed sidebar on desktop and returns full width on mobile', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(route, /body\.bo-app\.bo-spending\{padding-left:220px!important\}/);
  assert.match(route, /body\.bo-app\.bo-spending>\.app\{width:100%;min-width:0;margin-left:auto!important;margin-right:auto!important\}/);
  assert.match(route, /@media\(max-width:760px\)\{body\.bo-app\.bo-spending\{padding-left:0!important\}\}/);
  assert.match(route, /html = spendingLayoutPatch\(html\)/);
  assert.match(route, /class="bo-spending"/);
});
