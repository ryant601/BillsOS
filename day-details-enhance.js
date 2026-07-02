(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260702mobile1';
  const MOBILE_FIT_HREF = '/mobile-fit.css?v=20260702fit3';
  const ACTION_LOG_LABEL = 'billsos action log';
  const BALANCE_CORRECTION_LABEL = 'balance correction';
  const GENERATED_OPENING_BALANCE = 3671;
  const BALANCE_PATCH_FLAG = 'data-billsos-balance-under-carry-fixed';

  function installStylesheet(href, dataKey, dataValue) {
    if (document.querySelector('link[' + dataKey + '="' + dataValue + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(dataKey, dataValue);
    document.head.appendChild(link);
  }

  function installCalmHouseholdTheme() {
    installStylesheet(CALM_THEME_HREF, 'data-billsos-calm-household', '1');
    installStylesheet(MOBILE_FIT_HREF, 'data-billsos-mobile-fit', '1');
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function normalizedText(el) {
    return text(el).toLowerCase();
  }

  function isActionLogMeta(item) {
    return normalizedText(item).indexOf(ACTION_LOG_LABEL) >= 0;
  }

  function isBalanceCorrection(item) {
    return normalizedText(item).indexOf(BALANCE_CORRECTION_LABEL) >= 0;
  }

  function isCalculationOnly(item) {
    return isActionLogMeta(item) || isBalanceCorrection(item);
  }

  function parseCurrency(value) {
    const raw = String(value || '').replace(/[−–—]/g, '-').replace(/[^0-9.-]/g, '');
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    });
  }

  function addToCurrencyNode(node, amount) {
    if (!node || node.hasAttribute(BALANCE_PATCH_FLAG)) return;
    const current = parseCurrency(node.textContent);
    if (current === null) return;
    node.textContent = formatCurrency(current + amount);
    node.setAttribute(BALANCE_PATCH_FLAG, '1');
  }

  function patchGeneratedBalanceUnderCarry() {
    const pill = document.querySelector('.pill');
    const mount = document.getElementById('mount');
    if (!pill || !mount) return;
    if (document.documentElement.hasAttribute(BALANCE_PATCH_FLAG)) return;
    if (text(pill).indexOf('v01565') < 0) return;

    const visibleMonthTitle = document.querySelector('.monthHead h2');
    const firstStarting = mount.querySelector('.day:not(.blank) .topline span:last-child b');
    if (!visibleMonthTitle || !firstStarting) return;

    const startValue = parseCurrency(firstStarting.textContent);
    if (startValue === null) return;

    // The generated model currently starts June at $0, then carries that under-stated result forward.
    // When that condition is present, every rendered running balance is low by the configured opening balance.
    const shouldPatch = /June|July|August|September|October|November|December/i.test(text(visibleMonthTitle)) && startValue < GENERATED_OPENING_BALANCE;
    if (!shouldPatch) return;

    mount.querySelectorAll('.topline span:last-child b, .endline b').forEach(function (node) {
      addToCurrencyNode(node, GENERATED_OPENING_BALANCE);
    });
    addToCurrencyNode(document.getElementById('kbegin'), GENERATED_OPENING_BALANCE);
    addToCurrencyNode(document.getElementById('kend'), GENERATED_OPENING_BALANCE);
    document.documentElement.setAttribute(BALANCE_PATCH_FLAG, '1');
  }

  function removeCalendarCalculationOnlyRows() {
    document.querySelectorAll('.day label.ev, .day .ev').forEach(function (item) {
      if (!isCalculationOnly(item)) return;
      item.remove();
    });
  }

  function removeDrawerCalculationOnlyRows() {
    const detail = document.getElementById('detailContent');
    if (!detail) return;

    const items = Array.from(detail.querySelectorAll('.detailItem'));
    if (!items.length) return;

    let removed = false;
    items.forEach(function (item) {
      if (!isCalculationOnly(item)) return;
      item.remove();
      removed = true;
    });

    if (removed && !detail.querySelector('.detailItem')) {
      detail.className = 'detailEmpty';
      detail.textContent = 'No visible actions on this day.';
    }
  }

  function syncDrawer() {
    patchGeneratedBalanceUnderCarry();
    removeCalendarCalculationOnlyRows();
    removeDrawerCalculationOnlyRows();

    const items = document.querySelectorAll('#detailContent .detailItem');
    if (!items.length) return;

    items.forEach(function (item) {
      const key = item.getAttribute('data-detail-id');
      const match = key ? document.querySelector('.day label.ev input[data-id="' + CSS.escape(key) + '"]') : null;
      const existing = item.querySelector(CHECKBOX_SELECTOR);
      const checked = !!(match && match.checked);

      if (!existing && match) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Mark complete');
        box.dataset.ddSync = '1';
        box.checked = checked;
        box.addEventListener('change', function () {
          const calendarBox = match;
          if (!calendarBox) return;
          if (calendarBox.checked === box.checked) return;
          calendarBox.checked = box.checked;
          calendarBox.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const main = item.querySelector('.detailMain');
        if (main && main.parentNode === item) item.insertBefore(box, main);
        else item.insertBefore(box, item.firstChild);
      } else if (existing) {
        existing.checked = checked;
      }
    });
  }

  let timer = 0;
  function scheduleSync() {
    window.clearTimeout(timer);
    timer = window.setTimeout(syncDrawer, 50);
  }

  installCalmHouseholdTheme();

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  window.addEventListener('load', function () {
    installCalmHouseholdTheme();
    scheduleSync();
  });
  window.addEventListener('hashchange', scheduleSync);
  scheduleSync();
})();