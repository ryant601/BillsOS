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

test('static balance stamp uses the exact TD Bill Payments identity and available field', () => {
  assert.deepEqual(stamp.account, {
    institution: 'TD Bank',
    name: 'Bill Payments',
    officialName: 'TD BEYOND CHECKING',
    mask: '6189'
  });
  assert.equal(stamp.schema, 'billsos-bill-payments-balance');
  assert.equal(stamp.version, 1);
  assert.equal(stamp.balance.available, 1459.92);
  assert.equal(stamp.balance.currency, 'USD');
  assert.equal(stamp.bankingAsOf, '2026-08-29T10:22:27.449259Z');
  assert.equal(stamp.source, 'Finances');
  assert.equal(stamp.sourceField, 'balances.available');
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

test('missing or invalid balance data preserves the existing card fallback', () => {
  assert.equal(bridge.normalizeBillPaymentsBalance(null), null);
  assert.equal(bridge.normalizeBillPaymentsBalance({ ...stamp, balance: { available: null, currency: 'USD' } }), null);
  assert.equal(bridge.normalizeBillPaymentsBalance({ ...stamp, balance: { current: 1460.39, currency: 'USD' } }), null);
  assert.match(home, /if\(stamp\)applyBankBalance\(stamp\)/);
  assert.match(home, /\.catch\(function\(\)\{\}\)/);
  assert.match(home, /\['cash','Cash available',c\.start\|\|c\.end\|\|0,'Current planning balance'/);
  assert.doesNotMatch(home, /available:\s*0/);
});

test('home client fetch patches only the Cash Available value and note and keeps the detail display-only', () => {
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
  assert.match(cache, /const BUILD = '20260831calendarregression1'/);
  assert.doesNotMatch(packageJson.scripts.start, /bill-payments-balance|bills-account-balance/);
});
