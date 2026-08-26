const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../cashflow-engine');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('empty and meta-only data have a zero balance and no transactions', () => {
  const empty = engine.build({ bills: [], income: [], oneTimeEvents: [], paymentSplits: [] });
  const meta = engine.build({ bills: [], income: [], paymentSplits: [{ amount: 9999 }], oneTimeEvents: [
    { id: '__billsos_system_rules__', type: 'meta', amount: 9999, date: '2026-10-10', notes: JSON.stringify({ spendingFunding: { amount: 9999 }, sweep: { amount: 9999 } }) },
    { id: '__billsos_action_log__', type: 'meta', amount: 8888, date: '2026-10-11' }
  ] });
  assert.equal(empty.events.length, 0);
  assert.equal(meta.events.length, 0);
  assert.equal(empty.months.december.end, 0);
  assert.equal(meta.months.december.end, 0);
  assert.equal(engine.FIRST_BEGIN, 0);
});

test('system completion state is balance-neutral', () => {
  const source = { bills: [{ id: 'visible', name: 'Visible bill', amount: 100, dueDay: 10, frequency: 'monthly', startMonth: '2026-10' }], income: [], oneTimeEvents: [
    { id: '__billsos_system_rules__', type: 'meta', amount: 0, date: null, notes: JSON.stringify({ calendarState: { completed: { '2026-10-10|Visible bill|-100': 1 }, dateAdjustments: {}, amountAdjustments: {} } }) }
  ] };
  assert.deepEqual(engine.rowsForMonth(source, 10).map(row => ({ name: row.name, amount: row.amount, day: row.day })), [
    { name: 'Visible bill', amount: -100, day: 10 }
  ]);
});

test('notes, missing schedule anchors, and legacy payment splits cannot materialize cash flow', () => {
  const data = {
    bills: [{ id: 'no-due', name: 'No due day', amount: 50, frequency: 'monthly' }],
    income: [
      { id: 'no-anchor-biweekly', name: 'Unanchored biweekly', amount: 1000, schedule: 'biweekly' },
      { id: 'no-anchor-monthly', name: 'Unanchored monthly', amount: 1000, schedule: 'monthly' }
    ],
    oneTimeEvents: [{ id: 'notes-only', name: 'Notes-only item', amount: 500, notes: 'Maybe 2026-10-15' }],
    paymentSplits: [{ id: 'hidden-split', amount: 500, dueDay: 15 }]
  };
  assert.deepEqual(engine.rowsForMonth(data, 10), []);
});

test('active balance paths contain no hard-coded baselines or mortgage policy rows', () => {
  assert.doesNotMatch(read('cashflow-engine.js'), /policy-mortgage|JULY_REBASE|FIRST_BEGIN=3671/);
  assert.doesNotMatch(read('readonly-calendar-preload.js'), /policy-mortgage|defaultPaymentSplits/);
  assert.doesNotMatch(read('package.json'), /mortgage-reserve-ui-loader/);
  assert.doesNotMatch(read('amount-balance-hotfix.js'), /JULY_REBASE|FIRST_BEGIN = 3671/);
  assert.doesNotMatch(read('day-details-enhance.js'), /JULY_REBASE|FIRST_BEGIN = 3671/);
  assert.doesNotMatch(read('day-details-enhance.js'), /isCalculationOnly\(item\).*balance correction|isCalculationOnly\(item\).*spending account funding/i);
  assert.match(read('day-details-enhance.js'), /function isCalculationOnly\(item\) \{ return isActionLogMeta\(item\); \}/);
});
