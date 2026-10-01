(function () {
  'use strict';

  var BUILD = 'calendar-event-scroll-20260828-4';
  var STYLE_ID = 'billsosCalendarEventScrollFix';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.day:not(.is-blank):not(.is-past){',
      '  position:relative!important;',
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
      '  overflow-y:auto!important;',
      '  overscroll-behavior-y:contain!important;',
      '  scrollbar-width:none!important;',
      '  touch-action:pan-y!important;',
      '  -webkit-overflow-scrolling:touch!important;',
      '  padding-right:10px!important;',
      '}',
      '.day .events::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}',
      '.day .events .ev{flex:0 0 auto!important}',
      '.billsos-card-scrollrail{',
      '  position:absolute!important;',
      '  right:5px!important;',
      '  width:5px!important;',
      '  border-radius:999px!important;',
      '  background:rgba(26,34,51,.10)!important;',
      '  z-index:15!important;',
      '  opacity:0!important;',
      '  transition:opacity .15s ease!important;',
      '  pointer-events:auto!important;',
      '}',
      '.day.billsos-has-scroll .billsos-card-scrollrail{opacity:1!important}',
      '.billsos-card-scrollthumb{',
      '  position:absolute!important;',
      '  left:0!important;',
      '  right:0!important;',
      '  top:0;',
      '  min-height:18px!important;',
      '  border-radius:999px!important;',
      '  background:rgba(26,34,51,.48)!important;',
      '  box-shadow:0 0 0 1px rgba(255,255,255,.55)!important;',
      '  cursor:grab!important;',
      '  touch-action:none!important;',
      '}',
      '.billsos-card-scrollthumb:active{cursor:grabbing!important;background:rgba(26,34,51,.68)!important}',
      'html[data-billsos-theme="dark"] .billsos-card-scrollrail{background:rgba(241,243,246,.14)!important}',
      'html[data-billsos-theme="dark"] .billsos-card-scrollthumb{background:rgba(241,243,246,.52)!important;box-shadow:none!important}',
      '@media(max-width:900px){',
      '  .day:not(.is-blank):not(.is-past){height:190px!important;min-height:190px!important;max-height:190px!important}',
      '  .day .events{flex-basis:94px!important;height:94px!important;max-height:94px!important}',
      '  .billsos-card-scrollrail{right:6px!important;width:6px!important}',
      '}'
    ].join('');
    document.head.appendChild(style);
  }

  function updateRail(el) {
    if (!el) return;
    var day = el.closest('.day');
    if (!day) return;
    var rail = day.querySelector(':scope > .billsos-card-scrollrail');
    if (!rail) return;
    var thumb = rail.querySelector('.billsos-card-scrollthumb');
    var overflow = el.scrollHeight > el.clientHeight + 2;
    day.classList.toggle('billsos-has-scroll', overflow);
    rail.style.top = el.offsetTop + 'px';
    rail.style.height = el.clientHeight + 'px';
    if (!overflow) {
      thumb.style.height = '100%';
      thumb.style.transform = 'translateY(0)';
      return;
    }
    var ratio = el.clientHeight / el.scrollHeight;
    var thumbH = Math.max(18, Math.round(el.clientHeight * ratio));
    var track = Math.max(0, el.clientHeight - thumbH);
    var maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    var y = Math.round(track * (el.scrollTop / maxScroll));
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + y + 'px)';
  }

  function installRail(el) {
    var day = el && el.closest('.day');
    if (!day) return null;
    var rail = day.querySelector(':scope > .billsos-card-scrollrail');
    if (rail) return rail;
    rail = document.createElement('div');
    rail.className = 'billsos-card-scrollrail';
    rail.setAttribute('aria-hidden', 'true');
    var thumb = document.createElement('div');
    thumb.className = 'billsos-card-scrollthumb';
    rail.appendChild(thumb);
    day.appendChild(rail);

    var dragging = false, startY = 0, startScroll = 0;
    thumb.addEventListener('pointerdown', function (event) {
      dragging = true;
      startY = event.clientY;
      startScroll = el.scrollTop;
      try { thumb.setPointerCapture(event.pointerId); } catch (_err) {}
      event.preventDefault();
      event.stopPropagation();
    });
    thumb.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      var thumbH = thumb.getBoundingClientRect().height;
      var track = Math.max(1, el.clientHeight - thumbH);
      var maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = startScroll + ((event.clientY - startY) / track) * maxScroll;
      updateRail(el);
      event.preventDefault();
    });
    function stopDrag(){ dragging = false; }
    thumb.addEventListener('pointerup', stopDrag);
    thumb.addEventListener('pointercancel', stopDrag);
    rail.addEventListener('pointerdown', function(event){
      if (event.target === thumb) return;
      var rect = rail.getBoundingClientRect();
      var fraction = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
      el.scrollTop = fraction * Math.max(0, el.scrollHeight - el.clientHeight);
      updateRail(el);
      event.preventDefault();
      event.stopPropagation();
    });
    return rail;
  }

  function wireScroller(el) {
    if (!el) return;
    installRail(el);
    if (el.dataset.billsosScrollWired !== '1') {
      el.dataset.billsosScrollWired = '1';
      el.addEventListener('scroll', function(){ updateRail(el); }, { passive:true });
      el.addEventListener('wheel', function (event) {
        if (el.scrollHeight <= el.clientHeight + 1) return;
        var before = el.scrollTop;
        el.scrollTop += event.deltaY;
        if (el.scrollTop !== before) {
          updateRail(el);
          event.preventDefault();
          event.stopPropagation();
        }
      }, { passive: false });
    }
    requestAnimationFrame(function(){ updateRail(el); });
    setTimeout(function(){ updateRail(el); }, 80);
  }

  function wireAll() {
    document.querySelectorAll('.day .events').forEach(wireScroller);
  }

  installStyles();
  wireAll();
  var observer = new MutationObserver(function () { wireAll(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', wireAll, { passive:true });
  window.addEventListener('load', wireAll, { once:true });

  window.BillsOSModules = window.BillsOSModules || {};
  window.BillsOSModules.calendarEventScroll = { build: BUILD, installed: true, customScrollbar: true };
})();
