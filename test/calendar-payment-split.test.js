const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const split = require('../calendar-payment-split');
const engine = require('../cashflow-engine');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('a recurring mortgage occurrence becomes two visible payments with the same total', () => {
  const source = {
    bills: [{ id: 'mortgage', name: 'Mortgage (Rocket)', amount: 3000, dueDay: 15, frequency: 'monthly', startMonth: '2026-09', active: true }],
    income: [{ id: 'income', name: 'Paycheck', amount: 2000, schedule: 'manual', startDate: '2026-09-20', active: true }],
    oneTimeEvents: [],
    paymentSplits: [],
    updatedAt: '2026-09-29T12:00:00.000Z'
  };
  const result = split.applySplit(source, {
    name: 'Mortgage (Rocket)',
    originalDate: '2026-09-15',
    originalAmount: 3000,
    totalAmount: 3000,
    batchId: 'mortgage-september',
    parts: [{ date: '2026-09-01', amount: 1500 }, { date: '2026-09-24', amount: 1500 }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.sourceKind, 'recurring bill');
  assert.equal(result.data.updatedAt, source.updatedAt);
  assert.deepEqual(result.data.bills[0].excludedDates, ['2026-09-15']);
  assert.equal(result.data.paymentSplits.length, 0);
  const rows = engine.rowsForMonth(result.data, 9, 0, 2026).filter(row => /Mortgage/.test(row.name));
  assert.deepEqual(rows.map(row => ({ date: row.iso, name: row.name, amount: row.amount })), [
    { date: '2026-09-01', name: 'Mortgage (Rocket) · 1/2', amount: -1500 },
    { date: '2026-09-24', name: 'Mortgage (Rocket) · 2/2', amount: -1500 }
  ]);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), -3000);
  const before = engine.build(source, { firstBegin: 2000 }).balances.filter(row => row.iso.startsWith('2026-09'));
  const after = engine.build(result.data, { firstBegin: 2000 }).balances.filter(row => row.iso.startsWith('2026-09'));
  assert.equal(Math.min(...before.map(row => row.balance)), -1000);
  assert.equal(Math.min(...after.map(row => row.balance)), 500);
  assert.equal(before.at(-1).balance, after.at(-1).balance);
});

test('a large one-time payment can be split without duplicating its original row', () => {
  const result = split.applySplit({ bills: [], income: [], oneTimeEvents: [
    { id: 'large-charge', name: 'Large repair', date: '2026-10-10', amount: -1200, type: 'adjustment', category: 'Housing' }
  ] }, {
    name: 'Large repair', originalDate: '2026-10-10', originalAmount: 1200, totalAmount: 1200, batchId: 'repair-split',
    parts: [{ date: '2026-10-10', amount: 400 }, { date: '2026-10-24', amount: 800 }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.sourceKind, 'one-time item');
  assert.equal(result.data.oneTimeEvents.some(row => row.id === 'large-charge'), false);
  assert.deepEqual(result.rows.map(row => row.amount), [-400, -800]);
  assert.ok(result.rows.every(row => row.category === 'Housing'));
});

test('a split is rejected unless every visible part preserves the original total', () => {
  const source = { bills: [{ name: 'Mortgage', amount: 3000, dueDay: 15, frequency: 'monthly' }], income: [], oneTimeEvents: [] };
  const result = split.applySplit(source, {
    name: 'Mortgage', originalDate: '2026-09-15', originalAmount: 3000, totalAmount: 3000,
    parts: [{ date: '2026-09-01', amount: 1400 }, { date: '2026-09-15', amount: 1500 }]
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /add up to the original total/);
  assert.deepEqual(source.bills[0].excludedDates, undefined);
});

test('Calendar loads the split helper before the card editor and versions both assets', () => {
  const html = read('generated-v5.html');
  assert.ok(html.indexOf('id="billsosCalendarPaymentSplit"') < html.indexOf('id="billsosCardEditor"'));
  const editor = read('billsos-card-editor.js');
  assert.match(editor, /data-action="split"/);
  assert.match(editor, /Split saved ·/);
  assert.match(editor, /max-height:calc\(100vh - 24px\);overflow:auto/);
  assert.match(editor, /@media\(max-width:420px\)\{\.billsosSplitRow\{grid-template-columns:1fr\}\}/);
  const preload = read('cache-coherence-preload.js');
  assert.match(preload, /calendar-payment-split\.js/);
  assert.match(preload, /const BUILD = '20260929calendarlist1'/);
});
