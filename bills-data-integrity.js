'use strict';

const RULE_ID = '__billsos_system_rules__';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readRules(row) {
  try {
    return object(JSON.parse(row && row.notes || '{}'));
  } catch (_err) {
    return {};
  }
}

function timestamp(value) {
  const parsed = Date.parse(value && value.updatedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanCalendarState(value) {
  const state = object(value);
  return {
    dateAdjustments: object(state.dateAdjustments),
    amountAdjustments: object(state.amountAdjustments),
    completed: object(state.completed),
    updatedAt: state.updatedAt || null,
    revision: Number(state.revision || 0)
  };
}

function mergeTimedMap(existing, incoming) {
  const remote = object(existing);
  const local = object(incoming);
  const merged = clone(remote) || {};

  Object.keys(local).forEach(key => {
    const candidate = local[key];
    const current = remote[key];
    if (!current) {
      // Unsigned legacy local values are not allowed to materialize on the
      // canonical server merely because an old device opened the page.
      if (timestamp(candidate)) merged[key] = clone(candidate);
      return;
    }
    if (timestamp(candidate) > timestamp(current)) merged[key] = clone(candidate);
  });

  return merged;
}

function mergeCompleted(existing, incoming, sameRevision) {
  if (sameRevision) return clone(object(incoming)) || {};
  const merged = {};
  Object.keys(object(existing)).forEach(key => {
    if (existing[key]) merged[key] = 1;
  });
  Object.keys(object(incoming)).forEach(key => {
    if (incoming[key]) merged[key] = 1;
  });
  return merged;
}

function mergeCalendarState(existing, incoming, options = {}) {
  const remote = cleanCalendarState(existing);
  const local = cleanCalendarState(incoming);
  const sameRevision = Number(options.baseRevision) === remote.revision;
  const now = options.now || new Date().toISOString();
  const revision = options.incrementRevision
    ? remote.revision + 1
    : Math.max(remote.revision, local.revision);

  return {
    // A device that edited the current revision owns the complete adjustment
    // maps. Replacing them is important for date moves and resets: a merge-only
    // strategy can silently restore an older cross-month date after Save.
    dateAdjustments: sameRevision
      ? (clone(local.dateAdjustments) || {})
      : mergeTimedMap(remote.dateAdjustments, local.dateAdjustments),
    amountAdjustments: sameRevision
      ? (clone(local.amountAdjustments) || {})
      : mergeTimedMap(remote.amountAdjustments, local.amountAdjustments),
    completed: mergeCompleted(remote.completed, local.completed, sameRevision),
    updatedAt: options.incrementRevision ? now : (timestamp(local) > timestamp(remote) ? local.updatedAt : remote.updatedAt),
    revision
  };
}

function findSystemRow(data) {
  return (Array.isArray(data && data.oneTimeEvents) ? data.oneTimeEvents : [])
    .find(row => row && row.id === RULE_ID) || null;
}

function mergeSystemRow(existingRow, incomingRow, options = {}) {
  const currentRules = readRules(existingRow);
  const incomingRules = readRules(incomingRow);
  const currentState = currentRules.calendarState || {
    dateAdjustments: currentRules.dateAdjustments,
    amountAdjustments: currentRules.amountAdjustments,
    completed: currentRules.completed,
    updatedAt: existingRow && existingRow.updatedAt,
    revision: 0
  };
  const incomingState = options.calendarState || incomingRules.calendarState || {
    dateAdjustments: incomingRules.dateAdjustments,
    amountAdjustments: incomingRules.amountAdjustments,
    completed: incomingRules.completed,
    updatedAt: incomingRow && incomingRow.updatedAt,
    revision: 0
  };
  const mergedState = mergeCalendarState(currentState, incomingState, options);
  const rules = { ...currentRules, ...incomingRules };
  rules.calendarState = mergedState;
  rules.dateAdjustments = mergedState.dateAdjustments;
  rules.amountAdjustments = mergedState.amountAdjustments;
  rules.completed = mergedState.completed;

  return {
    ...(existingRow || {}),
    ...(incomingRow || {}),
    id: RULE_ID,
    name: incomingRow && incomingRow.name || existingRow && existingRow.name || 'BillsOS system rules',
    type: 'meta',
    amount: 0,
    date: null,
    notes: JSON.stringify(rules),
    updatedAt: mergedState.updatedAt
  };
}

function prepareFullWrite(existing, incoming) {
  const prepared = clone(object(incoming)) || {};
  prepared.bills = Array.isArray(prepared.bills) ? prepared.bills : [];
  prepared.oneTimeEvents = Array.isArray(prepared.oneTimeEvents) ? prepared.oneTimeEvents : [];
  prepared.income = Array.isArray(prepared.income) ? prepared.income : [];
  prepared.paymentSplits = Array.isArray(prepared.paymentSplits) && prepared.paymentSplits.length
    ? prepared.paymentSplits
    : clone(Array.isArray(existing && existing.paymentSplits) ? existing.paymentSplits : []);

  const currentSystem = findSystemRow(existing);
  const incomingIndex = prepared.oneTimeEvents.findIndex(row => row && row.id === RULE_ID);
  const incomingSystem = incomingIndex >= 0 ? prepared.oneTimeEvents[incomingIndex] : null;
  if (currentSystem || incomingSystem) {
    const merged = mergeSystemRow(currentSystem, incomingSystem);
    if (incomingIndex >= 0) prepared.oneTimeEvents[incomingIndex] = merged;
    else prepared.oneTimeEvents.push(merged);
    prepared.revision = cleanCalendarState(readRules(merged).calendarState).revision;
  }

  return prepared;
}

function applyCalendarStatePatch(existing, request, now) {
  const prepared = clone(object(existing)) || {};
  prepared.bills = Array.isArray(prepared.bills) ? prepared.bills : [];
  prepared.oneTimeEvents = Array.isArray(prepared.oneTimeEvents) ? prepared.oneTimeEvents : [];
  prepared.income = Array.isArray(prepared.income) ? prepared.income : [];
  const index = prepared.oneTimeEvents.findIndex(row => row && row.id === RULE_ID);
  const current = index >= 0 ? prepared.oneTimeEvents[index] : null;
  const merged = mergeSystemRow(current, null, {
    calendarState: request && request.calendarState,
    baseRevision: request && request.baseRevision,
    incrementRevision: true,
    now
  });
  if (index >= 0) prepared.oneTimeEvents[index] = merged;
  else prepared.oneTimeEvents.push(merged);
  prepared.revision = cleanCalendarState(readRules(merged).calendarState).revision;
  return prepared;
}

function sameSourceVersion(existing, incoming) {
  return String(existing && existing.updatedAt || '') === String(incoming && incoming.updatedAt || '');
}

module.exports = {
  RULE_ID,
  applyCalendarStatePatch,
  cleanCalendarState,
  findSystemRow,
  mergeCalendarState,
  prepareFullWrite,
  sameSourceVersion
};
