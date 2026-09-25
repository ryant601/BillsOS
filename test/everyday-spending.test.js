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
  assert.match(html, /fetch\('\/spending\/current\.json\?v=[a-z0-9-]+'/i);
  assert.equal(snapshot.schema, 'billsos-everyday-spending');
  assert.equal(snapshot.version, 1);
  assert.ok(Number.isFinite(snapshot.metrics.transferredIn));
  assert.ok(Number.isFinite(snapshot.metrics.totalSpent));
  assert.ok(Number.isFinite(snapshot.metrics.remainingAvailable));
  assert.match(html, /current\.json\?v=20260924-174307/);
  assert.equal(snapshot.cycle.start, '2026-09-18');
  assert.equal(snapshot.cycle.end, '2026-10-01');
  assert.equal(snapshot.cycle.nextTransfer, '2026-10-02');
  assert.equal(snapshot.cycle.daysLeft, 8);
  assert.equal(snapshot.metrics.transferredIn, 2207);
  assert.equal(snapshot.metrics.totalSpent, 1101.49);
  assert.equal(snapshot.metrics.remainingAvailable, 1182.29);
  assert.equal(snapshot.metrics.pendingSpend, 80.72);
  assert.equal(snapshot.metrics.postedSpend, 1020.77);
  assert.equal(snapshot.freshness.balanceAsOf, '2026-09-24T21:42:29.041623Z');
  assert.ok(Array.isArray(snapshot.transactions));
  assert.equal(snapshot.transactions.length, 49);
  const transactionTotal = snapshot.transactions.reduce((sum, transaction) => sum + Number(transaction.a || 0), 0);
  const pendingTotal = snapshot.transactions.filter(transaction => transaction.p).reduce((sum, transaction) => sum + Number(transaction.a || 0), 0);
  const postedTotal = snapshot.transactions.filter(transaction => !transaction.p).reduce((sum, transaction) => sum + Number(transaction.a || 0), 0);
  assert.equal(snapshot.metrics.totalSpent, Number(transactionTotal.toFixed(2)));
  assert.equal(snapshot.metrics.pendingSpend, Number(pendingTotal.toFixed(2)));
  assert.equal(snapshot.metrics.postedSpend, Number(postedTotal.toFixed(2)));
});

test('completed spending cycle is archived with its transactions and exact closed dates', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'archive', 'manifest.json'), 'utf8'));
  const archived = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'archive', '2026-08-21', 'current.json'), 'utf8'));
  const archivedHtml = fs.readFileSync(path.join(__dirname, '..', 'spending', 'archive', '2026-08-21', 'index.html'), 'utf8');
  assert.deepEqual(manifest.reports[0], {
    label: 'Aug 21 – Sep 3, 2026',
    start: '2026-08-21',
    end: '2026-09-03',
    path: '/spending/archive/2026-08-21/'
  });
  assert.equal(archived.cycle.start, '2026-08-21');
  assert.equal(archived.cycle.end, '2026-09-03');
  assert.equal(archived.cycle.nextTransfer, '2026-09-04');
  assert.ok(archived.transactions.some(row => row.c === 'Dining'));
  assert.ok(archived.transactions.some(row => row.c === 'Groceries'));
  assert.match(archivedHtml, /fetch\('\/spending\/archive\/2026-08-21\/current\.json/);
});

test('dashboard preload injects Everyday Spending navigation and cache version', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'cache-coherence-preload.js'), 'utf8');
  assert.match(preload, /20260904calendarrefresh1/);
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

test('vendor rows keep padded separation between long names and transaction counts', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(route, /\.vendor>summary\{padding:12px 14px!important\}/);
  assert.match(route, /\.vendor>summary>div:first-child\{display:flex;align-items:baseline;column-gap:8px;row-gap:2px;flex-wrap:wrap\}/);
  assert.match(route, /\.vendor>summary>div:first-child b\{min-width:0;overflow-wrap:anywhere\}/);
  assert.match(route, /\.vendor>summary>div:first-child small\{font-size:11px;font-weight:500;white-space:nowrap\}/);
});

test('runway ends before payday and rolls forward on transfer morning', () => {
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
  assert.equal(payday.cycle.daysLeft, 14);
  assert.equal(payday.metrics.availablePerDay, 17.47);
  assert.ok(payday.metrics.availablePerDay <= payday.metrics.remainingAvailable);
  assert.deepEqual(payday.cycle, {
    start: '2026-09-04',
    end: '2026-09-17',
    nextTransfer: '2026-09-18',
    daysLeft: 14
  });
  const beforePayday = runway.applyRunway({
    cycle: { start: '2026-08-21', end: '2026-09-04', nextTransfer: '2026-09-04' },
    metrics: { remainingAvailable: 241.08 }
  }, '2026-09-03', morning);
  assert.equal(beforePayday.cycle.end, '2026-09-03');
  assert.equal(beforePayday.cycle.nextTransfer, '2026-09-04');
  const laterCycle = runway.applyRunway({
    cycle: { start: '2026-08-21', end: '2026-09-04', nextTransfer: '2026-09-04' },
    metrics: { remainingAvailable: 241.08 }
  }, '2026-09-18', morning);
  assert.equal(laterCycle.cycle.start, '2026-09-18');
  assert.equal(laterCycle.cycle.end, '2026-10-01');
  assert.equal(laterCycle.cycle.nextTransfer, '2026-10-02');
  assert.equal(runway.isSpendingSnapshot('/spending/current.json?v=active'), true);
  assert.equal(runway.isSpendingSnapshot('/spending/archive/2026-08-21/current.json'), false);
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
