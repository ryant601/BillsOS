const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const loader = fs.readFileSync(path.join(root, 'html-hotfix-loader.js'), 'utf8');
const control = fs.readFileSync(path.join(root, 'control.html'), 'utf8');

test('sidebar exposes only working control destinations', () => {
  assert.match(loader, /'Bills','\/control#bills'/);
  assert.match(loader, /'Income','\/control#income'/);
  assert.doesNotMatch(loader, /'Cash Flow','\/control#oneTime'/);
  assert.match(loader, /'Backup','\/control#backup'/);
  assert.doesNotMatch(loader, /link\([^\n]+,'Accounts'/);
  assert.doesNotMatch(loader, /link\([^\n]+,'Reports'/);
  assert.doesNotMatch(loader, /link\([^\n]+,'Settings'/);
});

test('one-time items are consolidated into the Bills workspace', () => {
  assert.match(control, /Recurring Bills/);
  assert.match(control, /One-Time Items/);
  assert.match(control, /Expense \/ Charge/);
  assert.match(control, /Income \/ Windfall/);
  assert.doesNotMatch(control, /data-tab="oneTime"/);
});

test('hash navigation switches the panel and active sidebar item', () => {
  assert.match(loader, /addEventListener\('hashchange',selectControlTab\)/);
  assert.match(loader, /showTab\(tab\)/);
  assert.match(loader, /syncSidebarActive\(tab\)/);
  assert.match(control, /BillsOSSyncSidebarActive\(id\)/);
  assert.match(control, /history\.replaceState\(null,'','#'\+id\)/);
});

test('calendar uses overlay hamburger navigation so day cells can use the full width', () => {
  assert.match(loader, /body\.classList\.toggle\('bo-calendar', dashboard && view==='calendar'\)/);
  assert.match(loader, /body\.bo-calendar #boMenu\{display:grid/);
  assert.match(loader, /body\.bo-calendar\.bo-open \.bo-sidebar\{transform:translateX\(0\)\}/);
  assert.match(loader, /body\.bo-calendar>\.wrap,body\.bo-calendar \.billsos-main>\.wrap\{margin-left:0!important/);
  assert.match(loader, /body\.bo-calendar \.billsos-sidebar/);
  assert.match(loader, /aria-label','Open navigation'/);
  assert.doesNotMatch(loader, /body\.bo-home #boMenu\{display:grid/);
});
