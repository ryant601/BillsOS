(function () {
  var MONTHS = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };

  function activeMonth() {
    var active = document.querySelector('#tabs button.active');
    var label = active ? active.textContent.trim().slice(0, 3) : 'Jun';
    return { label: label, value: '2026-' + (MONTHS[label] || '06') };
  }

  function defaultDate() {
    var m = activeMonth().value;
    var now = new Date();
    var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    return today.slice(0, 7) === m ? today : m + '-01';
  }

  function moneyNumber(raw) {
    return Number(String(raw || '').replace(/[$,]/g, '').trim());
  }

  function makePanel() {
    if (document.getElementById('balanceCorrectionPanel')) return;
    var title = document.getElementById('briefTitle');
    var card = title && title.closest('.card');
    if (!card) return;

    var panel = document.createElement('div');
    panel.id = 'balanceCorrectionPanel';
    panel.style.marginTop = '12px';
    panel.style.paddingTop = '12px';
    panel.style.borderTop = '1px solid rgba(20,35,55,.08)';
    panel.innerHTML = '' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);font-weight:900;margin-bottom:8px">Balance correction</div>' +
      '<div style="display:grid;gap:8px">' +
      '<input id="balanceCorrectionAmount" inputmode="decimal" placeholder="Correction amount, e.g. 500 or -125" style="border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;font:inherit">' +
      '<input id="balanceCorrectionDate" type="date" style="border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;font:inherit">' +
      '<input id="balanceCorrectionNote" placeholder="Note" style="border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px;font:inherit">' +
      '<button id="saveBalanceCorrection" type="button" style="border:1px solid var(--primary);border-radius:12px;background:var(--primary);color:#fff;padding:10px 12px;font-weight:900">Add correction</button>' +
      '<div id="balanceCorrectionMeta" style="font-size:12px;color:var(--mut)">Adds a visible correction item to this month.</div>' +
      '</div>';
    card.appendChild(panel);

    document.getElementById('balanceCorrectionDate').value = defaultDate();
    document.getElementById('balanceCorrectionNote').value = activeMonth().label + ' balance correction';
    document.getElementById('saveBalanceCorrection').onclick = saveCorrection;
  }

  async function saveCorrection() {
    var amount = moneyNumber(document.getElementById('balanceCorrectionAmount').value);
    var date = document.getElementById('balanceCorrectionDate').value || defaultDate();
    var note = document.getElementById('balanceCorrectionNote').value || 'Balance correction';
    var meta = document.getElementById('balanceCorrectionMeta');
    if (!Number.isFinite(amount) || amount === 0) {
      meta.textContent = 'Enter a positive or negative amount.';
      return;
    }
    if (date.slice(0, 7) !== activeMonth().value) {
      meta.textContent = 'Use a date in the visible month.';
      return;
    }
    meta.textContent = 'Saving correction...';
    var res = await fetch('/api/bills', { cache: 'no-store' });
    var data = await res.json();
    data.oneTimeEvents = Array.isArray(data.oneTimeEvents) ? data.oneTimeEvents : [];
    data.oneTimeEvents.push({
      id: 'manual-balance-' + Date.now(),
      name: note,
      type: amount >= 0 ? 'income' : 'expense',
      amount: amount,
      date: date,
      notes: 'Manual balance correction'
    });
    await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    location.reload();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var count = 0;
    var timer = setInterval(function () {
      makePanel();
      count += 1;
      if (document.getElementById('balanceCorrectionPanel') || count > 30) clearInterval(timer);
    }, 250);
  });
})();
