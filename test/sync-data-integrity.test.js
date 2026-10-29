'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  applyCalendarStatePatch,
  findSystemRow,
  sameSourceVersion
} = require('../bills-data-integrity');

function systemState(data) {
  return JSON.parse(findSystemRow(data).notes).calendarState;
}

test('stale device calendar state cannot overwrite a newer funding refinement', () => {
  const existing = {
    bills: [{ id: 'bill-1', name: 'Mortgage', amount: 5866.48 }],
    oneTimeEvents: [
      { id: 'one-1', name: 'Deck #1', date: '2026-08-24', amount: -148, type: 'adjustment' },
      {
        id: '__billsos_system_rules__',
        name: 'BillsOS system rules',
        type: 'meta',
        amount: 0,
        date: null,
        notes: JSON.stringify({
          calendarState: {
            dateAdjustments: {},
            amountAdjustments: {
              '2026-08-21|Fund Spending Account|-1500': {
                amount: 2250,
                updatedAt: '2026-08-22T13:10:00.000Z'
              }
            },
            completed: { paid: 1 },
            updatedAt: '2026-08-22T13:10:00.000Z',
            revision: 12
          }
        })
      }
    ],
    income: [{ id: 'income-1', name: 'Paycheck', amount: 1000 }],
    paymentSplits: [{ id: 'mortgage-1', amount: 2933.24 }],
    revision: 12,
    updatedAt: '2026-08-22T13:10:00.000Z'
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 7,
    calendarState: {
      dateAdjustments: {},
      amountAdjustments: {
        '2026-08-21|Fund Spending Account|-1500': {
          amount: 1500,
          updatedAt: '2026-08-22T12:00:00.000Z'
        },
        '2026-09-04|Fund Spending Account|-1500': {
          amount: 2000,
          updatedAt: '2026-08-22T13:11:00.000Z'
        }
      },
      completed: {},
      revision: 7
    }
  }, '2026-08-22T13:12:00.000Z');

  const state = systemState(patched);
  assert.equal(state.amountAdjustments['2026-08-21|Fund Spending Account|-1500'].amount, 2250);
  assert.equal(state.amountAdjustments['2026-09-04|Fund Spending Account|-1500'].amount, 2000);
  assert.deepEqual(state.completed, { paid: 1 });
  assert.equal(state.revision, 13);
  assert.equal(patched.revision, 13);
});

test('calendar-only sync preserves one-time events, bills, income, and payment splits', () => {
  const existing = {
    bills: [{ id: 'bill-1', name: 'Existing bill' }],
    oneTimeEvents: [
      { id: 'one-a', name: 'One-time A', date: '2026-08-24', amount: -148 },
      { id: 'one-b', name: 'One-time B', date: '2026-08-26', amount: -250 }
    ],
    income: [{ id: 'income-1', name: 'Paycheck' }],
    paymentSplits: [{ id: 'split-1', amount: 500 }],
    revision: 0,
    updatedAt: '2026-08-22T12:00:00.000Z'
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 0,
    calendarState: {
      dateAdjustments: {},
      amountAdjustments: {
        funding: { amount: 2000, updatedAt: '2026-08-22T13:00:00.000Z' }
      },
      completed: {},
      revision: 0
    }
  }, '2026-08-22T13:00:01.000Z');

  assert.deepEqual(patched.bills, existing.bills);
  assert.deepEqual(patched.oneTimeEvents.filter(row => row.id !== '__billsos_system_rules__'), existing.oneTimeEvents);
  assert.deepEqual(patched.income, existing.income);
  assert.deepEqual(patched.paymentSplits, existing.paymentSplits);
});

test('calendar note override survives a stale update and an older client patch', () => {
  const key = '2026-10-17|Mortgage|-5866.5';
  const existing = { bills: [], income: [], oneTimeEvents: [{ id: '__billsos_system_rules__', notes: JSON.stringify({ calendarState: { revision: 4, notesAdjustments: { [key]: { notes: 'Call lender', updatedAt: '2026-10-15T12:00:00Z' } } } }) }] };
  const stale = applyCalendarStatePatch(existing, { baseRevision: 2, calendarState: { notesAdjustments: { [key]: { notes: 'Old note', updatedAt: '2026-10-15T11:00:00Z' } } } }, '2026-10-15T13:00:00Z');
  assert.equal(systemState(stale).notesAdjustments[key].notes, 'Call lender');
  const olderClient = applyCalendarStatePatch(stale, { baseRevision: 5, calendarState: { dateAdjustments: {}, amountAdjustments: {}, completed: {} } }, '2026-10-15T14:00:00Z');
  assert.equal(systemState(olderClient).notesAdjustments[key].notes, 'Call lender');
});

