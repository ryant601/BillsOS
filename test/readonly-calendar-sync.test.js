const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('read-only snapshot preserves saved changes and revision', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-readonly-'));
  process.env.BILLS_DATA_DIR = dataDir;
  process.env.BILLS_READONLY_FILE = path.join(dataDir, 'calendar-readonly.json');
  process.env.BILLS_READONLY_EXPORT_ONLY = '1';
  const { writeReadonlySnapshot } = require('../readonly-calendar-preload');
  const calendar = {
    bills: [],
    oneTimeEvents: [
      { id: 'spending', name: 'Fund Spending Account', date: '2026-10-02', amount: 2400 },
      {
        id: '__billsos_system_rules__',
        notes: JSON.stringify({ calendarState: { revision: 42 } })
      }
    ],
    income: [],
    paymentSplits: [{ id: 'mortgage-1', amount: 2933.24 }],
    updatedAt: '2026-08-19T01:02:03.000Z'
  };

  const exported = writeReadonlySnapshot(calendar);

  assert.equal(exported.calculationBuild, 'cashflow-engine-20260826-transparent1');
  assert.equal(exported.revision, 42);
  assert.equal(exported.calendar.oneTimeEvents[0].amount, 2400);
  assert.deepEqual(exported.calendar.paymentSplits, calendar.paymentSplits);
  assert.equal(exported.calendar.updatedAt, calendar.updatedAt);
});
