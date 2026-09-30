'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createSpendingCategoryStore, parseSnapshotTransactions } = require('../spending-category-overrides');
const classifications = require('../spending-classification-rules');

const snapshot = '<script>const T=[' + [
  { date: '2026-08-28', m: 'QuickChek', a: 10.38, p: true, c: 'Household / Shopping', s: 'Shopping', n: '' },
  { date: '2026-08-28', m: 'Wawa', a: 50, p: false, c: 'Gas / Transportation', s: 'Gas', n: '' },
  { date: '2026-08-28', m: 'McDonald\'s', a: 11.08, p: true, c: 'Dining', s: 'Fast Food', n: '' }
].map(JSON.stringify).join(',') + '];const M={};</script>';

const currentSnapshot = JSON.stringify({ transactions: [
  { date: '2026-08-31', m: 'Wawa', a: 45, p: true, c: 'Financial / Fees', s: 'Cash withdrawal', n: 'ATM cash' },
  { date: '2026-08-31', m: 'Apple', a: 10.65, p: true, c: 'Services', s: 'Services', n: '' }
] });

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

test('parses the current JSON transaction source used by the live spending page', () => {
  const rows = parseSnapshotTransactions(currentSnapshot);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    date: '2026-08-31', merchant: 'Wawa', amount: 45, pending: true,
    category: 'Financial / Fees', subcategory: 'Cash withdrawal', note: 'ATM cash'
  });
});

test('saves an override against the live current JSON snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-current-json-'));
  const snapshotPath = path.join(dir, 'current.json');
  fs.writeFileSync(snapshotPath, currentSnapshot);
  const store = createSpendingCategoryStore({ dataDir: dir, snapshotPath });
  const saved = store.save({
    transaction: { date: '2026-08-31', merchant: 'Wawa', amount: 45, pending: true, note: 'ATM cash', occurrence: 1 },
    category: 'Services', subcategory: 'Services'
  }, 'owner');
  assert.equal(saved.match.occurrence, 1);
  assert.equal(saved.category, 'Services');
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

test('uses occurrence to safely recategorize one of two identical transactions', () => {
  const duplicateSnapshot = '<script>const T=[' + [
    { date: '2026-08-31', m: 'Wawa', a: 45, p: true, c: 'Financial / Fees', s: 'Cash withdrawal', n: 'ATM cash' },
    { date: '2026-08-31', m: 'Wawa', a: 45, p: true, c: 'Financial / Fees', s: 'Cash withdrawal', n: 'ATM cash' },
    { date: '2026-08-30', m: 'Wawa', a: 12, p: false, c: 'Gas / Transportation', s: 'Gas', n: '' }
  ].map(JSON.stringify).join(',') + '];const M={};</script>';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-duplicate-categories-'));
  const snapshotPath = path.join(dir, 'index.html');
  fs.writeFileSync(snapshotPath, duplicateSnapshot);
  const store = createSpendingCategoryStore({ dataDir: dir, snapshotPath });
  const transaction = { date: '2026-08-31', merchant: 'Wawa', amount: 45, pending: true, note: 'ATM cash' };
  assert.throws(() => store.save({ transaction, category: 'Gas / Transportation', subcategory: 'Gas' }, 'owner'), /More than one transaction matches/);
  const saved = store.save({ transaction: { ...transaction, occurrence: 2 }, category: 'Gas / Transportation', subcategory: 'Gas' }, 'owner');
  assert.equal(saved.match.occurrence, 2);
  assert.equal(saved.originalSubcategory, 'Cash withdrawal');
  assert.equal(store.publicState().overrides.length, 1);
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
  assert.doesNotMatch(source, /\(!hasOverrides&&!categoriesPatched\)/);
  assert.match(source, /categoriesPatched=true/);
  assert.match(route, /spending-assistant\.js\?v='\+SPENDING_BUILD/);
  assert.match(route, /spending-transaction-recategorize\.js\?v='\+SPENDING_BUILD/);
  assert.match(route, /spending-classification-rules\.js\?v='\+SPENDING_BUILD/);
});

test('master rule classifies outgoing Talbot Venmo and Zelle payments as family gifts', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'vendor-category-rules.json'), 'utf8'));
  const rows = classifications.apply([
    { merchant: 'TD ZELLE SENT 624700B0F32C Zelle WILLIAM TALBOT', note: '', amount: 41.46, category: 'Other', subcategory: 'Other' },
    { merchant: 'Venmo', note: 'Payment to Jamie Talbot', amount: 20, category: 'Other', subcategory: 'Other' },
    { merchant: 'Venmo', note: 'Payment to a friend', amount: 20, category: 'Other', subcategory: 'Other' },
    { merchant: 'Zelle TALBOT refund', note: '', amount: -20, category: 'Other', subcategory: 'Other' }
  ], config);
  assert.deepEqual(rows.slice(0, 2).map(row => [row.category, row.subcategory]), [['Gifts', 'Family'], ['Gifts', 'Family']]);
  assert.deepEqual(rows.slice(2).map(row => [row.category, row.subcategory]), [['Other', 'Other'], ['Other', 'Other']]);
});

