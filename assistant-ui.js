(function(){
  'use strict';
  var BUILD='assistant-ui-20260630-6';
  var engine=null,data=null,model=null,loadState='loading';
  window.BillsOSModules=window.BillsOSModules||{};

  function clean(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function esc(value){return String(value||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function isIncome(event){return engine&&engine.isIncome?engine.isIncome(event):Number(event&&event.amount||0)>0;}
  function loadEngine(){engine=window.BillsOSCashflow||null;return !!engine;}
  function scoped(question){return engine.scopeFromQuestion(question);}
  function openEvents(scope){return engine.openEvents(model,scope).filter(function(event){return !event.done;});}

  async function loadData(){
    try{
      loadState='loading';
      if(!loadEngine())throw new Error('Cashflow engine is not loaded');
      var response=await fetch('/api/bills?assistant='+Date.now(),{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      data=engine.norm(await response.json());
      model=engine.build(data);
      loadState='ready';
      window.BillsOSModules.assistantData={loaded:true,build:BUILD,engine:engine.BUILD,at:new Date().toISOString(),updatedAt:data.updatedAt||null};
    }catch(err){
      loadState='error';
      window.BillsOSModules.assistantData={loaded:false,build:BUILD,error:String(err&&err.message||err),at:new Date().toISOString()};
    }
  }

  function payment(question){
    var amount=engine.parseAmount(question),scope=scoped(question),best=engine.bestPaymentDay(model,amount,scope),low=engine.lowBalance(model,scope);
    if(!amount)return null;
    if(!best)return '<b>I could not find projected days for '+esc(scope.label)+'.</b>';
    return '<b>'+(best.buffer>=0?'Best fit: ':'Needs review: ')+engine.fmt(best.iso)+'</b><ul><li>Period reviewed: '+esc(scope.label)+'</li><li>Payment: <b>'+engine.dollars(amount)+'</b></li><li>Projected balance that day: <b>'+engine.dollars(best.balance)+'</b></li><li>After payment: <b>'+engine.dollars(best.after)+'</b></li><li>Buffer vs '+engine.dollars(engine.FLOOR)+': <b>'+engine.signed(best.buffer)+'</b></li>'+(low?'<li>Lowest projected balance in period: '+engine.dollars(low.balance)+' on '+engine.fmt(low.iso)+'</li>':'')+(best.near&&best.near.length?'<li>Nearby large items: '+best.near.slice(0,3).map(function(event){return esc(event.name)+' on '+engine.fmt(event.iso);}).join(', ')+'</li>':'<li>No large bill cluster within 3 days.</li>')+'</ul>';
  }
  function afford(question){
    var amount=engine.parseAmount(question),scope=scoped(question),low=engine.lowBalance(model,scope),best=amount?engine.bestPaymentDay(model,amount,scope):null;
    if(!amount)return null;
    if(!low||!best)return '<b>I could not find projected balances for '+esc(scope.label)+'.</b>';
    var after=Math.max(0,low.balance-amount);
    return '<b>'+(after>=engine.FLOOR?'Looks workable':'Needs review')+'</b><ul><li>Period reviewed: '+esc(scope.label)+'</li><li>Amount: <b>'+engine.dollars(amount)+'</b></li><li>Lowest projected balance: '+engine.dollars(low.balance)+' on '+engine.fmt(low.iso)+'</li><li>Lowest balance after payment: <b>'+engine.dollars(after)+'</b></li><li>Best timing found: '+engine.fmt(best.iso)+' after projected balance '+engine.dollars(best.after)+'</li></ul>';
  }
  function upcoming(question){
    var scope=scoped(question),items=openEvents(scope).filter(function(event){return !isIncome(event);}).slice(0,8);
    return '<b>Upcoming open items</b><ul><li>Period reviewed: '+esc(scope.label)+'</li>'+(items.length?items.map(function(event){return '<li>'+engine.fmt(event.iso)+' · '+esc(event.name)+' · <b>'+esc(event.amountText||engine.dollars(Math.abs(event.amount)))+'</b></li>';}).join(''):'<li>No open bill items found.</li>')+'</ul>';
  }
  function lowAnswer(question){
    var scope=scoped(question),low=engine.lowBalance(model,scope);
    return low?'<b>Lowest projected balance</b><ul><li>Period reviewed: '+esc(scope.label)+'</li><li>'+engine.fmt(low.iso)+': <b>'+engine.dollars(low.balance)+'</b></li></ul>':'<b>No projected balances found for '+esc(scope.label)+'.</b>';
  }
  function summary(){
    var scope={start:engine.today(),end:engine.addDays(engine.today(),30),label:'next 30 days'},events=openEvents(scope),income=events.find(isIncome),bill=events.find(function(event){return !isIncome(event);}),low=engine.lowBalance(model,scope);
    return '<b>Current BillsOS read</b><ul><li>Next income: '+(income?engine.fmt(income.iso)+' · '+esc(income.name):'—')+'</li><li>Next bill: '+(bill?engine.fmt(bill.iso)+' · '+esc(bill.name)+' · '+esc(bill.amountText):'—')+'</li><li>Open items in next 30 days: '+events.filter(function(event){return !isIncome(event);}).length+'</li><li>30-day low: '+(low?engine.dollars(low.balance)+' on '+engine.fmt(low.iso):'—')+'</li></ul>';
  }
  function general(){return '<b>I can answer BillsOS questions.</b><ul><li>“Lowest balance in October”</li><li>“Best day to pay $500 in July”</li><li>“Can I afford $800 this month?”</li><li>“What bills are coming up next month?”</li></ul>';}
  function reply(question){
    if(loadState==='loading')return '<b>Loading BillsOS data.</b><p>Try again in a moment.</p>';
    if(loadState==='error')return '<b>I could not read BillsOS data yet.</b><p>Refresh the dashboard. If this persists, the assistant cannot reach the shared cash-flow engine or /api/bills.</p>';
    var text=String(question||'').toLowerCase();
    if(/afford|spend|buy|can i/.test(text)&&engine.parseAmount(question))return afford(question);
    if(/best|when|day|date|pay|payment/.test(text)&&engine.parseAmount(question))return payment(question);
    if(/upcoming|coming up|bills|due|next bill/.test(text))return upcoming(question);
    if(/lowest|low|minimum|floor|risk|buffer|projection/.test(text))return lowAnswer(question);
    if(/summary|status|where.*stand|current read/.test(text))return summary();
    return general();
  }

  function addStyle(){
    if(document.getElementById('billsos-assistant-ui-style'))return;
    var style=document.createElement('style');
    style.id='billsos-assistant-ui-style';
    style.textContent='.billsos-ai-fab{position:fixed!important;right:16px!important;bottom:18px!important;z-index:2147483647!important;border:0!important;border-radius:999px!important;background:#14202c!important;color:#fff!important;padding:13px 16px!important;box-shadow:0 16px 38px rgba(20,35,55,.32)!important;font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;display:flex!important;gap:9px!important;align-items:center!important}.billsos-ai-dot{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;background:rgba(255,255,255,.16)!important}.billsos-ai-sheet{position:fixed!important;right:16px!important;bottom:82px!important;width:min(460px,calc(100vw - 32px))!important;max-height:72vh!important;z-index:2147483646!important;background:#fff!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:22px!important;box-shadow:0 24px 70px rgba(20,35,55,.28)!important;display:none!important;overflow:hidden!important}.billsos-ai-sheet.open{display:flex!important;flex-direction:column!important}.billsos-ai-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:13px 14px!important;border-bottom:1px solid rgba(20,35,55,.1)!important;font:800 14px system-ui!important;color:#14202c!important}.billsos-ai-sub{display:block!important;font:500 11px system-ui!important;color:#64748b!important;margin-top:2px!important}.billsos-ai-close{border:1px solid rgba(20,35,55,.12)!important;background:#fff!important;border-radius:999px!important;width:30px!important;height:30px!important;font-size:18px!important;color:#41505f!important}.billsos-ai-log{padding:14px!important;background:#f8fafc!important;color:#14202c!important;font:500 13px/1.4 system-ui!important;overflow:auto!important;display:flex!important;flex-direction:column!important;gap:9px!important}.billsos-msg{border:1px solid rgba(20,35,55,.1)!important;background:#fff!important;border-radius:16px!important;padding:10px 11px!important;max-width:94%!important}.billsos-msg.user{background:#14202c!important;color:#fff!important;align-self:flex-end!important}.billsos-msg ul{margin:8px 0 0 18px!important;padding:0!important}.billsos-msg li{margin:4px 0!important}.billsos-msg p{margin:7px 0 0!important}.billsos-ai-prompts{display:flex!important;gap:7px!important;flex-wrap:wrap!important;padding:10px 10px 0!important;background:#fff!important;border-top:1px solid rgba(20,35,55,.1)!important}.billsos-ai-prompt{border:1px solid rgba(20,35,55,.12)!important;background:#f8fafc!important;color:#334155!important;border-radius:999px!important;padding:7px 9px!important;font:750 11px system-ui!important}.billsos-ai-form{display:flex!important;gap:8px!important;padding:10px!important;background:#fff!important}.billsos-ai-form input{flex:1!important;min-width:0!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:999px!important;padding:10px 12px!important;font-size:14px!important}.billsos-ai-form button{border:0!important;background:#14202c!important;color:#fff!important;border-radius:999px!important;padding:10px 13px!important;font-weight:800!important}@media(max-width:760px){.billsos-ai-sheet{left:0!important;right:0!important;bottom:0!important;width:auto!important;max-height:82vh!important;border-radius:22px 22px 0 0!important}.billsos-ai-fab{right:14px!important;bottom:14px!important}.billsos-ai-prompt{width:100%!important;text-align:left!important}}';
    document.head.appendChild(style);
  }
  function addMsg(kind,html){var log=document.getElementById('billsosAiLog');if(!log)return null;var node=document.createElement('div');node.className='billsos-msg '+kind;node.innerHTML=kind==='user'?esc(html):html;log.appendChild(node);log.scrollTop=log.scrollHeight;return node;}
  function ask(question){question=clean(question);if(!question)return;addMsg('user',question);addMsg('',reply(question));}
  function make(){
    if(document.getElementById('billsosAiFab'))return;
    var sheet=document.createElement('section');
    sheet.id='billsosAiSheet';sheet.className='billsos-ai-sheet';
    sheet.innerHTML='<div class="billsos-ai-head"><div><span>BillsOS Assistant</span><span class="billsos-ai-sub">Payment timing · upcoming bills · balance checks</span></div><button class="billsos-ai-close" id="billsosAiClose" type="button">×</button></div><div class="billsos-ai-log" id="billsosAiLog"><div class="billsos-msg"><b>BillsOS</b><p>Ask: “Lowest balance in October.”</p></div></div><div class="billsos-ai-prompts"><button class="billsos-ai-prompt" type="button">Lowest balance in October</button><button class="billsos-ai-prompt" type="button">Best day to pay $500 in the next 3 weeks</button><button class="billsos-ai-prompt" type="button">Can I afford $800 this month?</button><button class="billsos-ai-prompt" type="button">What bills are coming up next month?</button></div><form class="billsos-ai-form" id="billsosAiForm"><input id="billsosAiInput" autocomplete="off" placeholder="Ask BillsOS…"><button>Ask</button></form>';
    var fab=document.createElement('button');fab.id='billsosAiFab';fab.className='billsos-ai-fab';fab.type='button';fab.innerHTML='<span class="billsos-ai-dot">💬</span><span>Ask BillsOS</span>';
    document.body.appendChild(sheet);document.body.appendChild(fab);
    fab.onclick=function(){sheet.classList.toggle('open');if(sheet.classList.contains('open'))setTimeout(function(){var input=document.getElementById('billsosAiInput');if(input)input.focus();},50);};
    document.getElementById('billsosAiClose').onclick=function(){sheet.classList.remove('open');};
    document.getElementById('billsosAiForm').onsubmit=function(event){event.preventDefault();var input=document.getElementById('billsosAiInput');ask(input.value);input.value='';};
    document.querySelectorAll('.billsos-ai-prompt').forEach(function(button){button.onclick=function(){ask(button.textContent);};});
  }
  function init(){
    try{addStyle();make();loadData();setTimeout(loadData,1200);window.BillsOSModules.assistant={loaded:true,build:BUILD,engine:window.BillsOSCashflow&&window.BillsOSCashflow.BUILD,at:new Date().toISOString()};}
    catch(err){window.BillsOSModules.assistant={loaded:false,error:String(err&&err.message||err),build:BUILD};}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
