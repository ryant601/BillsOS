(function(){
  'use strict';
  var BUILD='assistant-ui-20260629-2';
  var FLOOR=1000;
  var YEAR=2026;
  var MONTHS={june:6,july:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  var chatHistory=[];

  window.BillsOSModules=window.BillsOSModules||{};

  function text(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function escapeHtml(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function money(n){return n==null||isNaN(n)?'—':'$'+Number(n).toLocaleString(undefined,{maximumFractionDigits:0});}
  function moneySigned(n){return (n<0?'−':'')+money(Math.abs(Number(n||0)));}
  function parseMoney(v){var n=Number(String(v||'').replace(/−/g,'-').replace(/[^0-9.\-]/g,''));return isFinite(n)?n:null;}
  function todayIso(){var d=new Date();d.setHours(0,0,0,0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function addDays(iso,n){var d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function dayDiff(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
  function fmtDate(iso){return iso?new Date(iso+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—';}
  function weekday(iso){return iso?new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'}):'';}
  function isoFromMonthDay(monthName,day){var m=MONTHS[monthName];return m?YEAR+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0'):null;}
  function isIncome(ev){return /\bin\b/.test(' '+(ev.cls||'')+' ');}
  function isNote(ev){return /\bnote\b/.test(' '+(ev.cls||'')+' ');}
  function isDone(ev){return /\bdone\b/.test(' '+(ev.cls||'')+' ');}

  function parseAmount(q){
    var s=String(q||'');
    var explicit=s.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/);
    if(explicit)return Number(explicit[1].replace(/,/g,''));
    var phrase=s.match(/(?:pay|payment|spend|buy|afford|for)\s+([0-9][0-9,]*(?:\.\d{1,2})?)/i);
    return phrase?Number(phrase[1].replace(/,/g,'')):0;
  }
  function parseWindow(q){
    var s=String(q||'').toLowerCase(),m=s.match(/(?:next|within|in)\s+(\d+)\s*(day|days|week|weeks|month|months)/);
    if(m){var n=Number(m[1]);if(m[2].indexOf('week')===0)return n*7;if(m[2].indexOf('month')===0)return n*30;return n;}
    if(/three weeks|3 weeks/.test(s))return 21;
    if(/two weeks|2 weeks/.test(s))return 14;
    if(/this month|month/.test(s))return 30;
    if(/week/.test(s))return 7;
    return 21;
  }

  function allBalances(){
    var out=[];
    Object.keys(MONTHS).forEach(function(month){
      var panel=document.getElementById('panel-'+month);
      if(!panel)return;
      panel.querySelectorAll('.day[data-day]').forEach(function(day){
        var end=day.querySelector('.endline b,.eod b');
        var bal=parseMoney(end&&end.textContent);
        if(bal==null)return;
        var iso=isoFromMonthDay(month,day.getAttribute('data-day'));
        if(iso)out.push({iso:iso,balance:bal});
      });
    });
    return out.sort(function(a,b){return a.iso.localeCompare(b.iso);});
  }

  function cleanEventName(ev){
    var span=ev.querySelector('span:not(.dot),.nm');
    var raw=span?span.textContent:ev.textContent;
    return text(String(raw||'').replace(/Paid from \d{2}-\d{2}|Moved from \d{2}-\d{2}/g,''));
  }
  function allEvents(){
    var out=[];
    Object.keys(MONTHS).forEach(function(month){
      var panel=document.getElementById('panel-'+month);
      if(!panel)return;
      panel.querySelectorAll('.day[data-day] .ev').forEach(function(ev){
        var day=ev.closest('.day');
        var iso=day?isoFromMonthDay(month,day.getAttribute('data-day')):null;
        if(!iso)return;
        var amountNode=ev.querySelector('b,.amt');
        var amount=parseMoney(amountNode&&amountNode.textContent);
        var cls=ev.className||'';
        out.push({iso:iso,name:cleanEventName(ev),amount:amount||0,amountText:text(amountNode&&amountNode.textContent),cls:cls,done:isDone({cls:cls})||!!(ev.querySelector('input[type="checkbox"]')&&ev.querySelector('input[type="checkbox"]').checked)});
      });
    });
    return out.sort(function(a,b){return a.iso.localeCompare(b.iso)||Math.abs(b.amount)-Math.abs(a.amount);});
  }
  function futureEvents(windowDays){
    var t=todayIso(),end=addDays(t,windowDays||30);
    return allEvents().filter(function(e){return e.iso>=t&&e.iso<=end&&!isNote(e)&&!e.done;});
  }
  function futureBalances(windowDays){
    var t=todayIso(),end=addDays(t,windowDays||30);
    return allBalances().filter(function(b){return b.iso>=t&&b.iso<=end;});
  }
  function loaded(){return allBalances().length>0||allEvents().length>0;}

  function lowBalance(windowDays){
    return futureBalances(windowDays).reduce(function(low,b){return !low||b.balance<low.balance?b:low;},null);
  }
  function nearbyBills(iso){
    return futureEvents(60).filter(function(e){return !isIncome(e)&&Math.abs(e.amount||0)>=300&&Math.abs(dayDiff(e.iso,iso))<=3;});
  }
  function recentIncomeBefore(iso){
    return futureEvents(60).filter(isIncome).some(function(e){return e.iso<=iso&&dayDiff(e.iso,iso)<=3;});
  }
  function bestDay(amount,windowDays){
    var days=futureBalances(windowDays),events=futureEvents(windowDays+3);
    if(!days.length)return null;
    return days.map(function(day){
      var near=nearbyBills(day.iso);
      var sameDayBills=events.filter(function(e){return e.iso===day.iso&&!isIncome(e);});
      var after=day.balance-amount;
      var buffer=after-FLOOR;
      var wknd=[0,6].indexOf(new Date(day.iso+'T12:00:00').getDay())>-1;
      var incomeBoost=recentIncomeBefore(day.iso)?225:0;
      var clusterPenalty=near.length*175+sameDayBills.length*90;
      var score=buffer+incomeBoost-clusterPenalty-(wknd?40:0);
      return {iso:day.iso,balance:day.balance,after:after,buffer:buffer,near:near,sameDayBills:sameDayBills,score:score};
    }).sort(function(a,b){return b.score-a.score;})[0];
  }
  function nextIncome(windowDays){return futureEvents(windowDays||45).find(isIncome)||null;}
  function nextBill(windowDays){return futureEvents(windowDays||45).find(function(e){return !isIncome(e);})||null;}

  function paymentAnswer(q){
    var amount=parseAmount(q),windowDays=parseWindow(q),best=bestDay(amount,windowDays),low=lowBalance(windowDays);
    if(!amount)return null;
    if(!best)return '<b>I need more projected calendar data.</b><p>I could not find loaded balance days in that window.</p>';
    var status=best.buffer>=0?'Best fit: '+fmtDate(best.iso):'Possible, but below buffer: '+fmtDate(best.iso);
    return '<b>'+escapeHtml(status)+'</b><ul>'+
      '<li>Payment: <b>'+money(amount)+'</b></li>'+
      '<li>Projected balance that day: <b>'+money(best.balance)+'</b></li>'+
      '<li>After payment: <b>'+money(best.after)+'</b></li>'+
      '<li>Buffer vs '+money(FLOOR)+': <b>'+moneySigned(best.buffer)+'</b></li>'+
      (low?'<li>Lowest balance in window before this payment: '+money(low.balance)+' on '+fmtDate(low.iso)+'</li>':'')+
      (best.near.length?'<li>Watch nearby large items: '+best.near.slice(0,3).map(function(e){return escapeHtml(e.name)+' on '+fmtDate(e.iso);}).join(', ')+'</li>':'<li>No large bill cluster within 3 days.</li>')+
      '</ul><p class="billsos-ai-note">This ranks days by buffer, nearby bills, and recent income timing.</p>';
  }
  function affordAnswer(q){
    var amount=parseAmount(q),windowDays=parseWindow(q),low=lowBalance(windowDays),best=amount?bestDay(amount,windowDays):null;
    if(!amount)return null;
    if(!low||!best)return '<b>I need more projected balance data.</b><p>Reload the dashboard, then ask again.</p>';
    var afterLow=low.balance-amount;
    return '<b>'+(afterLow>=FLOOR?'Looks workable':'Needs review')+'</b><ul>'+
      '<li>Amount: <b>'+money(amount)+'</b></li>'+
      '<li>Current lowest projected balance: '+money(low.balance)+' on '+fmtDate(low.iso)+'</li>'+
      '<li>Lowest balance after payment: <b>'+money(afterLow)+'</b></li>'+
      '<li>Best timing found: '+fmtDate(best.iso)+' after projected balance '+money(best.after)+'</li>'+
      '</ul>'+(afterLow<FLOOR?'<p class="billsos-ai-note">I would avoid this unless you move another bill, wait for income, or lower the amount.</p>':'<p class="billsos-ai-note">This stays above the current BillsOS floor.</p>');
  }
  function upcomingAnswer(q){
    var windowDays=parseWindow(q),items=futureEvents(windowDays).filter(function(e){return !isIncome(e);}).slice(0,8);
    return '<b>Upcoming open items</b>'+(items.length?'<ul>'+items.map(function(e){return '<li>'+fmtDate(e.iso)+' · '+escapeHtml(e.name)+' · <b>'+escapeHtml(e.amountText||money(Math.abs(e.amount)))+'</b></li>';}).join('')+'</ul>':'<p>No open bill items found in the next '+windowDays+' days.</p>');
  }
  function lowAnswer(q){
    var windowDays=parseWindow(q),low=lowBalance(windowDays);
    return low?'<b>Lowest projected balance</b><ul><li>'+fmtDate(low.iso)+': <b>'+money(low.balance)+'</b></li><li>Window reviewed: '+windowDays+' days</li></ul>':'<b>No projected balances found.</b><p>Reload the dashboard and ask again.</p>';
  }
  function summaryAnswer(){
    var inc=nextIncome(45),bill=nextBill(45),low=lowBalance(30),open=futureEvents(30).filter(function(e){return !isIncome(e);}).length;
    return '<b>Current BillsOS read</b><ul>'+
      '<li>Next income: '+(inc?fmtDate(inc.iso)+' · '+escapeHtml(inc.name):'—')+'</li>'+
      '<li>Next bill: '+(bill?fmtDate(bill.iso)+' · '+escapeHtml(bill.name)+' · '+escapeHtml(bill.amountText||money(Math.abs(bill.amount))):'—')+'</li>'+
      '<li>Open items in next 30 days: '+open+'</li>'+
      '<li>30-day low: '+(low?money(low.balance)+' on '+fmtDate(low.iso):'—')+'</li>'+
      '</ul>';
  }
  function generalAnswer(q){
    var s=String(q||'').toLowerCase();
    if(/what can you do|help|examples|sample/.test(s))return '<b>Ask me things like:</b><ul><li>“Best day to pay $500 in the next 3 weeks”</li><li>“Can I afford $800 this month?”</li><li>“What bills are coming up?”</li><li>“What is my lowest projected balance?”</li></ul>';
    if(/how.*work|logic|rank/.test(s))return '<b>Payment timing logic</b><p>I rank available days by projected balance after the payment, distance from the '+money(FLOOR)+' floor, nearby large bills, and recent income timing.</p>';
    return '<b>I can help with this inside BillsOS.</b><p>For now, this bubble is optimized for your BillsOS data: payment timing, affordability, upcoming bills, and balance risk. Ask with a dollar amount for the strongest answer.</p><p class="billsos-ai-note">Open-ended AI for any topic needs a server-side AI endpoint so the API key stays private.</p>';
  }
  function reply(q){
    if(!loaded())return '<b>Still loading BillsOS data.</b><p>Try again after the dashboard finishes loading.</p>';
    var s=String(q||'').toLowerCase();
    if(/afford|spend|buy|can i/.test(s)&&parseAmount(q))return affordAnswer(q);
    if(/best|when|day|date|pay|payment/.test(s)&&parseAmount(q))return paymentAnswer(q);
    if(/upcoming|coming up|bills|due|next bill/.test(s))return upcomingAnswer(q);
    if(/lowest|low|minimum|floor|risk|buffer/.test(s))return lowAnswer(q);
    if(/summary|status|where.*stand|current read/.test(s))return summaryAnswer();
    return generalAnswer(q);
  }

  function addStyle(){
    if(document.getElementById('billsos-assistant-ui-style'))return;
    var s=document.createElement('style');
    s.id='billsos-assistant-ui-style';
    s.textContent='.billsos-ai-fab{position:fixed!important;right:16px!important;bottom:18px!important;z-index:2147483647!important;border:0!important;border-radius:999px!important;background:#14202c!important;color:#fff!important;padding:13px 16px!important;box-shadow:0 16px 38px rgba(20,35,55,.32)!important;font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;display:flex!important;gap:9px!important;align-items:center!important;cursor:pointer!important}.billsos-ai-dot{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;background:rgba(255,255,255,.16)!important}.billsos-ai-sheet{position:fixed!important;right:16px!important;bottom:82px!important;width:min(460px,calc(100vw - 32px))!important;max-height:72vh!important;z-index:2147483646!important;background:#fff!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:22px!important;box-shadow:0 24px 70px rgba(20,35,55,.28)!important;display:none!important;overflow:hidden!important}.billsos-ai-sheet.open{display:flex!important;flex-direction:column!important}.billsos-ai-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:13px 14px!important;border-bottom:1px solid rgba(20,35,55,.1)!important;font:800 14px system-ui!important;color:#14202c!important}.billsos-ai-sub{display:block!important;font:500 11px system-ui!important;color:#64748b!important;margin-top:2px!important}.billsos-ai-close{border:1px solid rgba(20,35,55,.12)!important;background:#fff!important;border-radius:999px!important;width:30px!important;height:30px!important;font-size:18px!important;color:#41505f!important}.billsos-ai-log{padding:14px!important;background:#f8fafc!important;color:#14202c!important;font:500 13px/1.4 system-ui!important;overflow:auto!important;display:flex!important;flex-direction:column!important;gap:9px!important}.billsos-msg{border:1px solid rgba(20,35,55,.1)!important;background:#fff!important;border-radius:16px!important;padding:10px 11px!important;max-width:94%!important}.billsos-msg.user{background:#14202c!important;color:#fff!important;align-self:flex-end!important}.billsos-msg ul{margin:8px 0 0 18px!important;padding:0!important}.billsos-msg li{margin:4px 0!important}.billsos-msg p{margin:7px 0 0!important}.billsos-ai-note{color:#64748b!important;font-size:12px!important}.billsos-ai-prompts{display:flex!important;gap:7px!important;flex-wrap:wrap!important;padding:10px 10px 0!important;background:#fff!important;border-top:1px solid rgba(20,35,55,.1)!important}.billsos-ai-prompt{border:1px solid rgba(20,35,55,.12)!important;background:#f8fafc!important;color:#334155!important;border-radius:999px!important;padding:7px 9px!important;font:750 11px system-ui!important}.billsos-ai-form{display:flex!important;gap:8px!important;padding:10px!important;background:#fff!important}.billsos-ai-form input{flex:1!important;min-width:0!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:999px!important;padding:10px 12px!important;font-size:14px!important}.billsos-ai-form button{border:0!important;background:#14202c!important;color:#fff!important;border-radius:999px!important;padding:10px 13px!important;font-weight:800!important}@media(max-width:760px){.billsos-ai-sheet{left:0!important;right:0!important;bottom:0!important;width:auto!important;max-height:82vh!important;border-radius:22px 22px 0 0!important}.billsos-ai-fab{right:14px!important;bottom:14px!important}.billsos-ai-prompt{width:100%!important;text-align:left!important}}';
    document.head.appendChild(s);
  }
  function addMsg(kind,html){
    var log=document.getElementById('billsosAiLog');if(!log)return;
    var d=document.createElement('div');d.className='billsos-msg '+kind;d.innerHTML=kind==='user'?escapeHtml(html):html;
    log.appendChild(d);log.scrollTop=log.scrollHeight;
  }
  function ask(q){
    q=text(q);if(!q)return;
    chatHistory.push({role:'user',text:q,at:new Date().toISOString()});
    addMsg('user',q);
    var answer=reply(q);
    chatHistory.push({role:'assistant',html:answer,at:new Date().toISOString()});
    addMsg('',answer);
  }
  function make(){
    if(document.getElementById('billsosAiFab'))return;
    var sheet=document.createElement('section');
    sheet.id='billsosAiSheet';sheet.className='billsos-ai-sheet';
    sheet.innerHTML='<div class="billsos-ai-head"><div><span>BillsOS Assistant</span><span class="billsos-ai-sub">Payment timing · upcoming bills · balance checks</span></div><button class="billsos-ai-close" id="billsosAiClose" type="button">×</button></div><div class="billsos-ai-log" id="billsosAiLog"><div class="billsos-msg"><b>BillsOS</b><p>Ask: “Best day to pay $500 in the next 3 weeks.”</p></div></div><div class="billsos-ai-prompts"><button class="billsos-ai-prompt" type="button">Best day to pay $500 in the next 3 weeks</button><button class="billsos-ai-prompt" type="button">Can I afford $800 this month?</button><button class="billsos-ai-prompt" type="button">What bills are coming up?</button><button class="billsos-ai-prompt" type="button">Lowest projected balance</button></div><form class="billsos-ai-form" id="billsosAiForm"><input id="billsosAiInput" autocomplete="off" placeholder="Ask BillsOS…"><button>Ask</button></form>';
    var fab=document.createElement('button');
    fab.id='billsosAiFab';fab.className='billsos-ai-fab';fab.type='button';fab.innerHTML='<span class="billsos-ai-dot">💬</span><span>Ask BillsOS</span>';
    document.body.appendChild(sheet);document.body.appendChild(fab);
    fab.onclick=function(){sheet.classList.toggle('open');if(sheet.classList.contains('open'))setTimeout(function(){var input=document.getElementById('billsosAiInput');if(input)input.focus();},50);};
    document.getElementById('billsosAiClose').onclick=function(){sheet.classList.remove('open');};
    document.getElementById('billsosAiForm').onsubmit=function(e){e.preventDefault();var input=document.getElementById('billsosAiInput');ask(input.value);input.value='';};
    document.querySelectorAll('.billsos-ai-prompt').forEach(function(btn){btn.onclick=function(){ask(btn.textContent);};});
  }
  function init(){
    try{addStyle();make();window.BillsOSModules.assistant={loaded:true,build:BUILD,at:new Date().toISOString()};}
    catch(e){window.BillsOSModules.assistant={loaded:false,error:String(e&&e.message||e),build:BUILD};}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();