(function(){
  'use strict';
  var BUILD='assistant-ui-20260702-modelintent1';
  var engine=null;
  window.BillsOSModules=window.BillsOSModules||{};

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function n(v){var x=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(x)?x:null}
  function money(v){return v==null||isNaN(v)?'—':'$'+Number(Math.max(0,v)).toLocaleString(undefined,{maximumFractionDigits:0})}
  function signed(v){return (v<0?'−':'')+'$'+Math.abs(Number(v||0)).toLocaleString(undefined,{maximumFractionDigits:0})}
  function fmt(i){return i?new Date(i+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—'}
  function today(){return engine&&engine.today?engine.today():(function(){var d=new Date();d.setHours(0,0,0,0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()}
  function addDays(i,c){if(engine&&engine.addDays)return engine.addDays(i,c);var d=new Date(i+'T12:00:00');d.setDate(d.getDate()+c);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function monthNum(name){return {january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12}[String(name||'').toLowerCase()]||null}
  function monthName(num){return ['','January','February','March','April','May','June','July','August','September','October','November','December'][Number(num)||0]||''}
  function iso(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
  function validIso(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}

  function parseMonthText(text){
    var m=(String(text||'').match(/January|February|March|April|May|June|July|August|September|October|November|December/i)||[])[0];
    var y=(String(text||'').match(/20\d{2}/)||[])[0]||'2026';
    return m?{name:m.charAt(0).toUpperCase()+m.slice(1).toLowerCase(),month:monthNum(m),year:Number(y)}:null;
  }
  function eventAmount(ev){
    var input=ev.querySelector('input[data-id]'),id=input&&input.dataset&&input.dataset.id;
    if(id&&id.indexOf('|')>=0){var parts=id.split('|'),x=Number(parts[parts.length-1]);if(isFinite(x)&&x!==0)return x}
    var b=ev.querySelector('b:last-child')||ev.querySelector('b,.amt');var y=n(b&&b.textContent);return y==null?0:y;
  }
  function eventName(ev){var span=ev.querySelector('span:not(.dot)')||ev.querySelector('.nm')||ev;return clean(span.textContent).replace(/\$[0-9,]+(?:\.\d{1,2})?/g,'').replace(/⋯/g,'').replace(/^\s*[✓○]\s*/,'').trim()}
  function isIncome(ev){return /\bin\b|paycheck|income/i.test((ev.className||'')+' '+(ev.textContent||''))}
  function isHiddenMeta(ev){var s=clean(ev&&ev.textContent).toLowerCase();return s.indexOf('billsos action log')>=0||s.indexOf('balance correction')>=0}

  function parsePanel(panel){
    var head=panel.querySelector('.monthHead h2,.monthHead,h2'),mm=parseMonthText(head&&head.textContent),days=[];
    if(!mm)return null;
    panel.querySelectorAll('.day').forEach(function(dayNode){
      var day=Number(((dayNode.querySelector('.topline span:first-child b')||dayNode.querySelector('.topline b')||{}).textContent)||0);if(!day)return;
      var id=iso(mm.year,mm.month,day),endNode=dayNode.querySelector('.endline b'),startNode=dayNode.querySelector('.topline span:last-child b'),ending=n(endNode&&endNode.textContent),starting=n(startNode&&startNode.textContent),events=[];
      dayNode.querySelectorAll('.ev').forEach(function(ev){if(isHiddenMeta(ev))return;events.push({iso:id,day:day,name:eventName(ev),amount:eventAmount(ev),income:isIncome(ev),done:/\bdone\b/.test(ev.className||'')})});
      days.push({iso:id,day:day,month:mm.month,year:mm.year,starting:starting,ending:ending,events:events});
    });
    return days.length?{month:mm,days:days}:null;
  }

  function parseRoot(root){
    var panels=[],nodes=Array.prototype.slice.call(root.querySelectorAll('.calPanel'));
    if(!nodes.length)nodes=Array.prototype.slice.call(root.querySelectorAll('[id^="panel-"],section,main')).filter(function(x){return x.querySelector&&x.querySelector('.monthHead,.day')});
    if(!nodes.length)nodes=[root];
    nodes.forEach(function(node){var p=parsePanel(node);if(p)panels.push(p)});
    var byKey={},days=[],events=[];
    panels.forEach(function(p){var key=p.month.year+'-'+String(p.month.month).padStart(2,'0');if(byKey[key])return;byKey[key]=1;p.days.forEach(function(d){days.push(d);d.events.forEach(function(e){events.push(e)})})});
    days.sort(function(a,b){return a.iso.localeCompare(b.iso)});events.sort(function(a,b){return a.iso.localeCompare(b.iso)});
    return {loaded:days.length>0,days:days,events:events,months:Object.keys(byKey).sort(),source:'rendered-dom'};
  }

  async function engineCalendar(){
    if(!engine||typeof engine.build!=='function')return null;
    var res=await fetch('/api/bills?assistantAllMonths='+Date.now(),{cache:'no-store'});
    if(!res.ok)return null;
    var data=await res.json();
    var model=engine.build(data,{floorNegative:true});
    var balanceByIso={};
    (model.balances||[]).forEach(function(b){balanceByIso[b.iso]=b.balance});
    var eventByIso={};
    (model.events||[]).forEach(function(e){
      if(String(e.name||'').toLowerCase().indexOf('billsos action log')>=0)return;
      if(String(e.name||'').toLowerCase().indexOf('balance correction')>=0||String(e.type||'').toLowerCase().indexOf('calculation-only')>=0)return;
      (eventByIso[e.iso]||(eventByIso[e.iso]=[])).push({iso:e.iso,day:Number(String(e.iso).slice(8,10)),name:e.name,amount:Number(e.amount||0),income:engine.isIncome?engine.isIncome(e):Number(e.amount||0)>0,done:!!e.done});
    });
    var days=[],events=[],months=[];
    (engine.MONTHS||[]).forEach(function(mm){
      var y=engine.YEAR||2026,m=mm[1],dim=new Date(y,m,0).getDate(),key=y+'-'+String(m).padStart(2,'0'),prev=null;
      months.push(key);
      for(var d=1;d<=dim;d++){
        var id=iso(y,m,d),ending=balanceByIso[id],starting=prev==null?null:prev,evs=eventByIso[id]||[];
        evs.forEach(function(e){events.push(e)});
        days.push({iso:id,day:d,month:m,year:y,starting:starting,ending:ending,events:evs});
        if(ending!=null)prev=ending;
      }
    });
    return {loaded:days.length>0,days:days,events:events,months:months,source:'cashflow-engine-all-months',updatedAt:data.updatedAt||null};
  }

  async function readCalendar(){
    try{var all=await engineCalendar();if(all&&all.loaded)return all}catch(_e){}
    return parseRoot(document);
  }

  async function parseIntent(q){
    try{
      var res=await fetch('/api/assistant/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});
      var data=await res.json().catch(function(){return null});
      if(res.ok&&data&&data.intent)return data.intent;
    }catch(_e){}
    return null;
  }

  function explicitMonth(q){var m=(String(q||'').toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/)||[])[1];return m?'2026-'+String(monthNum(m)).padStart(2,'0'):null}
  function quarterScope(q){var s=String(q||'').toLowerCase(),m=s.match(/\bq([1-4])\b|\b([1-4])(?:st|nd|rd|th)?\s+quarter\b/);if(!m)return null;var qn=Number(m[1]||m[2]),start=(qn-1)*3+1,end=start+2,y=2026;return{start:iso(y,start,1),end:iso(y,end,new Date(y,end,0).getDate()),label:'Q'+qn,source:'local fallback'}}
  function scope(q,cal,intent){
    if(intent&&validIso(intent.dateStart)&&validIso(intent.dateEnd))return {start:intent.dateStart,end:intent.dateEnd,label:intent.scopeLabel||'model-selected period',source:'model intent'};
    var qs=quarterScope(q);if(qs)return qs;
    var em=explicitMonth(q),s=String(q||'').toLowerCase(),start,end,label;
    if(em){var y=Number(em.slice(0,4)),m=Number(em.slice(5,7));start=em+'-01';end=em+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');label=monthName(m);return {start:start,end:end,label:label,source:'local fallback'}}
    var match=s.match(/(?:next|within|in)\s+(\d+)\s*(day|days|week|weeks|month|months)/),count=null;
    if(match)count=Number(match[1])*(match[2].indexOf('week')===0?7:match[2].indexOf('month')===0?30:1);else if(/three weeks|3 weeks/.test(s))count=21;else if(/two weeks|2 weeks/.test(s))count=14;else if(/week/.test(s))count=7;else if(/month/.test(s))count=30;
    if(count){start=today();end=addDays(start,count);return {start:start,end:end,label:'next '+count+' days',source:'local fallback'}}
    var first=cal.days[0],last=cal.days[cal.days.length-1];return {start:first&&first.iso||today(),end:last&&last.iso||addDays(today(),30),label:'all months',source:'default'};
  }
  function parseAmount(q,intent){if(intent&&Number(intent.amount)>0)return Number(intent.amount);if(engine&&engine.parseAmount)return engine.parseAmount(q);var m=String(q||'').match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/)||String(q||'').match(/(?:pay|payment|spend|buy|afford|for)\s+([0-9][0-9,]*(?:\.\d{1,2})?)/i);return m?Number(m[1].replace(/,/g,'')):0}
  function daysIn(cal,sc){return cal.days.filter(function(d){return d.iso>=sc.start&&d.iso<=sc.end&&d.ending!=null})}
  function lowDay(cal,sc){return daysIn(cal,sc).reduce(function(a,b){return !a||b.ending<a.ending?b:a},null)}
  function nearby(cal,iso){return cal.events.filter(function(e){var diff=Math.round((new Date(e.iso+'T12:00:00')-new Date(iso+'T12:00:00'))/86400000);return !e.income&&!e.done&&Math.abs(diff)<=3&&Math.abs(e.amount)>=300})}
  function bestDay(cal,amt,sc){var ds=daysIn(cal,sc);if(!ds.length)return null;return ds.map(function(d){var after=Math.max(0,d.ending-amt),buffer=after-1000,near=nearby(cal,d.iso),same=cal.events.filter(function(e){return e.iso===d.iso&&!e.income&&!e.done}),wknd=[0,6].indexOf(new Date(d.iso+'T12:00:00').getDay())>-1,score=buffer-near.length*175-same.length*90-(wknd?40:0);return {iso:d.iso,balance:d.ending,after:after,buffer:buffer,near:near,score:score}}).sort(function(a,b){return b.score-a.score})[0]}
  function calMonthKeys(sc){var out=[],d=new Date(sc.start+'T12:00:00'),end=new Date(sc.end+'T12:00:00');d.setDate(1);while(d<=end){out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));d.setMonth(d.getMonth()+1)}return out}
  function monthCount(sc){var seen={};calMonthKeys(sc).forEach(function(k){seen[k]=1});return Object.keys(seen).length||1}
  function averageSpend(cal,sc){
    var billEvents=cal.events.filter(function(e){return e.iso>=sc.start&&e.iso<=sc.end&&!e.income&&!e.done&&Number(e.amount||0)<0});
    var total=billEvents.reduce(function(sum,e){return sum+Math.abs(Number(e.amount||0))},0);
    var start=new Date(sc.start+'T12:00:00'),end=new Date(sc.end+'T12:00:00');
    var days=Math.max(1,Math.round((end-start)/86400000)+1),months=monthCount(sc),daily=total/days,monthly=total/months;
    var largest=billEvents.slice().sort(function(a,b){return Math.abs(b.amount)-Math.abs(a.amount)}).slice(0,4);
    return {total:total,days:days,months:months,daily:daily,monthly:monthly,items:billEvents.length,largest:largest};
  }

  async function answer(q,intent){
    var cal=await readCalendar();if(!cal.loaded)return '<b>I could not read the calendar model.</b><p>Refresh the dashboard and try again.</p>';
    var sc=scope(q,cal,intent),s=String(q||'').toLowerCase(),amt=parseAmount(q,intent),available=daysIn(cal,sc),source=cal.source==='cashflow-engine-all-months'?'all months model':'rendered view';
    if(!available.length)return '<b>No calendar balances found for '+esc(sc.label)+'.</b><p>The assistant checked '+esc(source)+'.</p>';
    var intentName=(intent&&intent.intent)||'';
    if(intentName==='spend_average'||/average|avg|daily spend|monthly spend|spend per day|spend per month/.test(s)){
      var a=averageSpend(cal,sc),wantMonthly=/monthly|per month|q[1-4]|quarter/.test(s);
      return '<b>'+(wantMonthly?'Average monthly outflow: '+money(a.monthly):'Average daily outflow: '+money(a.daily))+'</b><ul><li>Period reviewed: '+esc(sc.label)+'</li><li>Interpretation: '+esc(sc.source||'local')+'</li><li>Source: '+esc(source)+'</li><li>Total scheduled outflow: <b>'+money(a.total)+'</b></li><li>Months included: <b>'+a.months+'</b></li><li>Days included: <b>'+a.days+'</b></li><li>Items included: <b>'+a.items+'</b></li>'+(a.largest.length?'<li>Largest items: '+a.largest.map(function(e){return esc(e.name)+' '+money(Math.abs(e.amount))+' on '+fmt(e.iso)}).join(', ')+'</li>':'')+'</ul>';
    }
    if((intentName==='payment_timing'||/best|when|day|date|pay|payment|safest/.test(s))&&amt){var b=bestDay(cal,amt,sc),l=lowDay(cal,sc);if(!b)return '<b>I could not find calendar days for '+esc(sc.label)+'.</b>';return '<b>'+(b.buffer>=0?'Best fit: ':'Needs review: ')+fmt(b.iso)+'</b><ul><li>Period reviewed: '+esc(sc.label)+'</li><li>Interpretation: '+esc(sc.source||'local')+'</li><li>Source: '+esc(source)+'</li><li>Payment: <b>'+money(amt)+'</b></li><li>Ending balance that day: <b>'+money(b.balance)+'</b></li><li>After payment: <b>'+money(b.after)+'</b></li><li>Buffer vs $1,000: <b>'+signed(b.buffer)+'</b></li>'+(l?'<li>Lowest ending balance in period: '+money(l.ending)+' on '+fmt(l.iso)+'</li>':'')+(b.near.length?'<li>Nearby large items: '+b.near.slice(0,3).map(function(e){return esc(e.name)+' on '+fmt(e.iso)}).join(', ')+'</li>':'<li>No large bill cluster within 3 days.</li>')+'</ul>'}
    if(intentName==='low_balance'||/lowest|low|minimum|floor|risk|buffer|projection/.test(s)){var low=lowDay(cal,sc);return low?'<b>Lowest calendar balance</b><ul><li>Period reviewed: '+esc(sc.label)+'</li><li>Interpretation: '+esc(sc.source||'local')+'</li><li>Source: '+esc(source)+'</li><li>'+fmt(low.iso)+': <b>'+money(low.ending)+'</b></li></ul>':'<b>No balances found for '+esc(sc.label)+'.</b>'}
    if(intentName==='upcoming_bills'||/upcoming|coming up|bills|due|next bill/.test(s)){var items=cal.events.filter(function(e){return e.iso>=sc.start&&e.iso<=sc.end&&!e.income&&!e.done}).slice(0,8);return '<b>Upcoming items</b><ul><li>Period reviewed: '+esc(sc.label)+'</li><li>Interpretation: '+esc(sc.source||'local')+'</li><li>Source: '+esc(source)+'</li>'+(items.length?items.map(function(e){return '<li>'+fmt(e.iso)+' · '+esc(e.name)+' · <b>'+money(Math.abs(e.amount))+'</b></li>'}).join(''):'<li>No open bill items found.</li>')+'</ul>'}
    return '<b>I can answer from the model-interpreted BillsOS scope.</b><ul><li>Loaded months: '+esc((cal.months||[]).join(', '))+'</li><li>Try “Average monthly spend in Q4”</li><li>Try “Lowest balance after Thanksgiving”</li><li>Try “Best day to pay $500 in the first half of November”</li></ul>';
  }

  function addMsg(cls,html){var log=document.getElementById('billsosAiLog');if(!log)return null;var msg=document.createElement('div');msg.className='billsos-msg '+(cls||'');msg.innerHTML=html;log.appendChild(msg);log.scrollTop=log.scrollHeight;return msg}
  async function ask(q){q=clean(q);if(!q)return;addMsg('user',esc(q));var p=addMsg('','<b>Checking BillsOS.</b><p>Interpreting the request, then calculating from all months.</p>');try{var intent=await parseIntent(q);var html=await answer(q,intent);if(p&&p.parentNode)p.parentNode.removeChild(p);addMsg('',html)}catch(e){if(p&&p.parentNode)p.parentNode.removeChild(p);addMsg('','<b>I could not answer from the BillsOS model.</b><p>'+esc(e&&e.message||e)+'</p>')}}
  function addStyle(){if(document.getElementById('billsos-assistant-ui-style'))return;var style=document.createElement('style');style.id='billsos-assistant-ui-style';style.textContent='.billsos-ai-fab{position:fixed!important;right:16px!important;bottom:18px!important;z-index:2147483647!important;border:0!important;border-radius:999px!important;background:#14202c!important;color:#fff!important;padding:13px 16px!important;box-shadow:0 16px 38px rgba(20,35,55,.32)!important;font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;display:flex!important;gap:9px!important;align-items:center!important}.billsos-ai-dot{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;background:rgba(255,255,255,.16)!important}.billsos-ai-sheet{position:fixed!important;right:16px!important;bottom:82px!important;width:min(460px,calc(100vw - 32px))!important;max-height:72vh!important;z-index:2147483646!important;background:#fff!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:22px!important;box-shadow:0 24px 70px rgba(20,35,55,.28)!important;display:none!important;overflow:hidden!important}.billsos-ai-sheet.open{display:flex!important;flex-direction:column!important}.billsos-ai-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:13px 14px!important;border-bottom:1px solid rgba(20,35,55,.1)!important;font:800 14px system-ui!important;color:#14202c!important}.billsos-ai-sub{display:block!important;font:500 11px system-ui!important;color:#64748b!important;margin-top:2px!important}.billsos-ai-close{border:1px solid rgba(20,35,55,.12)!important;background:#fff!important;border-radius:999px!important;width:30px!important;height:30px!important;font-size:18px!important;color:#41505f!important}.billsos-ai-log{padding:14px!important;background:#f8fafc!important;color:#14202c!important;font:500 13px/1.4 system-ui!important;overflow:auto!important;display:flex!important;flex-direction:column!important;gap:9px!important}.billsos-msg{border:1px solid rgba(20,35,55,.1)!important;background:#fff!important;border-radius:16px!important;padding:10px 11px!important;max-width:94%!important}.billsos-msg.user{background:#14202c!important;color:#fff!important;align-self:flex-end!important}.billsos-msg ul{margin:8px 0 0 18px!important;padding:0!important}.billsos-msg li{margin:4px 0!important}.billsos-msg p{margin:7px 0 0!important}.billsos-ai-prompts{display:flex!important;gap:7px!important;flex-wrap:wrap!important;padding:10px 10px 0!important;background:#fff!important;border-top:1px solid rgba(20,35,55,.1)!important}.billsos-ai-prompt{border:1px solid rgba(20,35,55,.12)!important;background:#f8fafc!important;color:#334155!important;border-radius:999px!important;padding:7px 9px!important;font:750 11px system-ui!important}.billsos-ai-form{display:flex!important;gap:8px!important;padding:10px!important;background:#fff!important}.billsos-ai-form input{flex:1!important;border:1px solid rgba(20,35,55,.14)!important;border-radius:13px!important;padding:10px 11px!important;font:500 13px system-ui!important}.billsos-ai-form button{border:0!important;border-radius:13px!important;background:#14202c!important;color:#fff!important;font:800 13px system-ui!important;padding:0 13px!important}.billsos-ai-source{margin-top:8px!important;color:#64748b!important;font-size:11px!important}';document.head.appendChild(style)}
  function make(){if(document.getElementById('billsosAiFab'))return;var sheet=document.createElement('section');sheet.id='billsosAiSheet';sheet.className='billsos-ai-sheet';sheet.innerHTML='<div class="billsos-ai-head"><div><span>BillsOS Assistant</span><span class="billsos-ai-sub">Model interpretation · BillsOS math</span></div><button class="billsos-ai-close" id="billsosAiClose" type="button">×</button></div><div class="billsos-ai-log" id="billsosAiLog"><div class="billsos-msg"><b>BillsOS</b><p>Ask: “Average monthly spend in Q4.”</p></div></div><div class="billsos-ai-prompts"><button class="billsos-ai-prompt" type="button">Average monthly spend in Q4</button><button class="billsos-ai-prompt" type="button">Lowest balance after Thanksgiving</button><button class="billsos-ai-prompt" type="button">What bills are coming up next month?</button></div><form class="billsos-ai-form" id="billsosAiForm"><input id="billsosAiInput" autocomplete="off" placeholder="Ask BillsOS…"><button>Ask</button></form>';var fab=document.createElement('button');fab.id='billsosAiFab';fab.className='billsos-ai-fab';fab.type='button';fab.innerHTML='<span class="billsos-ai-dot">💬</span><span>Ask BillsOS</span>';document.body.appendChild(sheet);document.body.appendChild(fab);fab.onclick=function(){sheet.classList.toggle('open');if(sheet.classList.contains('open'))setTimeout(function(){var input=document.getElementById('billsosAiInput');if(input)input.focus()},50)};document.getElementById('billsosAiClose').onclick=function(){sheet.classList.remove('open')};document.getElementById('billsosAiForm').onsubmit=function(e){e.preventDefault();var input=document.getElementById('billsosAiInput');ask(input.value);input.value=''};document.querySelectorAll('.billsos-ai-prompt').forEach(function(b){b.onclick=function(){ask(b.textContent)}})}
  function init(){try{engine=window.BillsOSCashflow||null;addStyle();make();window.BillsOSModules.assistant={loaded:true,build:BUILD,source:engine?'cashflow-engine-all-months':'rendered-dom-fallback',interpretation:'openai-intent-first',engine:engine&&engine.BUILD,at:new Date().toISOString()}}catch(e){window.BillsOSModules.assistant={loaded:false,error:String(e&&e.message||e),build:BUILD}}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
