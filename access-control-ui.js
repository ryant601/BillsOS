(function () {
  'use strict';
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

  var style = document.createElement('style');
  style.id = 'billsosViewOnlyStyles';
  style.textContent = [
    '[data-billsos-role="viewer"] [data-billsos-owner-only="true"]{display:none!important}',
    '#billsosViewOnlyIndicator{position:fixed;right:14px;top:14px;z-index:1000;display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid rgba(47,112,72,.24);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(31,59,44,.12);color:#2f7048;font:700 12px/1.2 system-ui,sans-serif}',
    '#billsosViewOnlyIndicator a{color:#526058;font-weight:650;text-decoration:none}',
    '@media(max-width:760px){#billsosViewOnlyIndicator{top:16px;right:12px}}'
  ].join('');
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyViewOnly, { once: true });
  else applyViewOnly();
  new MutationObserver(applyViewOnly).observe(document.documentElement, { childList: true, subtree: true });
})();
