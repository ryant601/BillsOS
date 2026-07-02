(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';
  const CALM_THEME_HREF = '/calm-household.css?v=20260702calm1';

  function installCalmHouseholdTheme() {
    if (document.querySelector('link[data-billsos-calm-household="1"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CALM_THEME_HREF;
    link.dataset.billsosCalmHousehold = '1';
    document.head.appendChild(link);
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function syncDrawer() {
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
