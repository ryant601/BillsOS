const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../cashflow-engine');

const mortgage = {
  id: 'mortgage-rocket',
  name: 'Mortgage (Rocket)',
  amount: 5866.48,
  dueDay: 15,
  frequency: 'monthly',
  startMonth: '2026-08',
  active: true,
  paymentSplits: [{ day: 13, amount: 2933.24 }]
};

test('mortgage names and legacy paymentSplits do not create background transactions', () => {
  const model = engine.build({
    bills: [mortgage],
    paymentSplits: [{ id: 'legacy-split', targetBillId: mortgage.id, dueDay: 27, amount: 2933.24 }],
    income: [],
    oneTimeEvents: []
  });
  const september = model.months.september.rows.filter(row => /Mortgage/.test(row.name));
  assert.deepEqual(september.map(row => ({ day: row.day, amount: row.amount, type: row.type })), [
    { day: 15, amount: -5866.48, type: '' }
  ]);
  assert.deepEqual(model.paymentSplits, []);
});

test('an explicitly saved visible mortgage payment affects the calendar once', () => {
  const model = engine.build({ bills: [], income: [], paymentSplits: [], oneTimeEvents: [
    { id: 'mortgage-visible', name: 'Sep Mortgage #1', type: 'adjustment', amount: -1500, date: '2026-08-27' }
  ] });
  assert.deepEqual(model.months.august.rows.map(row => ({ name: row.name, amount: row.amount, iso: row.iso })), [
    { name: 'Sep Mortgage #1', amount: -1500, iso: '2026-08-27' }
  ]);
});
