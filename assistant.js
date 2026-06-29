(function(){
  'use strict';

  var FLOOR = 1000;
  var MONTH_NUMS = {june:5,july:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  function cleanText(value){return String(value || '').replace(/\s+/g,' ').trim();}
  function parseMoney(value){var n = Number(String(value || '').replace(/−/g,'-').replace(/[^0-9.\-]/g,''));return isNaN(n) ? null : n;}
  function money(value){if(value == null || isNaN(value)) return '—';return '$' + Number(value).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});}
  function fmtDate(iso){if(!iso) return '—';return new Date(iso + 'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  function longDate(iso){if(!iso) return '—';return new Date(iso + 'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});}
  function isoFromDate(date){return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');}
  function todayIso(){var date = new Date();date.setHours(0,0,0,0);return isoFromDate(date);}
  function daysBetween(a,b){return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);}
  function escapeHtml(value){return String(value || '').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function addAssistantStyles(){
    if(document.getElementById('billsos-assistant-style')) return;
    var style = document.createElement('style');
    style.id = 'billsos-assistant-style';
    style.textContent = [
      '.assistant-panel{display:block!important;margin:0 0 18px;background:#fff;border:1px solid rgba(20,35,55,.12);border-radius:22px;padding:18px;box-shadow:0 10px 30px rgba(20,35,55,.06)}',
      '.assistant-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}',
      '.assistant-head h2{margin:0;font-size:22px;letter-spacing:-.02em;color:#14202c}',
      '.assistant-sub{font-size:13px;color:#41505f;margin-top:5px;max-width:720px}',
      '.assistant-form{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px}',
      '.assistant-form input{width:100%;box-sizing:border-box;border:1px solid rgba(20,35,55,.16);border-radius:16px;padding:12px 14px;font:500 14px Hanken Grotesk,system-ui;color:#14202c;background:#fff;outline:none}',
      '.assistant-form input:focus{border-color:rgba(10,125,68,.42);box-shadow:0 0 0 4px rgba(10,125,68,.08)}',
      '.assistant-form button,.assistant-chip{border:1px solid rgba(20,35,55,.14);background:#14202c;color:#fff;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}',
      '.assistant-chip{background:#fff;color:#41505f;padding:7px 10px}',
      '.assistant-chip:hover{border-color:rgba(10,125,68,.3);color:#0a7d44}',
      '.assistant-prompts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}',
      '.assistant-answer{border:1px solid rgba(20,35,55,.12);border-radius:18px;background:rgba(248,250,252,.75);padding:14px;margin-top:12px;color:#14202c;font-size:14px;line-height:1.45}',
      '.assistant-answer h3{margin:0 0 6px;font-size:16px;color:#14202c}',
      '.assistant-muted{color:#5f6b7a;font-size:13px;margin-top:4px}',
      '.assistant-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}',
      '.assistant-kpi{border:1px solid rgba(20,35,55,.1);border-radius:14px;background:#fff;padding:10px;min-width:0}',
      '.assistant-kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}',
      '.assistant-kpi b{display:block;margin-top:4px;font-family:JetBrains Mono,monospace;font-size:13px;color:#14202c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.assistant-answer ul{margin:8px 0 0;padding-left:18px}.assistant-answer li{margin:4px 0}',
      '.assistant-answer .ok{color:#0a7d44}.assistant-answer .watch{color:#a8651a}.assistant-answer .risk{color:#b8362c}',
      '@media(max-width:980px){.assistant-kpis{grid-template-columns:1fr 1fr}}',
      '@media(max-width:760px){.assistant-head{display:block}.assistant-form{grid-template-columns:1fr}.assistant-kpis{grid-template-columns:1fr}}'
    ].join('');
    document.head.appendChild(style);
  }

  function injectAssistantPanel(){
    if(document.getElementById('billsosAssistant')) return;
    addAssistantStyles();
    var panel = document.createElement('section');
    panel.className = 'assistant-panel';
    panel.id = 'billsosAssistant';
    panel.setAttribute('aria-label','BillsOS Assistant');
    panel.innerHTML = '<div class="assistant-head"><div><h2>BillsOS Assistant</h2><div class="assistant-sub">Ask about timing, one-time payments, upcoming bills, or projected balances. Uses the loaded cash-flow calendar.</div></div></div><form class="assistant-form" id="assistantForm"><input id="assistantInput" autocomplete="off" placeholder="Example: I need to make a $500 payment in the next 3 weeks. What day is best?"/><button type="submit">Ask</button></form><div class="assistant-prompts"><button type="button" class="assistant-chip" data-prompt="I need to make a $500 payment in the next 3 weeks. What day is best?">Best day for $500</button><button type="button" class="assistant-chip" data-prompt="Can I afford a $300 payment this month?">Can I afford $300?</button><button type="button" class="assistant-chip" data-prompt="What bills are coming up in the next 14 days?">Upcoming bills</button><button type="button" class="assistant-chip" data-prompt="What is my lowest projected balance?">Lowest balance</button></div><div class="assistant-answer" id="assistantAnswer"><h3>Ready when the calendar loads.</h3><div class="assistant-muted">The first version is rule-based so recommendations come from BillsOS balances and scheduled items.</div></div>';
    var reminders = document.querySelector('.reminders-panel');
    var briefing = document.querySelector('.global-briefing');
    if(reminders && reminders.parentNode){reminders.parentNode.insertBefore(panel, reminders);}else if(briefing && briefing.parentNode){briefing.parentNode.insertBefore(panel, briefing.nextSibling);}else{document.body.insertBefore(panel, document.body.firstChild);}
    setupAssistantEvents();
  }

  function monthFromPanel(panel){var id = panel && panel.id ? panel.id.replace('panel-','') : '';return MONTH_NUMS[id];}
  function collectBalances(){var out = [];document.querySelectorAll('.month-panel').forEach(function(panel){var month = monthFromPanel(panel);if(month == null) return;panel.querySelectorAll('.day[data-day]').forEach(function(day){var eod = day.querySelector('.eod b');var balance = parseMoney(eod ? eod.textContent : '');if(balance == null) return;out.push({iso:'2026-' + String(month + 1).padStart(2,'0') + '-' + String(day.getAttribute('data-day')).padStart(2,'0'),balance:balance});});});return out.sort(function(a,b){return a.iso.localeCompare(b.iso);});}
  function collectEvents(){var out = [];document.querySelectorAll('.month-panel').forEach(function(panel){var month = monthFromPanel(panel);if(month == null) return;panel.querySelectorAll('.day[data-day] .ev').forEach(function(ev){var day = ev.closest('.day');var name = cleanText((ev.querySelector('.nm') || {}).textContent || '');var amountText = cleanText((ev.querySelector('.amt') || {}).textContent || '');out.push({iso:'2026-' + String(month + 1).padStart(2,'0') + '-' + String(day.getAttribute('data-day')).padStart(2,'0'),name:name,amount:parseMoney(amountText),amountText:amountText,cls:ev.className || '',done:ev.classList.contains('done')});});});return out.sort(function(a,b){return a.iso.localeCompare(b.iso);});}
  function activeEvents(){var today = todayIso();return collectEvents().filter(function(e){return e.iso >= today && e.cls.indexOf('note') < 0 && !e.done;});}
  function projectedLow(days, amount){var today = todayIso();var rows = collectBalances().filter(function(x){var d = daysBetween(today, x.iso);return d >= 0 && d <= days;}).map(function(x){return {iso:x.iso, balance:x.balance - (amount || 0)};});if(!rows.length) return null;return rows.reduce(function(a,b){return b.balance < a.balance ? b : a;}, rows[0]);}
  function bestPaymentDay(amount, days){var today = todayIso();var balances = collectBalances().filter(function(x){var d = daysBetween(today, x.iso);return d >= 0 && d <= days;});var events = activeEvents();if(!balances.length) return null;return balances.map(function(b){var after = b.balance - amount;var d = daysBetween(today, b.iso);var near = events.filter(function(e){return Math.abs(daysBetween(b.iso, e.iso)) <= 2 && e.cls.indexOf(' in') < 0;});var nearOut = near.reduce(function(sum,e){return sum + Math.abs(e.amount || 0);},0);var incomeNearby = events.some(function(e){return e.cls.indexOf(' in') > -1 && daysBetween(e.iso,b.iso) >= 0 && daysBetween(e.iso,b.iso) <= 2;});return {iso:b.iso, balance:b.balance, after:after, near:near, score:after - (nearOut * 0.35) + (incomeNearby ? 400 : 0) - (d * 0.5)};}).sort(function(a,b){return b.score - a.score;})[0];}

  function extractIntent(question){var q = cleanText(question).toLowerCase();var moneyMatch = q.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);var amount = moneyMatch ? Number(moneyMatch[1].replace(/,/g,'')) : null;var days = 21;var dayMatch = q.match(/next\s+(\d+)\s*(day|days)/i);var weekMatch = q.match(/next\s+(\d+)\s*(week|weeks)/i);if(dayMatch) days = Number(dayMatch[1]);else if(weekMatch) days = Number(weekMatch[1]) * 7;else if(/this month|by month end|end of month/i.test(q)) days = 45;var type = 'general';if(/best|safest|when|what day|which day/.test(q) && amount) type = 'best-day';else if(/afford|can i|safe/.test(q) && amount) type = 'afford';else if(/lowest|min|floor|balance/.test(q)) type = 'lowest';else if(/coming up|upcoming|next bills|what bills|due/.test(q)) type = 'upcoming';return {raw:q, amount:amount, days:days, type:type};}
  function answerBestDay(intent){if(!intent.amount) return '<h3>Add an amount.</h3><div class="assistant-muted">Try: I need to make a $500 payment in the next 3 weeks.</div>';var best = bestPaymentDay(intent.amount, intent.days);var low = projectedLow(intent.days, intent.amount);if(!best) return '<h3>Calendar not loaded yet.</h3><div class="assistant-muted">Try again after the monthly calendar finishes loading.</div>';var status = best.after >= FLOOR ? 'ok' : best.after >= 0 ? 'watch' : 'risk';var nearby = best.near.slice(0,3);return '<h3>Best day: ' + escapeHtml(longDate(best.iso)) + '</h3><div class="assistant-muted">This ranks each available day by projected balance, nearby bills, and income timing.</div><div class="assistant-kpis"><div class="assistant-kpi"><span>Payment</span><b>' + money(intent.amount) + '</b></div><div class="assistant-kpi"><span>Balance after</span><b class="' + status + '">' + money(best.after) + '</b></div><div class="assistant-kpi"><span>Lowest after</span><b>' + money(low ? low.balance : null) + '</b></div></div><ul><li>Recommended because this day leaves the strongest projected cushion in the selected window.</li><li>Cash floor used: ' + money(FLOOR) + '.</li>' + (nearby.length ? '<li>Nearby items to account for: ' + nearby.map(function(e){return escapeHtml(e.name) + ' ' + escapeHtml(e.amountText || money(e.amount));}).join(', ') + '.</li>' : '<li>No major bill cluster detected within two days.</li>') + '</ul>';}
  function answerAfford(intent){if(!intent.amount) return '<h3>Add an amount.</h3><div class="assistant-muted">Try: Can I afford a $300 payment this month?</div>';var lowBefore = projectedLow(intent.days, 0);var lowAfter = projectedLow(intent.days, intent.amount);var ok = lowAfter && lowAfter.balance >= FLOOR;var tight = lowAfter && lowAfter.balance >= 0 && lowAfter.balance < FLOOR;return '<h3>' + (ok ? 'Yes, it appears manageable.' : tight ? 'Possible, but it uses the cushion.' : 'Not recommended from this account window.') + '</h3><div class="assistant-kpis"><div class="assistant-kpi"><span>Payment</span><b>' + money(intent.amount) + '</b></div><div class="assistant-kpi"><span>Current low</span><b>' + money(lowBefore ? lowBefore.balance : null) + '</b></div><div class="assistant-kpi"><span>Low after</span><b class="' + (ok ? 'ok' : tight ? 'watch' : 'risk') + '">' + money(lowAfter ? lowAfter.balance : null) + '</b></div></div><div class="assistant-muted">Lowest point after payment: ' + (lowAfter ? fmtDate(lowAfter.iso) : '—') + '.</div>';}
  function answerUpcoming(intent){var today = todayIso();var items = activeEvents().filter(function(e){return e.cls.indexOf(' in') < 0 && daysBetween(today,e.iso) <= Math.min(intent.days || 14,31);}).slice(0,8);return '<h3>Upcoming bills</h3>' + (items.length ? '<ul>' + items.map(function(e){return '<li>' + escapeHtml(fmtDate(e.iso)) + ' · ' + escapeHtml(e.name) + ' · ' + escapeHtml(e.amountText || money(e.amount)) + '</li>';}).join('') + '</ul>' : '<div class="assistant-muted">No open bill items found in that window.</div>');}
  function answerLowest(intent){var low = projectedLow(intent.days || 31, 0);return '<h3>Lowest projected balance</h3>' + (low ? '<div class="assistant-kpis"><div class="assistant-kpi"><span>Date</span><b>' + escapeHtml(fmtDate(low.iso)) + '</b></div><div class="assistant-kpi"><span>Balance</span><b class="' + (low.balance >= FLOOR ? 'ok' : low.balance >= 0 ? 'watch' : 'risk') + '">' + money(low.balance) + '</b></div><div class="assistant-kpi"><span>Floor</span><b>' + money(FLOOR) + '</b></div></div>' : '<div class="assistant-muted">No balance projection is available yet.</div>');}
  function runAssistant(question){var intent = extractIntent(question || '');if(intent.type === 'best-day') return answerBestDay(intent);if(intent.type === 'afford') return answerAfford(intent);if(intent.type === 'upcoming') return answerUpcoming(intent);if(intent.type === 'lowest') return answerLowest(intent);return '<h3>I can answer timing and cash-flow questions.</h3><div class="assistant-muted">Try asking: best day for a $500 payment, can I afford $300, upcoming bills, or lowest projected balance.</div>';}
  function setAssistantAnswer(html){var answer = document.getElementById('assistantAnswer');if(answer) answer.innerHTML = html;}
  function setupAssistantEvents(){var form = document.getElementById('assistantForm');var input = document.getElementById('assistantInput');if(form && !form.dataset.ready){form.dataset.ready = '1';form.addEventListener('submit',function(e){e.preventDefault();setAssistantAnswer(runAssistant(input ? input.value : ''));});}document.querySelectorAll('.assistant-chip').forEach(function(btn){if(btn.dataset.ready) return;btn.dataset.ready = '1';btn.addEventListener('click',function(){if(input) input.value = btn.getAttribute('data-prompt') || '';setAssistantAnswer(runAssistant(input ? input.value : ''));});});}
  function refreshDefaultAnswer(){var input = document.getElementById('assistantInput');var answer = document.getElementById('assistantAnswer');if(!answer || (input && input.value)) return;if(collectBalances().length){setAssistantAnswer(runAssistant('What is my lowest projected balance?'));}}
  function init(){injectAssistantPanel();refreshDefaultAnswer();var target = document.getElementById('month-panels') || document.body;var observer = new MutationObserver(function(){injectAssistantPanel();refreshDefaultAnswer();});observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
  if(document.readyState === 'loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