test('current-revision sync makes an October-to-September move authoritative', () => {
  const key = '2026-10-02|Auto Insurance|-169';
  const existing = {
    bills: [],
    income: [],
    oneTimeEvents: [{
      id: '__billsos_system_rules__',
      name: 'BillsOS system rules',
      type: 'meta',
      amount: 0,
      date: null,
      notes: JSON.stringify({
        calendarState: {
          dateAdjustments: {
            [key]: {
              date: '2026-10-01',
              originalDate: '2026-10-02',
              updatedAt: '2026-09-30T16:00:00.000Z'
            }
          },
          amountAdjustments: {},
          completed: {},
          revision: 8
        }
      })
    }],
    revision: 8
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 8,
    calendarState: {
      dateAdjustments: {
        [key]: {
          date: '2026-09-30',
          originalDate: '2026-10-02',
          updatedAt: '2026-09-30T15:59:00.000Z'
        }
      },
      amountAdjustments: {},
      completed: {},
      revision: 8
    }
  }, '2026-09-30T16:01:00.000Z');

  assert.equal(systemState(patched).dateAdjustments[key].date, '2026-09-30');
});

test('a timestamped reset defeats an older move even from a stale revision', () => {
  const key = '2026-09-30|Apple Card|-95';
  const existing = {
    bills: [], income: [], revision: 9,
    oneTimeEvents: [{
      id: '__billsos_system_rules__', name: 'BillsOS system rules', type: 'meta', amount: 0, date: null,
      notes: JSON.stringify({calendarState:{
        dateAdjustments:{[key]:{date:'2026-10-02',originalDate:'2026-09-30',updatedAt:'2026-09-30T16:00:00.000Z'}},
        amountAdjustments:{}, completed:{}, revision:9
      }})
    }]
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 8,
    calendarState:{
      dateAdjustments:{[key]:{deleted:true,originalDate:'2026-09-30',updatedAt:'2026-09-30T16:01:00.000Z'}},
      amountAdjustments:{}, completed:{}, revision:8
    }
  }, '2026-09-30T16:01:01.000Z');

  assert.equal(systemState(patched).dateAdjustments[key].deleted, true);
  assert.equal(systemState(patched).dateAdjustments[key].date, undefined);
});

test('full-document saves reject a stale source version before replacement', () => {
  const current = { updatedAt: '2026-08-22T13:10:23.154Z' };
  const stalePhone = { updatedAt: '2026-08-22T12:49:30.548Z' };
  assert.equal(sameSourceVersion(current, stalePhone), false);
  assert.equal(sameSourceVersion(current, { updatedAt: current.updatedAt }), true);
});

