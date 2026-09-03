'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const packageJson = require('../package.json');
const bridge = require('../html-hotfix-loader');
const home = fs.readFileSync(path.join(root, 'html-hotfix-loader.js'), 'utf8');
const cache = fs.readFileSync(path.join(root, 'cache-coherence-preload.js'), 'utf8');
const stamp = JSON.parse(fs.readFileSync(path.join(root, 'bill-payments-balance.json'), 'utf8'));
const savingsStamp = JSON.parse(fs.readFileSync(path.join(root, 'savings-account-balance.json'), 'utf8'));
const spendingSnapshot = JSON.parse(fs.readFileSync(path.join(root, 'spending/current.json'), 'utf8'));

test('static balance stamp uses the exact TD Bill Payments identity and available field', () => {
  assert.deepEqual(stamp.account, {
    institution: 'TD Bank',
    name: 'Bill Payments',
    officialName: 'TD BEYOND CHECKING',
    mask: '6189'
  });
  assert.equal(stamp.schema, 'billsos-bill-payments-balance');
  assert.equal(stamp.version, 1);
  assert.equal(stamp.balance.available, 411.43);
  assert.equal(stamp.balance.currency, 'USD');
  assert.equal(stamp.bankingAsOf, '2026-09-02T20:33:19.846990Z');
  assert.equal(stamp.source, 'Finances');
  assert.equal(stamp.sourceField, 'balances.available');
});

test('static Savings stamp uses the exact TD account identity, available field, and banking timestamp', () => {
  assert.deepEqual(savingsStamp.account, {
    institution: 'TD Bank',
    name: 'Savings Account',
    officialName: 'TD SIMPLE SAVINGS',
    mask: '2468'
  });
  assert.equal(savingsStamp.schema, 'billsos-savings-account-balance');
  assert.equal(savingsStamp.version, 1);
  assert.equal(savingsStamp.balance.available, 1500);
  assert.equal(savingsStamp.balance.currency, 'USD');
  assert.equal(savingsStamp.bankingAsOf, '2026-09-02T20:33:19.846990Z');
  assert.equal(savingsStamp.source, 'Finances');
  assert.equal(savingsStamp.sourceField, 'balances.available');
});

test('normalizer requires every exact account field and selects available instead of current', () => {
  const candidate = { ...stamp, balance: { available: 1459.92, current: 1460.39, currency: 'USD' } };
  const normalized = bridge.normalizeBillPaymentsBalance(candidate);
  assert.equal(normalized.balance.available, 1459.92);
  assert.equal(normalized.balance.current, undefined);
  for (const [field, wrong] of [['institution', 'TD'], ['name', 'Bills'], ['officialName', 'TD CHECKING'], ['mask', '6198']]) {
    assert.equal(bridge.normalizeBillPaymentsBalance({ ...candidate, account: { ...candidate.account, [field]: wrong } }), null);
  }
});

test('Savings normalizer requires every exact account field and never selects current', () => {
  const candidate = { ...savingsStamp, balance: { available: 1500, current: 1499.99, currency: 'USD' } };
  const normalized = bridge.normalizeSavingsAccountBalance(candidate);
  assert.equal(normalized.balance.available, 1500);
  assert.equal(normalized.balance.current, undefined);
  for (const [field, wrong] of [['institution', 'TD'], ['name', 'Savings'], ['officialName', 'TD SAVINGS'], ['mask', '2648']]) {
    assert.equal(bridge.normalizeSavingsAccountBalance({ ...candidate, account: { ...candidate.account, [field]: wrong } }), null);
  }
});

