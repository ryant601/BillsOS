const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');

test('calendar groups months beneath accessible 2026 and 2027 year pills', () => {
  assert.match(html, /years=\[2026,2027\]/);
  assert.match(html, /class=\"year-pill\"/);
  assert.match(html, /aria-expanded=/);
  assert.match(html, /aria-controls=\"year-months-/);
  assert.match(html, /class=\"year-months\"/);
  assert.match(html, /list\.hidden=!expanded/);
});

test('year expansion is remembered and the active year opens automatically', () => {
  assert.match(html, /YEAR_NAV_KEY='bills-year-nav-v1'/);
  assert.match(html, /localStorage\.setItem\(YEAR_NAV_KEY/);
  assert.match(html, /year===activeYear/);
  assert.match(html, /initialMonth=startMonth\(\)/);
  assert.match(html, /yearTabsHtml\(initialMonth\)/);
});

test('year navigation remains touch-friendly on mobile', () => {
  assert.match(html, /\.year-group\{grid-template-columns:1fr\}/);
  assert.match(html, /\.year-pill\{justify-content:space-between;width:100%;min-height:44px\}/);
  assert.match(html, /flex:1 1 calc\(33\.333% - 7px\)/);
});
