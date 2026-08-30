(function () {
  'use strict';

  function installMobileMonthNav() {
    var tabs = document.getElementById('tabs');
    if (!tabs || tabs.dataset.mobileMonthNavInstalled === '1') return;
    tabs.dataset.mobileMonthNavInstalled = '1';

    var style = document.createElement('style');
    style.id = 'billsosMobileMonthNavStyles';
    style.textContent = [
      '#billsosMobileMonthNav{display:none}',
      '@media(max-width:900px){',
      '  #tabs.year-nav{display:none!important}',
      '  #billsosMobileMonthNav{display:grid;grid-template-columns:1fr auto;gap:8px;margin:10px 0 14px;align-items:stretch}',
      '  #billsosMobileMonthSelect{width:100%;min-width:0;height:48px;padding:0 42px 0 15px;border:1px solid var(--line,#ded6ca);border-radius:15px;background:rgba(255,253,248,.98);color:var(--ink,#17212b);font:800 16px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(55,43,31,.07)}',
      '  #billsosMobilePastToggle{min-height:48px;padding:0 14px;border:1px solid var(--line,#ded6ca);border-radius:15px;background:rgba(255,253,248,.98);color:var(--primary,#1f3a3d);font:800 13px/1.15 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap}',
      '  #billsosMobilePastToggle[hidden]{display:none!important}',
      '}',
      '@media(max-width:430px){',
      '  #billsosMobileMonthNav{grid-template-columns:1fr}',
      '  #billsosMobilePastToggle{width:100%}',
      '}'
    ].join('');
    document.head.appendChild(style);

    var nav = document.createElement('div');
    nav.id = 'billsosMobileMonthNav';
    nav.setAttribute('aria-label', 'Month navigation');
    nav.innerHTML = '<select id="billsosMobileMonthSelect" aria-label="Choose month"></select><button id="billsosMobilePastToggle" type="button">Show past months</button>';
    tabs.parentNode.insertBefore(nav, tabs);

    var select = nav.querySelector('#billsosMobileMonthSelect');
    var pastToggle = nav.querySelector('#billsosMobilePastToggle');
    var syncing = false;

    function sync() {
      if (syncing) return;
      syncing = true;
      var active = tabs.querySelector('.year-months button.active');
      var buttons = Array.prototype.slice.call(tabs.querySelectorAll('.year-months button'));
      var options = buttons.filter(function (button) {
        return !button.hidden && button.getAttribute('aria-hidden') !== 'true';
      }).map(function (button) {
        var year = button.getAttribute('data-year') || '';
        var selected = active === button ? ' selected' : '';
        return '<option value="' + button.id.replace(/^btn-/, '') + '"' + selected + '>' + button.textContent.trim() + ' ' + year + '</option>';
      }).join('');
      select.innerHTML = options || '<option>Choose month</option>';
      select.disabled = !options;

      var originalToggle = document.getElementById('past-months-toggle');
      if (originalToggle) {
        pastToggle.hidden = false;
        pastToggle.textContent = originalToggle.textContent.trim();
        pastToggle.setAttribute('aria-pressed', originalToggle.getAttribute('aria-pressed') || 'false');
      } else {
        pastToggle.hidden = true;
      }
      syncing = false;
    }

    select.addEventListener('change', function () {
      var target = document.getElementById('btn-' + select.value);
      if (target) target.click();
      setTimeout(sync, 0);
    });

    pastToggle.addEventListener('click', function () {
      var originalToggle = document.getElementById('past-months-toggle');
      if (originalToggle) originalToggle.click();
      setTimeout(sync, 0);
    });

    var observer = new MutationObserver(function () { sync(); });
    observer.observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'aria-pressed'] });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMobileMonthNav, { once: true });
  else installMobileMonthNav();

  var session = window.BillsOSSession || {};
  var viewer = session.role === 'viewer';
  document.documentElement.setAttribute('data-billsos-role', session.role || 'unknown');
  if (!viewer) return;

  var nativeFetch = window.fetch && window.fetch.bind(window);
  function pathFor(input) {
    try { return new URL(typeof input === 'string' ? input : input.url, location.href).pathname; }
    catch (_err) { return ''; }
  }
  function isAllowedViewerPost(method, path) {
    return method === 'POST' && (path === '/api/assistant' || path === '/api/assistant/intent');
  }
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var path = pathFor(input);
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && !isAllowedViewerPost(method, path)) {
        return Promise.resolve(new Response(JSON.stringify({ error: 'View only access cannot make changes' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return nativeFetch(input, init);
    };
  }

  var blockedSelector = [
    'a[href^="/control"]',
    '.moveBtn',
    '.billsosCardEditBtn',
    '.billsosCardDeleteBtn',
    '.billsosDoneCheck',
    '.amountEditBtn',
    '.billsosEditRestoreBtn',
    '.billsosBalanceTarget',
    '.billsosCardEditPopover',
    '.amountEditPopover',
    '.bb-scrim',
    '.amountEditable',
    'input[type="checkbox"][data-id]',
    '#paySheet'
  ].join(',');

  function applyViewOnly() {
    document.body && document.body.classList.add('billsos-view-only');
    document.querySelectorAll(blockedSelector).forEach(function (node) {
      node.setAttribute('data-billsos-owner-only', 'true');
      if ('disabled' in node) node.disabled = true;
      node.removeAttribute('role');
      node.removeAttribute('tabindex');
      node.removeAttribute('contenteditable');
    });
    if (!document.getElementById('billsosViewOnlyIndicator') && document.body) {
      var badge = document.createElement('div');
      badge.id = 'billsosViewOnlyIndicator';
      badge.setAttribute('role', 'status');
      badge.innerHTML = '<strong>View only</strong><a href="/logout">Log out</a>';
      document.body.appendChild(badge);
    }
    document.querySelectorAll('.bo-status').forEach(function (status) {
      var viewOnlyStatus = '<strong><span class="bo-dot"></span>View only</strong>Changes are disabled on this account.';
      if (status.innerHTML !== viewOnlyStatus) status.innerHTML = viewOnlyStatus;
    });
  }

  document.addEventListener('click', function (event) {
    if (event.target && event.target.closest && event.target.closest('[data-billsos-owner-only="true"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('change', function (event) {
    if (event.target && event.target.matches && event.target.matches('[data-billsos-owner-only="true"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  var viewOnlyStyle = document.createElement('style');
  viewOnlyStyle.id = 'billsosViewOnlyStyles';
  viewOnlyStyle.textContent = [
    '[data-billsos-role="viewer"] [data-billsos-owner-only="true"]{display:none!important}',
    '#billsosViewOnlyIndicator{position:fixed;right:14px;top:14px;z-index:1000;display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid rgba(47,112,72,.24);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(31,59,44,.12);color:#2f7048;font:700 12px/1.2 system-ui,sans-serif}',
    '#billsosViewOnlyIndicator a{color:#526058;font-weight:650;text-decoration:none}',
    '@media(max-width:760px){#billsosViewOnlyIndicator{top:16px;right:12px}}'
  ].join('');
  document.head.appendChild(viewOnlyStyle);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyViewOnly, { once: true });
  else applyViewOnly();
  new MutationObserver(applyViewOnly).observe(document.documentElement, { childList: true, subtree: true });
})();