test('missing or invalid balance data preserves the existing card fallback', () => {
  assert.equal(bridge.normalizeBillPaymentsBalance(null), null);
  assert.equal(bridge.normalizeBillPaymentsBalance({ ...stamp, balance: { available: null, currency: 'USD' } }), null);
  assert.equal(bridge.normalizeBillPaymentsBalance({ ...stamp, balance: { current: 1460.39, currency: 'USD' } }), null);
  assert.match(home, /if\(stamp\)applyBankBalance\(stamp\)/);
  assert.match(home, /\.catch\(function\(\)\{\}\)/);
  assert.match(home, /\['cash','Bills account',c\.start\|\|c\.end\|\|0,'Available balance'/);
  assert.doesNotMatch(home, /available:\s*0/);
  assert.equal(bridge.normalizeSavingsAccountBalance(null), null);
  assert.equal(bridge.normalizeSavingsAccountBalance({ ...savingsStamp, balance: { available: null, currency: 'USD' } }), null);
  assert.equal(bridge.normalizeSavingsAccountBalance({ ...savingsStamp, balance: { current: 1500, currency: 'USD' } }), null);
  assert.match(home, /if\(stamp\)applySavingsBalance\(stamp\)/);
});

test('home renders three responsive, display-only account tiles without changing sidebar navigation', () => {
  assert.match(home, /fetch\('\/savings-account-balance\.json\?home='/);
  assert.match(home, /querySelector\('\[data-bo-detail="savings"\]'\)/);
  assert.match(home, /\['savings','Savings account','—','Mortgage funding','◇'\]/);
  assert.match(home, /TD Bank · Savings Account ••••2468/);
  assert.match(home, /bankMoney\(savings\.balance\.available\)/);
  assert.match(home, /\['cash','Bills account'/);
  assert.match(home, /\['spending-account','Everyday spending','—','Available balance','◉'\]/);
  assert.match(home, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(home, /@media\(max-width:760px\).*\.bo-kpis\{grid-template-columns:1fr\}/);
  assert.equal((home.match(/function installSidebar\(\)/g) || []).length, 1);
  assert.doesNotMatch(home, /cashflow-engine/);
});

test('Everyday Spending tile uses only the published available balance and banking timestamp', () => {
  const normalized = bridge.normalizeEverydaySpendingBalance(spendingSnapshot);
  assert.deepEqual(normalized, {
    available: 291.91,
    bankingAsOf: '2026-09-02T20:33:19.846990Z'
  });
  assert.equal(bridge.normalizeEverydaySpendingBalance(null), null);
  assert.equal(bridge.normalizeEverydaySpendingBalance({ ...spendingSnapshot, metrics: { remainingAvailable: null } }), null);
  assert.equal(bridge.normalizeEverydaySpendingBalance({ ...spendingSnapshot, freshness: { balanceAsOf: null } }), null);
  assert.match(home, /fetch\('\/spending\/current\.json\?home='/);
  assert.match(home, /querySelector\('\[data-bo-detail="spending-account"\]'\)/);
  assert.match(home, /if\(stamp\)applySpendingBalance\(stamp\)/);
  assert.match(home, /bankMoney\(spending\.available\)/);
  assert.match(home, /TD Bank · Everything Else/);
  assert.match(home, /href="\/spending\/"/);
});

test('month-end outlook comes from every remaining month final calendar card', () => {
  assert.match(home, /\.month-panel\[data-year=/);
  assert.match(home, /\[data-month=/);
  assert.match(home, /panel\.querySelectorAll\('\.day\[data-day\]'\)/);
  assert.match(home, /Number\(a\.dataset\.day\|\|0\)-Number\(b\.dataset\.day\|\|0\)/);
  assert.match(home, /querySelector\('\.eod b,\.endline b'\)/);
  assert.match(home, /function remainingMonthEnds\(\)/);
  assert.match(home, /month<=12/);
  assert.match(home, /Month-end outlook/);
  assert.match(home, /Ending balances through December/);
  assert.match(home, /data-bo-detail="forecast-/);
  assert.doesNotMatch(home, /\['ending','Projected month end'/);
  assert.match(home, /end:calendarEnd==null\?num\(document\.querySelector\('#kend'\)\):calendarEnd/);
  assert.match(home, /bo-kpi bo-outlook-card/);
  assert.match(home, /\.bo-outlook-values\{display:grid;grid-template-columns:repeat\(4/);
  assert.doesNotMatch(home, /bo-forecast-grid|id="boForecastGrid"/);
  assert.match(home, /@media\(max-width:760px\).*\.bo-kpis\{grid-template-columns:1fr\}/);
  assert.match(home, /setTimeout\(renderMetrics,2400\)/);
});

test('home client fetch patches only the Bills account value and note and keeps the detail display-only', () => {
  assert.match(home, /fetch\('\/bill-payments-balance\.json\?home='/);
  assert.match(home, /querySelector\('\[data-bo-detail="cash"\]'\)/);
  assert.match(home, /card&&card\.querySelector\('\.bo-kpi-value'\)/);
  assert.match(home, /card&&card\.querySelector\('\.bo-kpi-note'\)/);
  assert.match(home, /bankMoney\(stamp\.balance\.available\)/);
  assert.match(home, /TD Bank · Bill Payments ••••6189/);
  assert.match(home, /bankMoney\(bank\.balance\.available\)/);
  assert.doesNotMatch(home, /cashflow-engine/);
});

test('cache build changes without changing the server start or preload chain', () => {
  const expectedStart = 'node -r ./q1-2027-calendar-seed-preload.js -r ./rest-2027-calendar-seed-preload.js -r ./att-deck-calendar-fix-preload.js -r ./payment-splits-preserve-preload.js -r ./readonly-calendar-preload.js -r ./html-hotfix-loader.js -r ./cache-coherence-preload.js -r ./spending-route-preload.js server.js';
  assert.equal(packageJson.scripts.start, expectedStart);
  assert.match(cache, /const BUILD = '20260903claude1'/);
  assert.doesNotMatch(packageJson.scripts.start, /bill-payments-balance|bills-account-balance/);
});
