const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('calendar renderers warn only for nonnegative balances under 300', () => {
  const generated = read('generated-v5.html');
  assert.match(generated, /LOW_BALANCE_WARNING=300/);
  assert.match(generated, /warn=run>=0&&run<LOW_BALANCE_WARNING\?' is-warn'/);
  assert.match(generated, /negative=run<0\?' negative'/);
  assert.doesNotMatch(generated, /warn=run<1000/);

  ['amount-balance-hotfix.js', 'day-details-enhance.js'].forEach(file => {
    const source = read(file);
    assert.match(source, /LOW_BALANCE_WARNING = 300/);
    assert.match(source, /classList\.toggle\('negative', negative\)/);
    assert.match(source, /classList\.toggle\('is-warn', !negative && balance < LOW_BALANCE_WARNING\)/);
  });
});

test('compatibility enhancer uses the same threshold and preserves negative cards', () => {
  const source = read('action-log.js');
  assert.match(source, /LOW_BALANCE_WARNING=300/);
  assert.match(source, /if\(bal<0\)day\.classList\.add\('negative'\);else if\(bal>=0&&bal<LOW_BALANCE_WARNING\)day\.classList\.add\('low'\)/);
  assert.doesNotMatch(source, /bal<1000/);
});

test('changed client assets use the current cache builds', () => {
  assert.match(read('cache-coherence-preload.js'), /const BUILD = '20260904calendarrefresh1'/);
  assert.match(read('html-hotfix-loader.js'), /amount-balance-hotfix\.js\?v=20260826fy2027a/);
  assert.match(read('control.html'), /action-log\.js\?v=20260828rowcollapse1/);
  assert.match(read('control.html'), /control-preview\.js\?v=20260826transparent1/);
  assert.match(read('server.js'), /control-preview\.js\?v=20260826transparent1/);
});
