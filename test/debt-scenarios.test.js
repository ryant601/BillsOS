'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { debtScenarios, register, projection } = require('../credit-card-manager');

const date = '2026-11-10';
const input = { extra: 250, lump: 100, buffer: 950, start: '2026-11-30', months: 3 };
const cards = [
  { id: 'high', sourceBillId: 'high-bill', name: 'High APR', balance: 2000, apr: 25, balanceAsOf: date },
  { id: 'small', sourceBillId: 'small-bill', name: 'Small balance', balance: 500, apr: 0, balanceAsOf: date }
];
function fixture() {
  return {
    bills: [
      { id: 'high-bill', name: 'High APR', amount: 75, dueDay: 20, startMonth: '2026-11' },
      { id: 'small-bill', name: 'Small balance', amount: 25, dueDay: 25, startMonth: '2026-11' }
    ],
    income: [],
    oneTimeEvents: [{ id: 'opening', name: 'Opening balance', type: 'balance-opening-adjustment',
      date: '2026-06-01', amount: 5000, requestedBalance: 5000 }]
  };
}

test('the same dated budget targets different cards and reports the cash cost', () => {
  const data = fixture();
  const [base, avalanche, snowball] = debtScenarios(data, cards, input, {}, date).scenarios;
  assert.equal(avalanche.payments[0].cardId, 'high');
  assert.equal(snowball.payments[0].cardId, 'small');
  assert.equal(avalanche.payments[0].amount, 350);
  assert.equal(avalanche.monthly[0].ending, base.monthly[0].ending - 350);
  assert.ok(avalanche.interest < base.interest);
  assert.ok(avalanche.interest < snowball.interest);
  assert.ok(snowball.accounts.find(card => card.name === 'Small balance').paidOn);
  assert.equal(data.oneTimeEvents.length, 1);
});

test('month-end rolls into short months and a later low day blocks adding a plan', () => {
  const data = fixture();
  data.oneTimeEvents.push({ id: 'later', name: 'Later expense', type: 'adjustment', date: '2027-07-01', amount: -2500 });
  const result = debtScenarios(data, cards, { ...input, start:'2027-01-31', months:2, buffer:1000 }, {}, date);
  const plan = result.scenarios[1];
  assert.deepEqual([...new Set(plan.payments.map(payment => payment.date))], ['2027-01-31', '2027-02-28']);
  assert.equal(plan.safe, false);
  assert.ok(plan.firstBelow >= '2027-07-01');
  assert.throws(() => debtScenarios(data, cards, { ...input, start:'2027-12-31' }, {}, date), /fewer months/);
});

test('saving the selected scenario uses the previewed cash projection, revalidates changes, and is retry safe', () => {
  let data = fixture(), writes = 0;
  const routes = new Map();
  register({ get(){}, post(url, handler){ routes.set(url, handler); } }, {
    readStore: () => ({ cards }), readBills: () => structuredClone(data),
    writeBills: value => { writes++; data = value; return data; }, currentDate: () => date
  });
  function post(path, body) {
    const res = { code:200, status(code){ this.code=code;return this; }, json(value){ this.value=value; } };
    routes.get('/api/credit-cards/debt-scenarios' + path)({body}, res);
    return res;
  }
  const planId = 'test-payment-plan-123';
  const bonusInput = { ...input, bonus: 1200, planId };
  const result = post('', bonusInput).value;
  const payload = {input:bonusInput, strategy:'snowball', fingerprint:result.fingerprint, planId};
  data.oneTimeEvents.push({id:'change',name:'New expense',type:'adjustment',date:'2026-12-01',amount:-10});
  assert.equal(post('/save', payload).code, 409);
  assert.equal(writes, 0);
  data.oneTimeEvents.pop();
  const scenario = result.scenarios.find(plan => plan.strategy === 'snowball');
  const saved = post('/save', payload).value;
  assert.equal(saved.saved, scenario.payments.length);
  assert.equal(saved.bonusAdded, true);
  assert.equal(data.oneTimeEvents.filter(event => event.debtPlanId === planId && event.type === 'income').length, 1);
  assert.equal(post('/save', payload).value.duplicate, true);
  assert.equal(writes, 1);
  assert.equal(projection(data).at(-1).ending, scenario.monthly.at(-1).ending);
});

test('a bonus comparison favors whole-card payoff for recurring relief and shows conditional future cash', () => {
  const result = debtScenarios(fixture(), cards, { ...input, extra: 0, lump: 600, bonus: 1000, months: 1 }, {}, date);
  const [base, avalanche, , relief] = result.scenarios;
  assert.equal(result.bonusEvent.amount, 1000);
  assert.equal(base.monthly[0].ending, 5900);
  assert.equal(avalanche.payments[0].cardId, 'high');
  assert.equal(relief.payments[0].cardId, 'small');
  assert.equal(relief.payments[0].amount, 475);
  assert.equal(relief.monthlyRelief, 25);
  assert.equal(relief.monthly[1].cashIfBillsStop, relief.monthly[1].ending + 25);
  assert.equal(relief.monthly[1].possibleRelief, 25);
  assert.equal(relief.monthly[0].ending, avalanche.monthly[0].ending);
});