test('browser calendar sync uses the calendar-state-only endpoint', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-cross-device-sync-v2.js'), 'utf8');
  assert.match(source, /fetch\('\/api\/bills\/calendar-state',\{method:'PATCH'/);
  assert.doesNotMatch(source, /fetch\('\/api\/bills',\{method:'POST'/);
  assert.doesNotMatch(source, /RECENT_LOCAL_MS|localContributed/);
});

test('browser calendar sync never clears a newer in-flight local change', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-cross-device-sync-v2.js'), 'utf8');
  assert.match(source, /var changeVersion=0,syncedVersion=0/);
  assert.match(source, /var sentVersion=changeVersion,succeeded=false/);
  assert.match(source, /dirty=changeVersion>syncedVersion/);
  assert.match(source, /if\(!dirty\)\{applyCloud\(remote,false\);clearPending\(\)\}/);
  assert.match(source, /if\(succeeded&&dirty&&!keepalive\).*postState\(localState\(\),false\)/s);
  assert.match(source, /changeVersion\+\+;dirty=true/);
});

test('browser calendar sync keeps an unsynced local move across reload', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-cross-device-sync-v2.js'), 'utf8');
  assert.match(source, /PENDING_KEY='billsos-calendar-sync-pending-v1'/);
  assert.match(source, /sessionStorage.setItem\(PENDING_KEY/);
  assert.match(source, /sessionStorage.removeItem\(PENDING_KEY/);
  assert.match(source, /function restorePending/);
  assert.match(source, /restorePending\(\);reconcile\(true\)/);
  assert.match(source, /if\(dirty\)\{initialized=true;await postState/);
  assert.match(source, /rememberPending\(\);schedulePush\(\)/);
});

test('browser calendar sync polls the canonical server frequently', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-cross-device-sync-v2.js'), 'utf8');
  assert.match(source, /setInterval\(function\(\)\{if\(!document\.hidden\)reconcile\(false\)\},5000\)/);
});

test('a current-revision empty map cannot erase saved amounts or dates', () => {
  const key = '2026-10-30|Payment|-100';
  const saved = { dateAdjustments: { [key]: { date: '2026-10-29', updatedAt: '2026-10-20T00:00:00Z' } },
    amountAdjustments: { [key]: { amount: 75, updatedAt: '2026-10-20T00:00:00Z' } }, revision: 10 };
  const current = { oneTimeEvents: [{ id: '__billsos_system_rules__', notes: JSON.stringify({calendarState: saved}) }] };
  const next = applyCalendarStatePatch(current, { baseRevision: 10, calendarState: { dateAdjustments: {}, amountAdjustments: {} } });
  assert.deepEqual(systemState(next).dateAdjustments, saved.dateAdjustments);
  assert.deepEqual(systemState(next).amountAdjustments, saved.amountAdjustments);
});

test('legacy cleanup preserves sync metadata and recovery preserves newer resets and rows', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '..', 'action-log.js'), 'utf8');
  const context = { LEGACY_META_IDS: { __billsos_action_log__: 1 } };
  const start = source.indexOf('  function stripLegacyMetaRows');
  const end = source.indexOf('  function installBillsDataGuard', start);
  vm.runInNewContext(source.slice(start, end), context);
  assert.doesNotMatch(source, /LEGACY_META_IDS=\{[^}]*__billsos_system_rules__/);
  const system = { id: '__billsos_system_rules__', notes: JSON.stringify({calendarState:{revision:4,
    dateAdjustments:{x:{deleted:true,updatedAt:'2026-10-29T00:00:00Z'}},amountAdjustments:{},completed:{paid:1}}}) };
  const current = { bills: [{name:'Preserve me',amount:12}], oneTimeEvents: [system, {id:'new-payment',amount:-42}], income: [] };
  assert.equal(context.stripLegacyMetaRows(current).data.oneTimeEvents.length, 2);
  const { recoverAdjustments } = require('../calendar-adjustment-recovery');
  const restored = recoverAdjustments(current, {schema:'billsos-adjustments-recovery-v1',
    dateAdjustments:{x:{date:'2026-10-25',updatedAt:'2026-10-20T00:00:00Z'}},
    amountAdjustments:{y:{amount:77,updatedAt:'2026-10-20T00:00:00Z'}}});
  assert.equal(systemState(restored).dateAdjustments.x.deleted,true);
  assert.equal(systemState(restored).amountAdjustments.y.amount,77);
  assert.equal(systemState(restored).completed.paid,1);
  assert.deepEqual(restored.bills,current.bills);
  assert.deepEqual(restored.oneTimeEvents[1],current.oneTimeEvents[1]);
});

test('recommendation preferences survive stale clients and restore without changing payments', () => {
 const source={bills:[{id:'bill',name:'Card',amount:100}],oneTimeEvents:[],income:[],paymentSplits:[]};
 const saved=applyCalendarStatePatch(source,{baseRevision:-1,calendarState:{recommendationPreferences:{proposal:{label:'Card',updatedAt:'2026-10-29T20:00:00Z'}}}});
 const stale=applyCalendarStatePatch(saved,{baseRevision:-1,calendarState:{amountAdjustments:{}}});
 assert.equal(systemState(stale).recommendationPreferences.proposal.label,'Card');
 const restored=applyCalendarStatePatch(stale,{baseRevision:-1,calendarState:{recommendationPreferences:{proposal:{deleted:true,updatedAt:'2026-10-29T20:01:00Z'}}}});
 const late=applyCalendarStatePatch(restored,{baseRevision:-1,calendarState:{recommendationPreferences:{proposal:{updatedAt:'2026-10-29T20:00:00Z'}}}});
 assert.equal(systemState(late).recommendationPreferences.proposal.deleted,true);
 assert.deepEqual(late.bills,source.bills);
 assert.deepEqual(late.income,source.income);
});
