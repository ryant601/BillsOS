(function () {
  'use strict';

  var BUILD = 'calendar-event-scroll-20260828-3';
  var STYLE_ID = 'billsosCalendarEventScrollFix';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.day:not(.is-blank):not(.is-past){',
      '  height:172px!important;',
      '  min-height:172px!important;',
      '  max-height:172px!important;',
      '  display:flex!important;',
      '  flex-direction:column!important;',
      '  overflow:hidden!important;',
      '}',
      '.day .dtop,.day .bod,.day .eod{flex:0 0 auto!important}',
      '.day .events{',
      '  display:flex!important;',
      '  flex-direction:column!important;',
      '  flex:0 0 76px!important;',
      '  height:76px!important;',
      '  min-height:44px!important;',
      '  max-height:76px!important;',
      '  overflow-x:hidden!important;',
      '  overflow-y:scroll!important;',
      '  overscroll-behavior-y:contain!important;',
      '  scrollbar-width:thin!important;',
      '  scrollbar-gutter:stable;',
      '  touch-action:pan-y!important;',
      '  -webkit-overflow-scrolling:touch!important;',
      '}',
      '.day .events .ev{flex:0 0 auto!important}',
      '.day .events::-webkit-scrollbar{width:7px!important}',
      '.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.38)!important;border-radius:999px!important}',
      '.day .events::-webkit-scrollbar-track{background:rgba(31,58,61,.05)!important;border-radius:999px!important}',
      '@media(max-width:900px){',
      '  .day:not(.is-blank):not(.is-past){height:190px!important;min-height:190px!important;max-height:190px!important}',
      '  .day .events{flex-basis:94px!important;height:94px!important;max-height:94px!important;scrollbar-gutter:auto}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function wireScroller(el) {
    if (!el || el.dataset.billsosScrollWired === '1') return;
    el.dataset.billsosScrollWired = '1';
    el.addEventListener('wheel', function (event) {
      if (el.scrollHeight <= el.clientHeight + 1) return;
      var before = el.scrollTop;
      el.scrollTop += event.deltaY;
      if (el.scrollTop !== before) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false });
  }

  function wireAll() {
    document.querySelectorAll('.day .events').forEach(wireScroller);
  }

  installStyles();
  wireAll();
  var observer = new MutationObserver(function () { wireAll(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.BillsOSModules = window.BillsOSModules || {};
  window.BillsOSModules.calendarEventScroll = { build: BUILD, installed: true };
})();
