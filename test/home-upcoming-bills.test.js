'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'html-hotfix-loader.js'), 'utf8');
const functionSource = source.slice(source.indexOf('  function upcomingBills(data){'), source.indexOf('  function upcomingLabel('));

function fixedDate(today) {
  const RealDate = Date;
  return class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00'])); }
    static now() { return new RealDate(today + 'T12:00:00').getTime(); }
  };
}

function runUpcoming(today, byMonth, data) {
  const calls = [];
  const context = {
    Date: fixedDate(today),
    window: { BillsOSCashflow: { YEAR: 2026, rowsForMonth(_data, month, _begin, year) { calls.push([year, month]); return byMonth[year + '-' + month] || []; } } },
    DONE_KEY: 'done', AMOUNT_KEY: 'amount', DATE_KEY: 'date',
    isoDate: date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'),
    rowKey: row => String(row.iso || row.date || '') + '|' + row.name + '|' + row.amount,
    stateMap: () => ({}), data
  };
  vm.createContext(context);
  vm.runInContext(functionSource + '\\nthis.result = upcomingBills(this.data);', context);
  return { calls, result: context.result };
}

function billRows(year, month, startDay, count) {
  return Array.from({ length: count }, (_, index) => {
    const day = startDay + index;
    const iso = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    return { iso, name: 'Bill ' + index, amount: -10, sourceId: 'bill-' + index };
  });
}

test('Home shows every bill in the 14-day window, even when there are more than eight', () => {
  const rows = billRows(2026, 10, 7, 12);
  const data = { bills: rows.map(row => ({ id: row.sourceId, name: row.name, active: true })) };
  const { result } = runUpcoming('2026-10-06', { '2026-10': rows }, data);

  assert.equal(result.length, 12);
  assert.deepEqual(Array.from(result, row => row.name), rows.map(row => row.name));
  assert.ok(result.every(row => row.diff >= 0 && row.diff <= 14));
});

test('Home includes bills in the next calendar year when the 14-day window crosses December', () => {
  const december = [{ iso: '2026-12-31', name: 'December bill', amount: -25, sourceId: 'dec' }];
  const january = [{ iso: '2027-01-02', name: 'January bill', amount: -35, sourceId: 'jan' }];
  const data = { bills: [{ id: 'dec', name: 'December bill' }, { id: 'jan', name: 'January bill' }] };
  const { calls, result } = runUpcoming('2026-12-20', { '2026-12': december, '2027-1': january }, data);

  assert.deepEqual(calls, [[2026, 12], [2027, 1]]);
  assert.deepEqual(Array.from(result, row => row.name), ['December bill', 'January bill']);
});
