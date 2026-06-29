(function () {
  function currentMonthLabel() {
    var title = ((document.querySelector('.monthHead h2') || {}).textContent || '').trim();
    var parts = title.split(/\s+/);
    return parts[0] || '';
  }

  function friendlyDueDate(day) {
    var month = currentMonthLabel();
    return month ? (month.slice(0, 3) + ' ' + day) : ('day ' + day);
  }

  function visibleOpenBillLines() {
    return Array.from(document.querySelectorAll('.day .ev.out:not(.done)')).map(function (ev) {
      var day = (((ev.closest('.day') || {}).querySelector('.topline b') || {}).textContent || '').trim() || '1';
      var name = ((ev.querySelector('span') || {}).textContent || 'Bill').trim();
      var amount = ((ev.querySelector('b') || {}).textContent || '').trim();
      return name + ' — ' + amount + ' — due ' + friendlyDueDate(day);
    }).slice(0, 20);
  }

  function updateAppleReminderMeta() {
    var items = visibleOpenBillLines();
    var meta = document.getElementById('appleReminderMeta');
    var btn = document.getElementById('appleReminderBtn');
    if (meta) meta.textContent = items.length ? items.length + ' open item(s) ready for Apple Reminders.' : 'No open bill items in this month.';
    if (btn) btn.disabled = !items.length;
  }

  function sendFriendlyAppleReminders() {
    var items = visibleOpenBillLines();
    updateAppleReminderMeta();
    if (!items.length) return;
    var text = items.join('\n');
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    location.href = ['shortcuts:', '/', '/run-shortcut?name=BillsOS%20Add%20Reminders&input=text&text='].join('') + encodeURIComponent(text);
  }

  function bindAppleReminderButton() {
    var btn = document.getElementById('appleReminderBtn');
    if (!btn) return;
    btn.onclick = sendFriendlyAppleReminders;
    updateAppleReminderMeta();
  }

  bindAppleReminderButton();
  setInterval(bindAppleReminderButton, 1000);
})();
