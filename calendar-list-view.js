(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BillsOSCalendarList = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'billsos-list-weeks-v1';

  function isoDate(year, month, day) {
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function dayCount(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function weekId(year, month, index) {
    return 'week-' + year + '-' + String(month).padStart(2, '0') + '-' + (index + 1);
  }

  function buildMonth(rows, year, month, openingBalance, options) {
    rows = Array.isArray(rows) ? rows : [];
    options = options || {};
    const warning = Number.isFinite(Number(options.warning)) ? Number(options.warning) : 300;
    const today = String(options.today || '');
    const byDay = {};
    rows.forEach(function (row) {
      const day = Number(row.day || String(row.iso || row.date || '').slice(8, 10));
      if (day >= 1 && day <= dayCount(year, month)) (byDay[day] = byDay[day] || []).push(row);
    });

    let running = Number(openingBalance || 0);
    const days = [];
    for (let day = 1; day <= dayCount(year, month); day += 1) {
      const items = byDay[day] || [];
      items.filter(function (row) { return row.type === 'balance-opening-adjustment'; }).forEach(function (row) {
        running = row.requestedBalance == null ? running + Number(row.amount || 0) : Number(row.requestedBalance);
      });
      const beginning = running;
      items.filter(function (row) { return row.type !== 'balance-opening-adjustment'; }).forEach(function (row) {
        running += Number(row.amount || 0);
      });
      const date = isoDate(year, month, day);
      const ending = running;
      days.push({
        day: day,
        date: date,
        beginning: beginning,
        ending: ending,
        items: items,
        isToday: date === today,
        isNegative: ending < 0,
        isLow: ending >= 0 && ending < warning,
        visible: items.length > 0 || date === today || day === dayCount(year, month) || ending < warning
      });
    }

    const weeks = [];
    let cursor = 0;
    while (cursor < days.length) {
      const first = days[cursor];
      const endDay = Math.min(days.length, cursor + (7 - new Date(first.date + 'T12:00:00').getDay()));
      const weekDays = days.slice(cursor, endDay);
      const lowest = weekDays.reduce(function (best, day) { return day.ending < best.ending ? day : best; }, weekDays[0]);
      const negativeDays = weekDays.filter(function (day) { return day.isNegative; }).length;
      const lowDays = weekDays.filter(function (day) { return day.isLow; }).length;
      const hasToday = weekDays.some(function (day) { return day.isToday; });
      weeks.push({
        id: weekId(year, month, weeks.length),
        startDate: weekDays[0].date,
        endDate: weekDays[weekDays.length - 1].date,
        days: weekDays,
        visibleDays: weekDays.filter(function (day) { return day.visible; }),
        transactionCount: weekDays.reduce(function (sum, day) { return sum + day.items.length; }, 0),
        negativeDays: negativeDays,
        lowDays: lowDays,
        lowestBalance: lowest.ending,
        lowestDate: lowest.date,
        hasToday: hasToday,
        defaultExpanded: negativeDays > 0 || hasToday
      });
      cursor = endDay;
    }

    const lowest = days.reduce(function (best, day) { return day.ending < best.ending ? day : best; }, days[0]);
    return {
      days: days,
      weeks: weeks,
      beginning: Number(openingBalance || 0),
      ending: running,
      negativeDays: days.filter(function (day) { return day.isNegative; }).length,
      lowDays: days.filter(function (day) { return day.isLow; }).length,
      lowestBalance: lowest.ending,
      lowestDate: lowest.date,
      firstNegativeWeekId: (weeks.find(function (week) { return week.negativeDays > 0; }) || {}).id || ''
    };
  }

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) { return {}; }
  }

  function writeState(value) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value || {})); } catch (error) {}
  }

  function setExpanded(section, expanded, persist) {
    const button = section.querySelector('.calendar-week-toggle');
    const body = section.querySelector('.calendar-week-body');
    if (!button || !body) return;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    body.hidden = !expanded;
    section.classList.toggle('is-collapsed', !expanded);
    const label = button.querySelector('.calendar-week-action');
    if (label) label.textContent = expanded ? 'Hide week' : 'Show week';
    if (persist) {
      const state = readState();
      state[section.id] = !!expanded;
      writeState(state);
    }
  }

  function bind(rootNode) {
    const scope = rootNode || document;
    const state = readState();
    scope.querySelectorAll('.calendar-week').forEach(function (section) {
      const fallback = section.dataset.defaultExpanded === 'true';
      setExpanded(section, Object.prototype.hasOwnProperty.call(state, section.id) ? !!state[section.id] : fallback, false);
      const button = section.querySelector('.calendar-week-toggle');
      if (button && !button.dataset.bound) {
        button.dataset.bound = '1';
        button.addEventListener('click', function () { setExpanded(section, button.getAttribute('aria-expanded') !== 'true', true); });
      }
    });
    scope.querySelectorAll('.month-risk-jump').forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = '1';
      button.addEventListener('click', function () {
        const section = document.getElementById(button.dataset.weekTarget || '');
        if (!section) return;
        setExpanded(section, true, true);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const toggle = section.querySelector('.calendar-week-toggle');
        if (toggle) toggle.focus({ preventScroll: true });
      });
    });
  }

  return { STORAGE_KEY: STORAGE_KEY, buildMonth: buildMonth, bind: bind, setExpanded: setExpanded };
});
