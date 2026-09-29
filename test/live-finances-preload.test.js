'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-live-finances-'));
process.env.BILLS_DATA_DIR = dataDir;

const live = require('../live-finances-preload');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function payloadAt(bankingAsOf, pulledAt = bankingAsOf) {
  const snapshot = clone(read('spending/current.json'));
  const bill = clone(read('bill-payments-balance.json'));
  const savings = clone(read('savings-account-balance.json'));
  const pull = clone(read('spending-last-pull.json'));
  snapshot.freshness.balanceAsOf = bankingAsOf;
  bill.bankingAsOf = bankingAsOf;
  savings.bankingAsOf = bankingAsOf;
  pull.bankingAsOf = bankingAsOf;
  pull.pulledAt = pulledAt;
  return { files: {
    'spending/current.json': snapshot,
    'bill-payments-balance.json': bill,
    'savings-account-balance.json': savings,
    'spending-last-pull.json': pull
  } };
}

test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test('accepts only one reconciled four-file Finances snapshot', () => {
  const payload = payloadAt('2026-09-29T12:52:46.000Z');
  assert.deepEqual(Object.keys(live.validatePayload(payload)), live.REFRESH_FILES);

  const partial = clone(payload);
  delete partial.files['savings-account-balance.json'];
  assert.throws(() => live.validatePayload(partial), /exactly four files.*savings-account-balance/);

  const extra = clone(payload);
  extra.files['spending-data-stamp.js'] = 'window.example=true;';
  assert.throws(() => live.validatePayload(extra), /unexpected: spending-data-stamp/);
});

test('rejects wrong account identity, non-available balance sources, and mixed snapshots', () => {
  const wrongAccount = payloadAt('2026-09-29T12:52:46.000Z');
  wrongAccount.files['bill-payments-balance.json'].account.mask = '0000';
  assert.throws(() => live.validatePayload(wrongAccount), /invalid account identity/);

  const wrongField = payloadAt('2026-09-29T12:52:46.000Z');
  wrongField.files['savings-account-balance.json'].sourceField = 'balances.current';
  assert.throws(() => live.validatePayload(wrongField), /invalid account identity/);

  const mixed = payloadAt('2026-09-29T12:52:46.000Z');
  mixed.files['bill-payments-balance.json'].bankingAsOf = '2026-09-29T12:52:47.000Z';
  assert.throws(() => live.validatePayload(mixed), /same Finances banking snapshot/);
});

test('publishes a validated batch with receipts and preserves it on stale refreshes', () => {
  const first = live.validatePayload(payloadAt('2026-09-29T12:52:46.000Z'));
  const receipt = live.persistFiles(first, { requireNewer: true });
  assert.equal(receipt.live, true);
  assert.equal(receipt.files.length, 4);
  assert.ok(receipt.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));

  const before = new Map(live.REFRESH_FILES.map(name => [
    name, fs.readFileSync(path.join(live.LIVE_DIR, name), 'utf8')
  ]));
  const stale = live.validatePayload(payloadAt('2026-09-29T12:52:46.000Z', '2026-09-29T13:10:00.000Z'));
  assert.throws(() => live.persistFiles(stale, { requireNewer: true }), error => {
    assert.equal(error.status, 409);
    return /did not advance/.test(error.message);
  });
  for (const name of live.REFRESH_FILES) {
    assert.equal(fs.readFileSync(path.join(live.LIVE_DIR, name), 'utf8'), before.get(name));
  }
});

test('owner browser import route is present and does not publish data to GitHub', () => {
  const source = fs.readFileSync(path.join(root, 'live-finances-preload.js'), 'utf8');
  assert.match(source, /app\.get\('\/finances-refresh'/);
  assert.match(source, /Owner authentication required/);
  assert.match(source, /never written to GitHub/);
  assert.doesNotMatch(source, /github\.com|api\.github\.com/);
});
