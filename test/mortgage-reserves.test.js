const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../cashflow-engine');

const mortgage = {
  id: 'mortgage-rocket',
  name: 'Mortgage (Rocket)',
  amount: 5866.48,
  dueDay: 15,
  frequency: 'monthly',
  active: true
};

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} should be close to ${expected}`);
}

test('derives two real mortgage payments', () => {
  const policies = engine.defaultPaymentSplits({ bills: [mortgage], income: [], oneTimeEvents: [] });
  assert.equal(policies.length, 2);
  assert.equal(policies[0].dueDay, 27);
  assert.equal(policies[0].targetMonthOffset, 1);
  close(policies[0].amount, 2933.24);
  assert.equal(policies[1].dueDay, 13);
  assert.equal(policies[1].targetMonthOffset, 0);
  close(policies[1].amount, 2933.24);
});

test('calendar replaces the 15th mortgage with payments on the 13th and 27th', () => {
  const model = engine.build({ bills: [mortgage], income: [], oneTimeEvents: [] }, { firstBegin: 30000, floorNegative: false });
  const september = model.months.september.rows.filter(row => /Mortgage \(Rocket\)/.test(row.name));
  assert.equal(september.length, 2);
  assert.deepEqual(september.map(row => row.day), [13, 27]);
  close(september[0].amount, -2933.24);
  close(september[1].amount, -2933.24);
  assert.equal(september.some(row => row.day === 15), false);
  assert.equal(september[0].targetMonth, '2026-09');
  assert.equal(september[1].targetMonth, '2026-10');
});

test('split payments preserve the total monthly mortgage cash outflow after August transition', () => {
  const model = engine.build({ bills: [mortgage], income: [], oneTimeEvents: [] }, { firstBegin: 30000, floorNegative: false });
  const septemberMortgageOutflow = model.months.september.rows
    .filter(row => row.type === 'mortgage-split-payment')
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  close(septemberMortgageOutflow, 5866.48);
});