test('master rule places Convenience spending under Dining', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'vendor-category-rules.json'), 'utf8'));
  const rows = classifications.apply([
    { merchant: 'QuickChek', note: '', amount: 12.50, category: 'Convenience', subcategory: 'Convenience' },
    { merchant: 'Local Market', note: '', amount: 20, category: 'Groceries', subcategory: 'Convenience' }
  ], config);
  assert.deepEqual([rows[0].category, rows[0].subcategory], ['Dining', 'Convenience']);
  assert.deepEqual([rows[1].category, rows[1].subcategory], ['Dining', 'Convenience']);
});

test('server accepts a category pair supplied by the master vendor rules', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-rule-categories-'));
  const snapshotPath = path.join(dir, 'current.json');
  const rulesPath = path.join(dir, 'vendor-category-rules.json');
  fs.writeFileSync(snapshotPath, JSON.stringify({ transactions: [
    { date: '2026-09-16', m: 'Venmo', a: 25, p: false, c: 'Other', s: 'Other', n: 'Payment to Jamie Talbot' },
    { date: '2026-09-16', m: 'Market', a: 12, p: false, c: 'Groceries', s: 'Supermarkets', n: '' }
  ] }));
  fs.writeFileSync(rulesPath, JSON.stringify({
    schema: 'billsos-vendor-category-rules', version: 1,
    rules: [{ id: 'family', enabled: true, match: { direction: 'outflow', containsAny: ['venmo'], containsAll: ['talbot'] }, classification: { category: 'Gifts', subcategory: 'Family' } }]
  }));
  const store = createSpendingCategoryStore({ dataDir: dir, snapshotPath, classificationRulesPath: rulesPath });
  const saved = store.save({
    transaction: { date: '2026-09-16', merchant: 'Market', amount: 12, pending: false, note: '', occurrence: 1 },
    category: 'Gifts', subcategory: 'Family'
  }, 'owner');
  assert.equal(saved.category, 'Gifts');
  assert.equal(saved.subcategory, 'Family');
});

test('invalid or missing classification data preserves published categories', () => {
  const row = { merchant: 'Zelle TALBOT', amount: 25, category: 'Other', subcategory: 'Other' };
  assert.equal(classifications.classify(row, null), row);
  assert.equal(classifications.classify(row, { schema: 'wrong', version: 1, rules: [] }), row);
});

test('an exact manual override wins over the master vendor rule', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spending', 'vendor-category-rules.json'), 'utf8'));
  const context = {
    window: { BillsOSSpendingClassifications: classifications },
    document: { readyState: 'loading', addEventListener() {} },
    setTimeout() {}, fetch() {},
    T: [{ date: '2026-09-04', m: 'Zelle WILLIAM TALBOT', a: 41.46, p: true, c: 'Other', s: 'Other', n: '' }]
  };
  vm.createContext(context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__classificationTest={effectiveRows:effectiveRows,setRules:function(value){classificationRules=value},setState:function(value){state=value}};})();'), context);
  context.window.__classificationTest.setRules(config);
  context.window.__classificationTest.setState({ overrides: [{
    id: 'manual', match: { date: '2026-09-04', merchant: 'Zelle WILLIAM TALBOT', amount: 41.46, occurrence: 1 },
    category: 'Personal Care', subcategory: 'Personal Care', originalCategory: 'Other', originalSubcategory: 'Other'
  }] });
  const row = context.window.__classificationTest.effectiveRows()[0];
  assert.equal(row.category, 'Personal Care');
  assert.equal(row.subcategory, 'Personal Care');
  assert.equal(row.overrideId, 'manual');
});

