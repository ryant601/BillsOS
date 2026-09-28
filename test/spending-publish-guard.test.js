'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyData } = require('../scripts/verify-spending-snapshot');

const root = path.join(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const files = () => [read('spending/current.json'), read('spending-last-pull.json'),
  read('bill-payments-balance.json'), read('savings-account-balance.json')];

test('the published spending snapshot reconciles against exact account contracts', () => {
  const result = verifyData(...files());
  assert.ok(Number.isInteger(result.transactions));
  assert.ok(Number.isFinite(result.totalSpent));
});

test('publishing rejects missing transactions, false totals, and a carried-over cycle row', () => {
  const missing = files(); missing[0].transactions = null;
  assert.throws(() => verifyData(...missing), /Missing transaction list/);
  const wrongTotal = files(); wrongTotal[0].metrics.totalSpent += 1;
  assert.throws(() => verifyData(...wrongTotal), /do not reconcile/);
  const oldRow = files(); oldRow[0].transactions[0].date = '2026-09-17';
  assert.throws(() => verifyData(...oldRow), /Invalid transaction/);
});

test('publishing rejects a current-balance substitution or mismatched banking timestamp', () => {
  const wrongField = files(); wrongField[2].sourceField = 'balances.current';
  assert.throws(() => verifyData(...wrongField), /invalid account identity/);
  const wrongAccount = files(); wrongAccount[3].account.mask = '0000';
  assert.throws(() => verifyData(...wrongAccount), /invalid account identity/);
  const wrongTime = files(); wrongTime[1].bankingAsOf = '2026-09-23T21:42:29Z';
  assert.throws(() => verifyData(...wrongTime), /timestamp and pull metadata disagree/);
});
