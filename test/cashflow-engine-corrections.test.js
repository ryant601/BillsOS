const assert = require('assert');
const engine = require('../cashflow-engine');

function julyRows(oneTimeEvents) {
  return engine.rowsForMonth({ bills: [], income: [], oneTimeEvents }, 7, 0);
}

const positive = julyRows([{ id: 'positive', name: 'Balance correction', date: '2026-07-10', amount: 125, type: 'balance-correction', correctionDirection: 'add' }]);
assert.strictEqual(positive.length, 1);
assert.strictEqual(positive[0].amount, 125);
assert.strictEqual(positive[0].type, 'balance-correction');

const negative = julyRows([{ id: 'negative', name: 'Balance correction', date: '2026-07-11', amount: 75, type: 'balance-correction', correctionDirection: 'subtract' }]);
assert.strictEqual(negative.length, 1);
assert.strictEqual(negative[0].amount, -75);

const legacy = julyRows([{ id: 'legacy', name: 'Balance correction', date: '2026-07-12', amount: -40, type: 'bill', notes: 'Manual balance correction' }]);
assert.strictEqual(legacy.length, 1);
assert.strictEqual(legacy[0].amount, -40);

const opening = julyRows([{ id: 'opening', name: 'Beginning balance adjustment', date: '2026-07-13', amount: -55.25, type: 'balance-opening-adjustment' }]);
assert.strictEqual(opening.length, 1);
assert.strictEqual(opening[0].amount, -55.25);

const timestamped = julyRows([{ id: 'timestamped', name: 'Ending balance reconciliation', date: '2026-07-20', amount: 80, type: 'adjustment', notes: 'Requested balance $1,000. Saved 2026-07-21T00:04:00.000Z.' }]);
assert.strictEqual(timestamped.length, 1);
assert.strictEqual(timestamped[0].iso, '2026-07-20');

const model = engine.build({ bills: [], income: [], oneTimeEvents: [
  { id: 'add', name: 'Balance correction', date: '2026-07-10', amount: 100, type: 'balance-correction', correctionDirection: 'add' },
  { id: 'subtract', name: 'Balance correction', date: '2026-07-11', amount: 25, type: 'balance-correction', correctionDirection: 'subtract' }
]}, { firstBegin: 1000, floorNegative: false });

assert.strictEqual(model.months.july.end - model.months.july.begin, 75);

const reconciled = engine.build({ bills: [], income: [], oneTimeEvents: [
  { id: 'opening-aug', name: 'Beginning balance adjustment', date: '2026-08-01', amount: 250, type: 'balance-opening-adjustment', correctionDirection: 'add' },
  { id: 'ending-aug', name: 'Ending balance reconciliation', date: '2026-08-31', amount: 75, type: 'adjustment', correctionDirection: 'subtract' }
] }, { firstBegin: 1000, floorNegative: false });
assert.strictEqual(reconciled.months.august.end, reconciled.months.august.begin + 175);
assert.strictEqual(reconciled.months.september.begin, reconciled.months.august.end);
console.log('cashflow-engine correction tests passed');
