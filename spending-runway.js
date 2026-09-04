(function (root) {
  'use strict';

  var SPENDING_DAY_START = 7;
  var SPENDING_DAY_END = 22;

  function isoDay(value) {
    var match = String(value || '').match(/(20\d{2}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function newYorkParts(now) {
    var date = now instanceof Date ? now : new Date();
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    var out = { year: '', month: '', day: '', hour: 0, minute: 0 };
    parts.forEach(function (part) {
      if (part.type === 'year') out.year = part.value;
      if (part.type === 'month') out.month = part.value;
      if (part.type === 'day') out.day = part.value;
      if (part.type === 'hour') out.hour = Number(part.value);
      if (part.type === 'minute') out.minute = Number(part.value);
    });
    return out;
  }

  function todayInNewYork(now) {
    var parts = newYorkParts(now);
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function runwayDays(today, nextTransfer) {
    var start = Date.parse(isoDay(today) + 'T12:00:00Z');
    var end = Date.parse(isoDay(nextTransfer) + 'T12:00:00Z');
    if (!isFinite(start) || !isFinite(end)) return 0;
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function addDays(day, amount) {
    var value = Date.parse(isoDay(day) + 'T12:00:00Z');
    if (!isFinite(value)) return '';
    return new Date(value + Number(amount || 0) * 86400000).toISOString().slice(0, 10);
  }

  function cycleLength(cycle) {
    var start = Date.parse(isoDay(cycle && cycle.start) + 'T12:00:00Z');
    var next = Date.parse(isoDay(cycle && cycle.nextTransfer) + 'T12:00:00Z');
    var days = Math.round((next - start) / 86400000);
    return isFinite(days) && days > 0 ? days : 14;
  }

  function normalizeCycle(cycle, today) {
    if (!cycle) return cycle;
    var day = isoDay(today);
    var next = isoDay(cycle.nextTransfer);
    if (!day || !next) return cycle;
    var interval = cycleLength(cycle);
    while (day >= next) {
      cycle.start = next;
      next = addDays(next, interval);
    }
    cycle.nextTransfer = next;
    cycle.end = addDays(next, -1);
    return cycle;
  }

  function todayShare(now) {
    var parts = newYorkParts(now);
    var hour = parts.hour + parts.minute / 60;
    if (hour <= SPENDING_DAY_START) return 1;
    if (hour >= SPENDING_DAY_END) return 0;
    return (SPENDING_DAY_END - hour) / (SPENDING_DAY_END - SPENDING_DAY_START);
  }

  function coverUnits(days, now) {
    var laterDays = Math.max(0, Number(days || 0) - 1);
    return Math.max(0.01, todayShare(now) + laterDays);
  }

  function availablePerDay(remaining, days, now) {
    var amount = Number(remaining || 0);
    if (!isFinite(amount)) amount = 0;
    var units = Math.max(1, coverUnits(days, now));
    var pace = Math.round((amount / units) * 100) / 100;
    if (amount >= 0) return Math.min(amount, pace);
    return Math.max(amount, pace);
  }

  function paceLabel(days, now) {
    if (Number(days || 0) > 1 && todayShare(now) < 0.25) return 'for tomorrow';
    return 'available per day';
  }

  function applyRunway(snapshot, today, now) {
    if (!snapshot || !snapshot.cycle) return snapshot;
    var when = now instanceof Date ? now : new Date();
    var day = today || todayInNewYork(when);
    normalizeCycle(snapshot.cycle, day);
    var days = runwayDays(day, snapshot.cycle.nextTransfer || snapshot.cycle.end);
    snapshot.cycle.daysLeft = days;
    if (snapshot.metrics) {
      snapshot.metrics.availablePerDay = availablePerDay(snapshot.metrics.remainingAvailable, days, when);
      snapshot.metrics.availablePaceLabel = paceLabel(days, when);
    }
    return snapshot;
  }

  function isSpendingSnapshot(href) {
    return /(?:^|\/)spending\/current\.json(?:\?|$)/.test(String(href || ''));
  }

  function install() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if (window.__billsosSpendingRunway) return;
    window.__billsosSpendingRunway = true;
    var original = window.fetch.bind(window);
    window.fetch = function (url, options) {
      var request = original.apply(this, arguments);
      var href = typeof url === 'string' ? url : (url && url.url) || '';
      if (!isSpendingSnapshot(href)) return request;
      return request.then(function (response) {
        if (!response || !response.ok) return response;
        var copy = response.clone();
        return copy.json().then(function (data) {
          return new Response(JSON.stringify(applyRunway(data)), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' }
          });
        }).catch(function () { return response; });
      });
    };
  }

  if (typeof document !== 'undefined') install();

  var api = {
    isoDay: isoDay,
    todayInNewYork: todayInNewYork,
    runwayDays: runwayDays,
    addDays: addDays,
    cycleLength: cycleLength,
    normalizeCycle: normalizeCycle,
    todayShare: todayShare,
    coverUnits: coverUnits,
    availablePerDay: availablePerDay,
    paceLabel: paceLabel,
    applyRunway: applyRunway,
    isSpendingSnapshot: isSpendingSnapshot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BillsOSSpendingRunway = api;
})(typeof window !== 'undefined' ? window : this);
