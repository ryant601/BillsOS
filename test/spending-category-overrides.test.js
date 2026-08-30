'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSpendingCategoryStore, parseSnapshotTransactions } = require('../spending-category-overrides');

const snapshot = '<script>const T=[' + [
  { date: '2026-08-28', m: 'QuickChek', a: 10.38, p: true, c: 'Household / Shopping', s: 'Shopping', n: '' },
  { date: '2026-08-28', m: 'Wawa', a: 50, p: false, c: 'Gas / Transportation', s: 'Gas', n: '' },
  { date: '2026-08-28', m: 'McDonald\'s', a: 11.08, p: true, c: 'Dining', s: 'Fast Food', n: '' }
].map(JSON.stringify).join(',') + '];const M={};</script>';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-categories-'));
  const snapshotPath = path.join(dir, 'index.html');
  fs.writeFileSync(snapshotPath, snapshot);
  return { dir, snapshotPath, store: createSpendingCategoryStore({ dataDir: dir, snapshotPath }) };
}

test('parses exact transaction identity and uses the requested existing category pair', () => {
  const rows = parseSnapshotTransactions(snapshot);
  assert.deepEqual(rows[0], {
    date: '2026-08-28', merchant: 'QuickChek', amount: 10.38, pending: true,
    category: 'Household / Shopping', subcategory: 'Shopping', note: ''
  });
  const { store } = fixture();
  const saved = store.save({
    transaction: { date: '2026-08-28', merchant: 'QuickChek', amount: 10.38, pending: true, note: '' },
    category: 'Gas / Transportation', subcategory: 'Gas'
  }, 'owner');
  assert.equal(saved.category, 'Gas / Transportation');
  assert.equal(saved.subcategory, 'Gas');
  assert.equal(saved.originalCategory, 'Household / Shopping');
  assert.equal(store.publicState().overrides.length, 1);
});

test('rejects a stale or inexact transaction without overwriting the last known state', () => {
  const { store, dir } = fixture();
  store.save({
    transaction: { date: '2026-08-28', merchant: 'QuickChek', amount: 10.38, pending: true, note: '' },
    category: 'Gas / Transportation', subcategory: 'Gas'
  }, 'owner');
  const before = fs.readFileSync(path.join(dir, 'spending-category-overrides.json'), 'utf8');
  assert.throws(() => store.save({
    transaction: { date: '2026-08-28', merchant: 'QuickChek', amount: 10.39, pending: true, note: '' },
    category: 'Dining', subcategory: 'Fast Food'
  }, 'owner'), /no longer in the current report/);
  assert.equal(fs.readFileSync(path.join(dir, 'spending-category-overrides.json'), 'utf8'), before);
});

test('rejects invented category pairs and supports audited undo', () => {
  const { store } = fixture();
  const request = {
    transaction: { date: '2026-08-28', merchant: 'QuickChek', amount: 10.38, pending: true, note: '' },
    category: 'Gas / Transportation', subcategory: 'Gas'
  };
  assert.throws(() => store.save({ ...request, category: 'Made Up' }, 'owner'), /existing BillsOS category/);
  const saved = store.save(request, 'owner');
  store.remove(saved.id, 'owner');
  const after = store.publicState();
  assert.equal(after.overrides.length, 0);
  assert.deepEqual(after.history.map(item => item.action), ['created', 'removed']);
});

test('client assistant requires confirmation, preserves totals, and uses the versioned endpoint', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(source, /data-spai-action="apply"/);
  assert.match(source, /Only this matched transaction will move\. Spending totals and balances will not change/);
  assert.match(source, /\/api\/spending\/category-overrides/);
  assert.match(source, /session\.role!==\'owner\'/);
  assert.match(source, /\(!hasOverrides&&!categoriesPatched\)/);
  assert.match(source, /categoriesPatched=hasOverrides/);
  assert.match(route, /spending-assistant\.js\?v=20260829categories1/);
});
