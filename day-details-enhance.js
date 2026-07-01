(function () {
  const CHECKBOX_SELECTOR = '.detailItem input[type="checkbox"]';

  function text(el) {
    return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function selectedDayNumber() {
    const title = document.getElementById('detailTitle');
    const m = title && text(title).match(/Day\s+(\d{1,2})/i);
    return m ? String(Number(m[1])) : '';
  }

  function matchingCalendarCheckbox(detailItem) {
    const dayNum = selectedDayNumber();
    const nameEl = detailItem.querySelector('.name');
    const amtEl = detailItem.querySelector('.amt');
    const name = text(nameEl);
    const amt = text(amtEl);
    if (!name || !amt) return null;

    const labels = Array.from(document.querySelectorAll('.day label.ev'));
    return labels.find(function (label) {
      const day = label.closest('.day');
      const dayNumber = day && day.querySelector('.topline b') ? text(day.querySelector('.topline b')) : '';
      if (dayNum && dayNumber !== dayNum) return false;
      return text(label).includes(name) && text(label).includes(amt);
    }) || null;
  }

  function syncDrawer() {
    const items = document.querySelectorAll('#detailContent .detailItem');
    if (!items.length) return;

    items.forEach(function (item) {
      const match = matchingCalendarCheckbox(item);
      const existing = item.querySelector(CHECKBOX_SELECTOR);
      const checked = !!(match && match.querySelector('input[type="checkbox"]') && match.querySelector('input[type="checkbox"]').checked);

      if (!existing && match && match.querySelector('input[type="checkbox"]')) {
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Mark complete');
        box.dataset.ddSync = '1';
        box.checked = checked;
        box.addEventListener('change', function () {
          const calendarBox = match.querySelector('input[type="checkbox"]');
          if (!calendarBox || calendarBox.checked === box.checked) return;
          calendarBox.click();
        });
        item.insertBefore(box, item.firstChild);
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

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  window.addEventListener('load', scheduleSync);
  window.addEventListener('hashchange', scheduleSync);
  scheduleSync();
})();
