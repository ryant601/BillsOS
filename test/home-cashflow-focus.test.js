'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'html-hotfix-loader.js'), 'utf8');
const functions = source.slice(source.indexOf('  function homeCalendarDays(){'), source.indexOf('  function installDetailDrawer(){'));
function iso(date) { return date.toISOString().slice(0, 10); }

test('Home focus honors the saved floor and uses the first future low day from the calendar', () => {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dayNodes = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(today); date.setDate(today.getDate() + i);
    const ending = i === 9 ? 150 : i === 3 ? 250 : 900;
    return {
      dataset: { date: iso(date) },
      querySelector() { return { textContent: '$' + ending }; },
      querySelectorAll() { return i === 3 ? [{ querySelector: () => ({ textContent: 'Jeep' }) }] : []; }
    };
  });
  const elements = Object.fromEntries(['boFocus', 'boWeek', 'boAttention'].map(id => [id, { innerHTML: '', className: '' }]));
  const context = {
    document: { getElementById: id => elements[id], querySelectorAll: () => dayNodes },
    localStorage: { getItem: () => null },
    num: node => Number(node.textContent.replace(/[^0-9.-]/g, '')),
    text: node => node && node.textContent || '',
    money: value => '$' + Number(value).toLocaleString('en-US'),
    esc: value => String(value),
    isoDate: date => iso(date),
    Date, Array, Number, String, URLSearchParams
  };
  vm.createContext(context);vm.runInContext(functions, context);
  context.renderHomeCalendar();
  assert.match(elements.boFocus.innerHTML, /Next day below \$300/);
  assert.match(elements.boFocus.innerHTML, new RegExp('focus=' + dayNodes[3].dataset.date));
  assert.match(elements.boFocus.innerHTML, /Review options/);
  assert.equal((elements.boWeek.innerHTML.match(/class="bo-week-day/g) || []).length, 7);
  assert.match(elements.boAttention.innerHTML, new RegExp('focus=' + dayNodes[9].dataset.date));
  context.localStorage.getItem = () => '200';
  context.renderHomeCalendar();
  assert.match(elements.boFocus.innerHTML, new RegExp('focus=' + dayNodes[9].dataset.date));
});
