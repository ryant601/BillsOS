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
  assert.match(html, /fetch\('\/spending\/current\.json\?v=20260903-123055'/);
  assert.equal(snapshot.metrics.transferredIn, 2250);
  assert.equal(snapshot.metrics.totalSpent, 2412.19);
  assert.equal(snapshot.metrics.remainingAvailable, 241.08);
  assert.ok(snapshot.transactions.some(row => row.c === 'Dining'));
  assert.ok(snapshot.transactions.some(row => row.c === 'Groceries'));
});

test('dashboard preload injects Everyday Spending navigation and cache version', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'cache-coherence-preload.js'), 'utf8');
  assert.match(preload, /20260903calnav1/);
  assert.match(preload, /a\.href='\/spending\/'/);
  assert.match(preload, /nav\.querySelector\('a\[href="\/spending\/"\]'\)/);
  assert.match(preload, /ensureSpendingSidebar/);
});

test('Everyday Spending shell clears the fixed sidebar on desktop and returns full width on mobile', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(route, /body\.bo-app\.bo-spending\{padding-left:224px!important\}/);
  assert.match(route, /body\.bo-app\.bo-spending>\.app,body\.bo-app\.bo-spending \.shell>\.app\{width:100%;min-width:0;margin-left:auto!important;margin-right:auto!important\}/);
  assert.match(route, /body\.bo-app\.bo-spending \.shell>\.side,body\.bo-app\.bo-spending aside\.side\{display:none!important\}/);
  assert.match(route, /@media\(max-width:760px\)\{body\.bo-app\.bo-spending\{padding-left:0!important\}\}/);
  assert.match(route, /html = spendingLayoutPatch\(html\)/);
  assert.match(route, /class="bo-spending"/);
});

test('Where it went category rows keep icon, name, and full amount on one line', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  const assistant = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'spending', 'index.html'), 'utf8');
  assert.match(route, /grid-template-columns:40px minmax\(0,1fr\) auto 22px!important/);
  assert.match(route, /white-space:nowrap;justify-self:end/);
  assert.match(assistant, /<div class="ico">'\+meta\[0\]/);
  assert.doesNotMatch(assistant, /!hasOverrides&&!categoriesPatched/);
  assert.match(html, /class="ico"/);
  assert.match(html, /grid-template-columns:40px minmax\(0,1fr\) auto 22px/);
});

test('Where it went vendors and transactions sort high to low by amount', () => {
  const assistant = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'spending', 'index.html'), 'utf8');
  assert.match(assistant, /Object\.keys\(vendors\)\.sort\(function\(a,b\)\{return sum\(vendors\[b\]\)-sum\(vendors\[a\]\)\}\)/);
  assert.match(assistant, /tx\.slice\(\)\.sort\(function\(a,b\)\{return Number\(b\.amount\|\|0\)-Number\(a\.amount\|\|0\)/);
  assert.doesNotMatch(assistant, /tx\.sort\(function\(a,b\)\{return a\.date\.localeCompare/);
  assert.match(html, /\[\.\.\.r\]\.sort\(\(a,b\)=>Number\(b\.a\)-Number\(a\.a\)\)/);
  assert.match(html, /Object\.entries\(vs\)\.sort\(\(a,b\)=>total\(b\[1\]\)-total\(a\[1\]\)\)/);
});

test('Spending and home amount rows keep the dollar value fully visible', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'html-hotfix-loader.js'), 'utf8');
  assert.match(route, /grid-template-columns:72px minmax\(0,1fr\) auto max-content!important/);
  assert.match(route, /\.row \.amt\{white-space:nowrap;justify-self:end/);
  assert.match(home, /bo-outlook-month strong\{display:block;margin-top:5px;overflow:visible/);
  assert.match(home, /\.bo-outlook-values\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test('subcategory transaction counts sit apart from the type name', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  const assistant = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  assert.match(assistant, /esc\(subcategory\)\+'<\/b> <small>'/);
  assert.match(route, /\.sub>summary b\+small\{margin-left:8px/);
});

test('runway days stop the morning the paycheck lands', () => {
  const runway = require('../spending-runway.js');
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.equal(runway.runwayDays('2026-09-02', '2026-09-04'), 2);
  assert.equal(runway.runwayDays('2026-09-03', '2026-09-04'), 1);
  assert.equal(runway.runwayDays('2026-09-04', '2026-09-04'), 0);
  assert.equal(runway.runwayDays('2026-09-05', '2026-09-04'), 0);
  const evening = new Date('2026-09-03T02:00:00Z');
  const morning = new Date('2026-09-02T14:00:00Z');
  const late = runway.applyRunway({
    cycle: { nextTransfer: '2026-09-04', daysLeft: 3 },
    metrics: { remainingAvailable: 241.08, availablePerDay: 80.36 }
  }, '2026-09-02', evening);
  assert.equal(late.cycle.daysLeft, 2);
  assert.equal(late.metrics.availablePerDay, 241.08);
  assert.equal(late.metrics.availablePaceLabel, 'for tomorrow');
  const early = runway.applyRunway({
    cycle: { nextTransfer: '2026-09-04', daysLeft: 3 },
    metrics: { remainingAvailable: 241.08, availablePerDay: 80.36 }
  }, '2026-09-02', morning);
  assert.equal(early.metrics.availablePerDay, 133.93);
  assert.equal(early.metrics.availablePaceLabel, 'available per day');
  const lastMorning = runway.applyRunway({
    cycle: { nextTransfer: '2026-09-04', daysLeft: 3 },
    metrics: { remainingAvailable: 241.08, availablePerDay: 80.36 }
  }, '2026-09-03', morning);
  assert.equal(lastMorning.cycle.daysLeft, 1);
  assert.equal(lastMorning.metrics.availablePerDay, 241.08);
  assert.ok(lastMorning.metrics.availablePerDay <= lastMorning.metrics.remainingAvailable);
  const payday = runway.applyRunway({
    cycle: { nextTransfer: '2026-09-04', daysLeft: 3 },
    metrics: { remainingAvailable: 241.08, availablePerDay: 80.36 }
  }, '2026-09-04', morning);
  assert.equal(payday.cycle.daysLeft, 0);
  assert.equal(payday.metrics.availablePerDay, 241.08);
  assert.ok(payday.metrics.availablePerDay <= payday.metrics.remainingAvailable);
  assert.match(route, /spending-runway\.js\?v='\s*\+\s*SPENDING_BUILD/);
  assert.match(route, /html = spendingRunwayPatch\(html\)/);
});

test('Everyday Spending keeps the shared app sidebar and drops the page-owned nav', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(route, /html = String\(html \|\| ''\)\.replace\(/);
  assert.match(route, /aside class="side"/);
  assert.match(route, /body\.bo-app\.bo-spending \.shell\{display:block!important\}/);
  assert.match(route, /aside\.side\{display:none!important\}/);
});
