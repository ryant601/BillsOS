const assert = require('assert');
const editor = require('../billsos-balance-editor');

assert.strictEqual(editor.adjustmentFor(1000, 1125, 0), 125);
assert.strictEqual(editor.adjustmentFor(1125, 1075, 125), 75);
assert.strictEqual(editor.adjustmentFor(1075, 1000, 75), 0);
assert.strictEqual(editor.adjustmentFor(10.1, 10.2, 0), 0.1);
assert.strictEqual(editor.parseMoney('$1,234.56'), 1234.56);
assert.strictEqual(editor.eventId('2026-08-12', 'ending'), 'balance-ending-2026-08-12');

console.log('balance editor tests passed');
