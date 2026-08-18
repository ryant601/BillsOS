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

test('derives two mortgage reserve policies without changing the actual payment', () => {
  const policies = engine.defaultReserves({ bills: [mortgage], income: [], oneTimeEvents: [] });
  assert.equal(policies.length, 2);
  assert.equal(policies[0].dueDay, 27);
  assert.equal(policies[0].targetMonthOffset, 1);
  close(policies[0].amount, 2933.24);
  assert.equal(policies[1].dueDay, 13);
  assert.equal(policies[1].targetMonthOffset, 0);
  close(policies[1].amount, 2933.24);
});

test('reserves reduce available cash and release against the September 15 mortgage', () => {
  const model = engine.build({ bills: [mortgage], income: [], oneTimeEvents: [] }, { firstBegin: 30000, floorNegative: false });
  const aug27 = model.balances.find(row => row.iso === '2026-08-27');
  const sep13 = model.balances.find(row => row.iso === '2026-09-13');
  const sep15 = model.balances.find(row => row.iso === '2026-09-15');
  const sepMortgage = model.months.september.rows.find(row => row.sourceId === mortgage.id);

  close(aug27.balance - aug27.availableBalance, 2933.24);
  close(sep13.balance - sep13.availableBalance, 5866.48);
  close(sepMortgage.amount, -5866.48);
  close(sepMortgage.reserveRelease, 5866.48);
  close(sepMortgage.availableAmount, 0);
  close(sep15.balance, sep15.availableBalance);
});
