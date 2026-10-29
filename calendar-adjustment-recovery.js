'use strict';
const { applyCalendarStatePatch, findSystemRow } = require('./bills-data-integrity');

function recoverAdjustments(current, seed) {
  if (!seed || seed.schema !== 'billsos-adjustments-recovery-v1') throw new Error('Invalid adjustment recovery payload');
  const system = findSystemRow(current);
  const rules = system ? JSON.parse(system.notes || '{}') : {};
  const state = rules.calendarState || rules;
  return applyCalendarStatePatch(current, { baseRevision: -1, calendarState: {
    dateAdjustments: seed.dateAdjustments || {},
    amountAdjustments: seed.amountAdjustments || {},
    notesAdjustments: state.notesAdjustments || {},
    completed: state.completed || {}
  } });
}
module.exports = { recoverAdjustments };
