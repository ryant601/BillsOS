(function () {
  'use strict';

  var BUILD = 'calendar-event-scroll-20260828-2';
  var STYLE_ID = 'billsosCalendarEventScrollFix';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.day:not(.is-blank):not(.is-past){',
      '  height:172px!important;',
      '  min-height:172px!important;',
      '  display:flex!important;',
      '  flex-direction:column!important;',
      '  overflow:hidden!important;',
      '}',
      '.day .dtop,.day .bod,.day .eod{flex:0 0 auto!important}',
      '.day .events{',
      '  flex:1 1 auto!important;',
      '  min-height:0!important;',
      '  overflow-x:hidden!important;',
      '  overflow-y:auto!important;',
      '  overscroll-behavior-y:contain!important;',
      '  scrollbar-width:thin!important;',
      '  scrollbar-gutter:stable;',
      '  touch-action:pan-y!important;',
      '  -webkit-overflow-scrolling:touch!important;',
      '}',
      '.day .events::-webkit-scrollbar{width:7px!important}',
      '.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.28)!important;border-radius:999px!important}',
      '.day .events::-webkit-scrollbar-track{background:transparent!important}',
      '@media(max-width:900px){',
      '  .day:not(.is-blank):not(.is-past){height:190px!important;min-height:190px!important}',
      '  .day .events{scrollbar-gutter:auto}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  installStyles();
  window.BillsOSModules = window.BillsOSModules || {};
  window.BillsOSModules.calendarEventScroll = { build: BUILD, installed: true };
})();
