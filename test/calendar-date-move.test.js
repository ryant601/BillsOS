'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

function loadHotfixMatchers() {
  const source = read('amount-balance-hotfix.js');
  const start = source.indexOf('function keyIdentity');
  const end = source.indexOf('function oneDates');
  assert.ok(start > -1 && end > start, 'expected matching helpers in amount-balance-hotfix.js');
  const context = { Number, Date, Object };
  vm.runInNewContext(source.slice(start, end), context);
  return context;
}

test('calendar date matching is scoped to one occurrence month', () => {
  const generated = read('generated-v5.html');
  const hotfix = read('amount-balance-hotfix.js');
  assert.match(generated, /function occurrenceMonth\(key,edit\)/);
  assert.match(generated, /occurrenceMonth\(c,map\[c\]\)===month/);
  assert.match(hotfix, /function occurrenceMonth\(key, edit\)/);
  assert.match(hotfix, /occurrenceMonth\(candidate, map\[candidate\]\) === month/);
});

test('calendar rendering can carry a source row into a different month', () => {
  const generated = read('generated-v5.html');
  assert.match(generated, /function allModelRows\(model\)/);
  assert.match(generated, /rows=applyCardEdits\(allRows,month,year\)/);
  assert.match(generated, /String\(row\.iso\|\|row\.date\|\|''\)\.slice\(0,7\)===mv/);
});

test('a September Discover move does not relocate August or October Discover', () => {
  const { matchingOverride } = loadHotfixMatchers();
  const dateMap = {
    '2026-09-01|Discover|-125': {
      date: '2026-09-09',
      originalDate: '2026-09-01',
      status: 'moved',
      updatedAt: '2026-09-03T01:00:00.000Z'
    }
  };

  assert.equal(matchingOverride(dateMap, '2026-09-01|Discover|-125').date, '2026-09-09');
  assert.equal(matchingOverride(dateMap, '2026-09-01|Discover|-125.00').date, '2026-09-09');
  assert.equal(matchingOverride(dateMap, '2026-08-09|Discover|-125'), null);
  assert.equal(matchingOverride(dateMap, '2026-10-09|Discover|-125'), null);
});

test('an in-month Discover move keeps the month starting balance and later ending balance', () => {
  const start = 4974.92;
  function closeDays(byDay) {
    let run = start;
    const out = {};
    for (let day = 1; day <= 10; day++) {
      const begin = run;
      (byDay[day] || []).forEach(row => { run += row.amount; });
      out[day] = { begin, end: run };
    }
    return out;
  }

  const before = closeDays({
    1: [{ name: 'Discover', amount: -125 }],
    9: [{ name: 'Other', amount: -40 }]
  });
  const after = closeDays({
    1: [],
    9: [{ name: 'Other', amount: -40 }, { name: 'Discover', amount: -125 }]
  });

  assert.equal(after[1].begin, before[1].begin);
  assert.equal(after[1].end, before[1].end + 125);
  assert.equal(after[8].end, before[8].end + 125);
  assert.equal(after[9].end, before[9].end);
  assert.equal(after[10].end, before[10].end);
});

test('the calendar projects a funding edit from the saved API snapshot with a stale browser cache', async () => {
  const { applyCalendarStatePatch } = require('../bills-data-integrity');
  const key = '2027-03-19|Fund Spending Account|-2250';
  const transfer = {id:'fund',name:'Fund Spending Account',date:'2027-03-19',amount:-2250,type:'transfer'};
  const stamp = '2026-11-10T14:00:00Z';
  const data = applyCalendarStatePatch({oneTimeEvents:[transfer]}, {baseRevision:-1,calendarState:{
    amountAdjustments:{[key]:{amount:2000,updatedAt:stamp}},
    dateAdjustments:{[key]:{date:'2027-04-02',originalDate:transfer.date,updatedAt:stamp}}
  }}, stamp);
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname,'..','generated-v5.html'),'utf8');
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]
    .replace('bindRiskFloor();\nload();','window.testProjection={loadBillsData,applyCardEdits};');
  const window = {};
  const localStorage = {getItem:() => JSON.stringify({[key]:{amount:2250,date:transfer.date,updatedAt:'2026-11-09T14:00:00Z'}})};
  const sessionStorage = {getItem:() => null};
  new Function('window','document','localStorage','sessionStorage','fetch',script)(
    window,{getElementById:()=>null},localStorage,sessionStorage,async()=>({ok:true,json:async()=>data}));
  await window.testProjection.loadBillsData();
  const rows = [{...transfer,iso:transfer.date}];
  assert.equal(window.testProjection.applyCardEdits(rows,3,2027).length,0);
  const [funding] = window.testProjection.applyCardEdits(rows,4,2027);
  assert.equal(funding.iso,'2027-04-02');
  assert.equal(funding.amount,-2000);
});
