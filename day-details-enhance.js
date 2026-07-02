(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260702mobile1';
  const MOBILE_FIT_HREF = '/mobile-fit.css?v=20260702fit1';
  const ACTION_LOG_LABEL = 'billsos action log';
  const BALANCE_CORRECTION_LABEL = 'balance correction';

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
