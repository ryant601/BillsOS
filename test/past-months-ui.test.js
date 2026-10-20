'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');

test('past months are available in the month picker without another reveal control', () => {
  assert.match(html, /function monthNavigatorHtml\(/);
  assert.doesNotMatch(html, /function readPastMonths|function writePastMonths|function applyPastMonthVisibility|PAST_MONTHS_KEY/);
  assert.doesNotMatch(html, /class="past-months-toggle"/);
  assert.match(html, /month\.some|months\.some/);
});

test('a saved past month is retained and unknown saved months fall back to today', () => {
  const source = html.slice(html.indexOf('function startMonth()'), html.indexOf('function csvCell('));
  const months = [['september','September',9,2026],['october','October',10,2026]];
  const shortIds = {september:'sep',october:'oct'};
  function start(saved) {
    return new Function('localStorage','months','shortIds','currentMonthId',source + ';return startMonth();')(
      {getItem:()=>saved},months,shortIds,()=> 'oct'
    );
  }
  assert.equal(start('sep'), 'sep');
  assert.equal(start('missing'), 'oct');
});
