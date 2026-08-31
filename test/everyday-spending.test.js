'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Everyday Spending native section contains the current snapshot', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'spending', 'index.html'), 'utf8');
  assert.match(html, /Everyday Spending/);
  assert.match(html, /Spending since transfer/);
  assert.match(html, /\$2,250\.00/);
  assert.match(html, /\$1,602\.25/);
  assert.match(html, /\$1,208\.26/);
  assert.match(html, /Dining/);
  assert.match(html, /Groceries/);
});

test('dashboard preload injects Everyday Spending navigation and cache version', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'cache-coherence-preload.js'), 'utf8');
  assert.match(preload, /20260831calendarregression1/);
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
