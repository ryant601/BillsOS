const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');

test('calendar groups months with accessible 2026 and 2027 year pills', () => {
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

test('both year groups remain on one horizontal line with each year at the end', () => {
  assert.match(html, /\.tabs\.year-nav\{display:flex;align-items:center;.*?overflow-x:auto;.*?flex-wrap:nowrap\}/);
  assert.match(html, /\.year-group\{display:flex;align-items:center;.*?flex:0 0 auto\}/);
  assert.match(html, /\.year-pill\{order:2;/);
  assert.match(html, /\.year-months\{order:1;flex-wrap:nowrap/);
});

test('horizontal year navigation remains touch-friendly on mobile', () => {
  assert.match(html, /@media\(max-width:900px\)\{\.tabs\.year-nav\{.*?\.year-pill\{width:auto;min-height:42px\}/);
  assert.match(html, /\.year-months button\{flex:0 0 auto;min-height:42px;padding:9px 12px\}/);
});
