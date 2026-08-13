const assert = require('assert');
const calculatorApi = require('../billsos-sidebar-calculator');

assert.strictEqual(calculatorApi.operate(10, '+', 2.5), 12.5);
assert.strictEqual(calculatorApi.operate(10, '−', 2.5), 7.5);
assert.strictEqual(calculatorApi.operate(10, '×', 2.5), 25);
assert.strictEqual(calculatorApi.operate(10, '÷', 4), 2.5);
assert.ok(Number.isNaN(calculatorApi.operate(10, '÷', 0)));

const calculator = calculatorApi.createCalculator();
['1', '2', '.', '5', '+', '7', '.', '5', '='].forEach(key => calculator.press(key));
assert.strictEqual(calculator.result().display, '20');
calculator.press('×'); calculator.press('3'); calculator.press('=');
assert.strictEqual(calculator.result().display, '60');
calculator.press('C'); calculator.press('9'); calculator.press('⌫');
assert.strictEqual(calculator.result().display, '0');

const fs = require('fs');
const source = fs.readFileSync(require.resolve('../billsos-sidebar-calculator'), 'utf8');
assert.ok(source.includes('class="bo-calc-heading"'));
assert.ok(!source.includes('bo-calc-toggle'));
assert.ok(!source.includes('aria-expanded'));

console.log('sidebar calculator tests passed');
