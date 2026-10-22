'use strict';

function cleanNote(value) {
  return String(value || '')
    .replace(/\bImported from (?:the )?existing calendar\.?\s*(?:Review schedule\.?\s*|Dates seen:\s*[\d,\s-]*\.?\s*)?/gi, '')
    .replace(/^\s*[·;|]\s*|\s*[·;|]\s*$/g, '').trim();
}

function cleanCalendarNotes(data) {
  let changed = false;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    Object.keys(value).forEach(key => {
      if (key === 'notes' && typeof value[key] === 'string') {
        if (value.id === '__billsos_system_rules__') {
          try {
            const rules = JSON.parse(value[key]);
            const before = JSON.stringify(rules);
            visit(rules);
            if (JSON.stringify(rules) !== before) value[key] = JSON.stringify(rules);
          } catch (_) {}
        } else {
          const cleaned = cleanNote(value[key]);
          if (cleaned !== value[key]) { value[key] = cleaned; changed = true; }
        }
      } else visit(value[key]);
    });
  }
  visit(data);
  return changed;
}
module.exports = { cleanNote, cleanCalendarNotes };
