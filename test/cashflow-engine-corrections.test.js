const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const openingBalance = reconciled.balances.find(row => row.iso === '2026-08-01');
assert.strictEqual(openingBalance.beginning, reconciled.months.august.begin + 250);

const absoluteOpening = engine.build({ bills: [], income: [], oneTimeEvents: [
  { id: 'opening-absolute', name: 'Beginning balance adjustment', date: '2026-08-14', amount: -506.71, type: 'balance-opening-adjustment', notes: 'Requested balance $160.11. Saved now.' }
] }, { firstBegin: 1000, floorNegative: false });
assert.strictEqual(absoluteOpening.balances.find(row => row.iso === '2026-08-14').beginning, 160.11);

const carryover = engine.build({ bills: [], income: [], oneTimeEvents: [
  { id: 'late-july', name: 'Late July correction', date: '2026-07-31', amount: 125, type: 'adjustment' },
  { id: 'aug-out', name: 'August bill', date: '2026-08-31', amount: 25, type: 'bill' }
] }, { floorNegative: false });
assert.strictEqual(carryover.months.july.begin, 2310);
assert.strictEqual(carryover.months.july.end, 2435);
assert.strictEqual(carryover.months.august.begin, carryover.months.july.end);
assert.strictEqual(carryover.months.september.begin, carryover.months.august.end);

const renderedCalendar = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');
assert.match(renderedCalendar, /prevEnd==null\?\(m&&m\.begin\|\|0\):prevEnd/);
const mortgageLoader = fs.readFileSync(path.join(__dirname, '..', 'mortgage-reserve-ui-loader.js'), 'utf8');
const applyBody = mortgageLoader.match(/async function apply\(\)\{([\s\S]*?)return true;/)[1];
assert.doesNotMatch(applyBody, /updateDayBalances|setChip|decorateDay/);
console.log('cashflow-engine correction tests passed');
