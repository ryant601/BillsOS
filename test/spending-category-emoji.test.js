'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSpendingCategoryStore } = require('../spending-category-overrides');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-category-emoji-'));
  const snapshotPath = path.join(dir, 'current.json');
  fs.writeFileSync(snapshotPath, JSON.stringify({ transactions: [
    { date: '2026-09-09', m: 'Happy Paws Vet', a: 84.25, p: false, c: 'Other', s: 'Other', n: '' }
  ] }));
  return createSpendingCategoryStore({ dataDir: dir, snapshotPath });
}

test('new spending categories persist their chosen emoji', () => {
  const store = fixture();
  store.save({
    transaction: { date: '2026-09-09', merchant: 'Happy Paws Vet', amount: 84.25, pending: false, note: '', occurrence: 1 },
    category: 'Pets', subcategory: 'Veterinary', createCategory: true, emoji: '🐾'
  }, 'owner');
  assert.deepEqual(store.publicState().categories, [{
    category: 'Pets', subcategory: 'Veterinary', emoji: '🐾',
    createdAt: store.publicState().categories[0].createdAt, createdBy: 'owner'
  }]);
});

test('older saved categories without emoji remain readable', () => {
  const store = fixture();
  fs.writeFileSync(store.filePath, JSON.stringify({
    schemaVersion: 1, overrides: [], categories: [{ category: 'Home', subcategory: 'Supplies' }], history: [], updatedAt: null
  }));
  assert.equal(store.publicState().categories[0].emoji, null);
});

test('emoji helper provides deterministic suggestions and is wired into spending', () => {
  const helper = fs.readFileSync(path.join(__dirname, '..', 'spending-category-emoji.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'spending-route-preload.js'), 'utf8');
  const recategorize = fs.readFileSync(path.join(__dirname, '..', 'spending-transaction-recategorize.js'), 'utf8');
  assert.match(helper, /pet\|vet\|animal\|dog\|cat/);
  assert.match(helper, /travel\|flight\|airline\|hotel\|vacation/);
  assert.match(helper, /data-role','new-emoji'/);
  assert.match(recategorize, /createCategory:!!creating/);
  assert.match(route, /20260929financesimport2/);
  assert.match(route, /spending-category-emoji\.js/);
});