test('transaction rows can open an owner-only recategorization picker without changing totals', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'spending-transaction-recategorize.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  assert.match(source, /closest\('\.tx \.row'\)/);
  assert.match(source, /Recategorize transaction/);
  assert.match(source, /session\.role!==\'owner\'/);
  assert.match(source, /\/api\/spending\/category-overrides/);
  assert.match(source, /data-action="save">Apply category/);
  assert.match(source, /Choose a category, then select Apply category/);
  assert.doesNotMatch(source, /data-action="save" hidden/);
  assert.doesNotMatch(source, /Existing categories apply immediately/);
  assert.match(source, /More than one transaction matches this row, so BillsOS will not guess/);
  assert.match(source, /occurrence:t\.occurrence/);
  assert.match(source, /dataset\.txOccurrence/);
  assert.match(source, /fetch\('\/spending\/current\.json\?txcat='/);
  assert.match(route, /20260929financesimport2/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), /"spending", "current\.json"/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), /"spending", "vendor-category-rules\.json"/);
});

test('clicked duplicate row resolves to its stable occurrence', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'spending-transaction-recategorize.js'), 'utf8');
  const context = {
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    fetch() {},
  };
  const transactions = [
      { date: '2026-08-31', m: 'Wawa', a: 45, p: true, c: 'Financial / Fees', s: 'Cash withdrawal', n: 'ATM cash' },
      { date: '2026-08-31', m: 'Wawa', a: 45, p: true, c: 'Financial / Fees', s: 'Cash withdrawal', n: 'ATM cash' }
  ];
  const parent = { querySelectorAll() { return rows; } };
  const makeRow = () => ({
    children: [{ textContent: '08-31' }], dataset: {}, parentElement: parent,
    textContent: '08-31 Wawa ATM cash Pending $45.00',
    querySelector(selector) { return selector === '.amt' ? { textContent: '$45.00' } : null; }
  });
  const rows = [makeRow(), makeRow()];
  vm.createContext(context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__txTest={findTransaction:findTransaction,setSource:function(value){sourceRows=value}};})();'), context);
  context.window.__txTest.setSource(transactions);
  const found = context.window.__txTest.findTransaction(rows[1]);
  assert.equal(found.transaction.occurrence, 2);
});

test('chatbot accepts a unique merchant and decimal amount without a date or dollar sign', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'spending-assistant.js'), 'utf8');
  const context = {
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    setTimeout() {},
    fetch() {},
    T: [
      { date: '2026-08-28', m: 'Venmo', a: 5.50, p: false, c: 'Other', s: 'Other', n: '' },
      { date: '2026-08-28', m: 'Sephora', a: 27.72, p: false, c: 'Personal Care', s: 'Personal Care', n: '' }
    ]
  };
  vm.createContext(context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__categoryTest={suggest:suggest,setSession:function(value){session=value}};})();'), context);
  context.window.__categoryTest.setSession({ role: 'owner' });
  const result = context.window.__categoryTest.suggest('recategorize the 5.50 Venmo transaction to Personal Care');
  assert.equal(result.transaction.date, '2026-08-28');
  assert.equal(result.transaction.merchant, 'Venmo');
  assert.equal(result.transaction.amount, 5.50);
  assert.equal(result.category, 'Personal Care');
  assert.equal(result.subcategory, 'Personal Care');

  context.T.push({ date: '2026-08-27', m: 'Venmo', a: 5.50, p: false, c: 'Other', s: 'Other', n: '' });
  const ambiguous = context.window.__categoryTest.suggest('recategorize the 5.50 Venmo transaction to Personal Care');
  assert.match(ambiguous.error, /2 matching transactions.*Add the date/);
});
