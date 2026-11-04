const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const loader = fs.readFileSync(path.join(root, 'html-hotfix-loader.js'), 'utf8');
const control = fs.readFileSync(path.join(root, 'control.html'), 'utf8');
const vm = require('node:vm');

test('all navigation destinations have distinct accessible SVG icons', () => {
  const source = loader.slice(loader.indexOf('  function navigationIcon('), loader.indexOf('  function controlSection('));
  const context = {}; vm.createContext(context); vm.runInContext(source, context);
  const names = ['home', 'calendar', 'cards', 'reports', 'bills', 'income'];
  const icons = names.map(name => context.navigationIcon(name));
  assert.equal(new Set(icons.map(icon => icon.replace(/data-bo-icon="[^"]+"/, ''))).size, 6);
  names.forEach(name => {
    const markup = context.link(name, name, '/', false);
    assert.match(markup, /<svg /); assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, new RegExp('<span>' + name + '</span>'));
  });
});

test('retired Backup panel and handlers are removed without breaking old control links', () => {
  assert.doesNotMatch(control, /panel-backup|data-tab="backup"|downloadBackup|restoreBackup|renderRaw|rawData|restoreText/);
  const source = loader.slice(loader.indexOf('  function controlSection('), loader.indexOf('  function syncSidebarActive('));
  const context = {location: {hash: '#backup'}}; vm.createContext(context); vm.runInContext(source, context);
  assert.equal(context.controlSection(), 'bills');
});

test('sidebar exposes only working control destinations', () => {
  assert.match(loader, /'Bills','\/control#bills'/);
  assert.match(loader, /'Income','\/control#income'/);
  assert.doesNotMatch(loader, /'Cash Flow','\/control#oneTime'/);
  assert.doesNotMatch(loader, /'Backup','\/control#backup'/);
  assert.doesNotMatch(loader, /link\([^\n]+,'Accounts'/);
  assert.match(loader, /link\('reports','Reports','\/\?view=reports'/);
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
