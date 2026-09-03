(function (root) {
  'use strict';

  function isoDay(value) {
    var match = String(value || '').match(/(20\d{2}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function todayInNewYork(now) {
    var date = now instanceof Date ? now : new Date();
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var year = '', month = '', day = '';
    parts.forEach(function (part) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
    });
    return year + '-' + month + '-' + day;
  }

  function runwayDays(today, nextTransfer) {
    var start = Date.parse(isoDay(today) + 'T12:00:00Z');
    var end = Date.parse(isoDay(nextTransfer) + 'T12:00:00Z');
    if (!isFinite(start) || !isFinite(end)) return 0;
    return Math.max(0, Math.round((end - start) / 86400000));
  }

  function availablePerDay(remaining, days) {
    var amount = Number(remaining || 0);
    if (!isFinite(amount)) amount = 0;
    if (!(days > 0)) return Math.round(amount * 100) / 100;
    return Math.round((amount / days) * 100) / 100;
  }

  function applyRunway(snapshot, today) {
    if (!snapshot || !snapshot.cycle) return snapshot;
    var days = runwayDays(today || todayInNewYork(), snapshot.cycle.nextTransfer || snapshot.cycle.end);
    snapshot.cycle.daysLeft = days;
    if (snapshot.metrics) {
      snapshot.metrics.availablePerDay = availablePerDay(snapshot.metrics.remainingAvailable, days);
    }
    return snapshot;
  }

  function install() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    if (window.__billsosSpendingRunway) return;
    window.__billsosSpendingRunway = true;
    var original = window.fetch;
    window.fetch = function (url, options) {
      var request = original.apply(this, arguments);
      var href = typeof url === 'string' ? url : (url && url.url) || '';
      if (href.indexOf('current.json') === -1) return request;
      return request.then(function (response) {
        if (!response || !response.ok) return response;
        return response.json().then(function (data) {
          return new Response(JSON.stringify(applyRunway(data)), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      });
    };
  }

  if (typeof document !== 'undefined') install();

  var api = { isoDay: isoDay, todayInNewYork: todayInNewYork, runwayDays: runwayDays, availablePerDay: availablePerDay, applyRunway: applyRunway };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BillsOSSpendingRunway = api;
})(typeof window !== 'undefined' ? window : this);
