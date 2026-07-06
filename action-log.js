(function(){
  var KEY='billsos-action-log-v1';
  var THEME_KEY='billsos-theme-v1';
  var CHECKMARK_KEY='billsos-generated-done-v5';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var META_ID='__billsos_action_log__';
  var RULE_ID='__billsos_system_rules__';
  var syncing=false;
  var checkmarkSyncing=false;
  var amountSyncing=false;
  var lastCheckmarkUpdatedAt=null;
  var lastAmountSignature='';

  function readLocal(){try{var rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows:[]}catch(e){return []}}
  function saveLocal(rows){localStorage.setItem(KEY,JSON.stringify((rows||[]).slice(0,30)))}
  function clean(s){return String(s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function fmt(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0})}
  function val(id){var el=document.getElementById(id);return el?el.value:''}
  function currentTheme(){return localStorage.getItem(THEME_KEY)||'light'}
  function themeLabel(){return currentTheme()==='dark'?'☀️':'🌙'}
  function loadCss(id,href){if(document.getElementById(id))return;var l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
  function loadJs(id,src){if(document.getElementById(id))return;var s=document.createElement('script');s.id=id;s.src=src;s.defer=true;document.head.appendChild(s)}
  function loadDesign(){loadCss('billsosDesignCss','/billsos-design.css?v=20260629manrope1');loadCss('billsosImpactCss','/billsos-impact.css?v=20260630assistantbubble1');loadCss('billsosDarkA11yCss','/billsos-dark-a11y.css?v=20260629a11y1');loadJs('billsosWeekToggleJs','/billsos-week-toggle.js?v=20260629week2');loadJs('billsosCashflowEngine','/cashflow-engine.js?v=20260706sweep2');loadJs('billsosAssistantUi','/assistant-ui.js?v=20260630assistant9');loadJs('billsosAssistantAiBridge','/assistant-ai-bridge.js?v=20260630bridge7');loadJs('billsosMonthExport','/billsos-month-export.js?v=20260706card1')}

  function installSweepVisuals(){
    if(document.getElementById('billsosSweepVisuals'))return;
    var s=document.createElement('style');
    s.id='billsosSweepVisuals';
    s.textContent='.ev.sweep{background:#ede9fe!important;color:#5b21b6!important;border-color:rgba(91,33,182,.34)!important}.ev.sweep span,.ev.sweep b{color:#5b21b6!important}.ev.sweep .dot{background:#7c3aed!important;box-shadow:0 0 0 2px rgba(124,58,237,.18)!important}.ev.sweep.done{opacity:.58}.detailItem.sweep{background:#f3efff!important;border-color:rgba(91,33,182,.26)!important}.detailItem.sweep .amt,.detailItem.sweep .dir,.detailItem.sweep .name{color:#5b21b6!important}.week-strip .day .ev.sweep{background:#ede9fe!important;color:#5b21b6!important}.mobile-sheet .detailItem.sweep{background:#f3efff!important;border-color:rgba(91,33,182,.26)!important}';
    document.head.appendChild(s);
  }
  function tagSweepRows(){
    installSweepVisuals();
    document.querySelectorAll('.ev,label.ev,.detailItem').forEach(function(el){var txt=(el.textContent||'').toLowerCase();if(txt.indexOf('sweep')>=0){el.classList.add('sweep');if(el.classList.contains('out'))el.classList.remove('out')}});
  }
  function applyTheme(){var dark=currentTheme()==='dark';document.documentElement.setAttribute('data-billsos-theme',dark?'dark':'light');var btn=document.getElementById('billsosThemeToggle');if(btn){btn.innerHTML='<span class="themeIcon">'+themeLabel()+'</span><span class="themeText">'+(dark?'Light':'Dark')+'</span>';btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode')}}
  function toggleTheme(){localStorage.setItem(THEME_KEY,currentTheme()==='dark'?'light':'dark');applyTheme()}
  function addThemeToggle(){if(document.getElementById('billsosThemeToggle'))return;var host=document.querySelector('.nav');if(!host)return;var btn=document.createElement('button');btn.id='billsosThemeToggle';btn.type='button';btn.className='billsosThemeToggle';btn.onclick=toggleTheme;host.appendChild(btn);applyTheme()}

  function readDone(){try{var done=JSON.parse(localStorage.getItem(CHECKMARK_KEY)||'{}');return done&&typeof done==='object'&&!Array.isArray(done)?done:{}}catch(e){return {}}}
  function saveDone(done){try{localStorage.setItem(CHECKMARK_KEY,JSON.stringify(done||{}))}catch(e){}}
  function cleanDone(done){var out={};Object.keys(done||{}).forEach(function(k){if(done[k])out[k]=1});return out}
  function dashboardHasCheckmarks(){return !!document.querySelector('input[type="checkbox"][data-id]')||location.pathname==='/'||location.pathname.indexOf('/generated')===0}
  function doneFromDom(){var done={};document.querySelectorAll('input[type="checkbox"][data-id]').forEach(function(cb){if(cb.checked)done[cb.dataset.id]=1});return done}
  function applyDone(done){done=cleanDone(done);saveDone(done);document.querySelectorAll('input[type="checkbox"][data-id]').forEach(function(cb){var checked=!!done[cb.dataset.id];cb.checked=checked;var row=cb.closest('.ev');if(row)row.classList.toggle('done',checked)});enhanceDashboard()}
  function primeCheckmarks(){if(location.pathname.indexOf('/control')===0)return;try{var xhr=new XMLHttpRequest();xhr.open('GET','/api/checkmarks?prime='+Date.now(),false);xhr.setRequestHeader('Cache-Control','no-store');xhr.send(null);if(xhr.status>=200&&xhr.status<300){var data=JSON.parse(xhr.responseText||'{}');if(data&&data.completed){lastCheckmarkUpdatedAt=data.updatedAt||null;saveDone(cleanDone(data.completed))}}}catch(e){}}
  async function pullCheckmarks(){if(!dashboardHasCheckmarks())return;try{var r=await fetch('/api/checkmarks?pull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();if(!data||!data.completed)return;if(data.updatedAt&&data.updatedAt===lastCheckmarkUpdatedAt)return;lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt;applyDone(data.completed)}catch(e){}}
  async function pushCheckmarks(done){if(checkmarkSyncing)return;checkmarkSyncing=true;done=cleanDone(done||doneFromDom());saveDone(done);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:done})});if(r.ok){var data=await r.json();lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt}}catch(e){}finally{checkmarkSyncing=false}}
  primeCheckmarks();

  function readAmountLocal(){try{var map=JSON.parse(localStorage.getItem(AMOUNT_KEY)||'{}');return map&&typeof map==='object'&&!Array.isArray(map)?map:{}}catch(e){return {}}}
  function cleanAmountMap(map){var out={};Object.keys(map||{}).forEach(function(k){var row=map[k]||{},amount=Number(row.amount);if(Number.isFinite(amount)&&amount>=0)out[k]={amount:Math.round(amount*100)/100,updatedAt:row.updatedAt||null}});return out}
  function saveAmountLocal(map){try{localStorage.setItem(AMOUNT_KEY,JSON.stringify(cleanAmountMap(map||{})));nudgeDashboard()}catch(e){}}
  function amountSignature(map){try{return JSON.stringify(cleanAmountMap(map||{}))}catch(e){return '{}'}}
  function mergeAmountMaps(local,cloud){var out={},keys={};local=cleanAmountMap(local);cloud=cleanAmountMap(cloud);Object.keys(local).forEach(function(k){keys[k]=1});Object.keys(cloud).forEach(function(k){keys[k]=1});Object.keys(keys).forEach(function(k){var l=local[k],c=cloud[k];if(!l)out[k]=c;else if(!c)out[k]=l;else{var lt=Date.parse(l.updatedAt||'')||0,ct=Date.parse(c.updatedAt||'')||0;out[k]=ct>lt?c:l}});return out}
  function readRuleNotes(row){try{return JSON.parse(row&&row.notes||'{}')||{}}catch(e){return {}}}
  function readCloudAmounts(data){var row=(data.oneTimeEvents||[]).find(function(x){return x&&x.id===RULE_ID}),notes=readRuleNotes(row);return cleanAmountMap(notes.amountAdjustments||{})}
  function nudgeDashboard(){try{var marker=document.createElement('span');marker.hidden=true;marker.setAttribute('data-billsos-amount-sync','1');(document.body||document.documentElement).appendChild(marker);setTimeout(function(){marker.remove()},40)}catch(e){}}
  function mergeControlState(data){var current=controlState();if(!current)return data;data.bills=current.bills;data.oneTimeEvents=current.oneTimeEvents;data.income=current.income;data.updatedAt=current.updatedAt;return data}
  async function pullAmounts(){try{var r=await fetch('/api/bills?amountPull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json(),cloud=readCloudAmounts(data),local=readAmountLocal(),merged=mergeAmountMaps(local,cloud),mergedSig=amountSignature(merged);if(mergedSig!==amountSignature(local))saveAmountLocal(merged);lastAmountSignature=mergedSig;if(mergedSig!==amountSignature(cloud))setTimeout(function(){pushAmounts(merged)},250)}catch(e){}}
  async function pushAmounts(map){if(amountSyncing)return;amountSyncing=true;try{map=cleanAmountMap(map||readAmountLocal());var r=await fetch('/api/bills?amountPush='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();data=mergeControlState(data||{});data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];var idx=data.oneTimeEvents.findIndex(function(x){return x&&x.id===RULE_ID}),row=idx>=0?data.oneTimeEvents[idx]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'},notes=readRuleNotes(row);notes.amountAdjustments=map;row.notes=JSON.stringify(notes);if(idx>=0)data.oneTimeEvents[idx]=row;else data.oneTimeEvents.push(row);var saved=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(saved.ok)lastAmountSignature=amountSignature(map)}catch(e){}finally{amountSyncing=false}}
  function watchAmountLocal(){lastAmountSignature=amountSignature(readAmountLocal());setInterval(function(){var current=amountSignature(readAmountLocal());if(current!==lastAmountSignature){lastAmountSignature=current;pushAmounts(readAmountLocal())}},1000)}

  function readMeta(row){try{var parsed=JSON.parse(row&&row.notes||'[]');return Array.isArray(parsed)?parsed:[]}catch(e){return []}}
  function hideMetaRows(){document.querySelectorAll('tr').forEach(function(tr){var txt=tr.textContent||'';if(txt.indexOf('BillsOS action log')>=0||txt.indexOf('BillsOS system rules')>=0)tr.style.display='none'})}
  function removeBalanceBridge(){document.querySelectorAll('.drawerBalanceBridge').forEach(function(node){node.remove()})}
  function moneyNumber(text){var n=Number(String(text||'').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function enhanceDashboard(){try{removeBalanceBridge();tagSweepRows();var now=new Date(),heading=document.querySelector('.monthHead h2'),monthText=heading?heading.textContent:'',isThisMonth=monthText.indexOf(now.getFullYear())>=0&&monthText.toLowerCase().indexOf(now.toLocaleString('en-US',{month:'long'}).toLowerCase())>=0;document.querySelectorAll('.ev').forEach(function(ev){var txt=(ev.textContent||'').toLowerCase();if(txt.indexOf('billsos action log')>=0)ev.style.display='none';if(txt.indexOf('sweep')>=0){ev.classList.add('sweep');ev.classList.remove('out')}});document.querySelectorAll('.day').forEach(function(day){day.classList.remove('today','low','negative','has-more');var first=day.querySelector('.topline span:first-child b'),end=day.querySelector('.endline b'),events=day.querySelector('.events');if(first&&isThisMonth&&Number(first.textContent)===now.getDate())day.classList.add('today');if(end){var bal=moneyNumber(end.textContent);if(bal<0)day.classList.add('negative');else if(bal>0&&bal<1000)day.classList.add('low')}if(events&&events.scrollHeight>events.clientHeight+8)day.classList.add('has-more')})}catch(e){}}

  function controlState(){try{if(location.pathname.indexOf('/control')!==0)return null;if(typeof state==='undefined'||!state||typeof state!=='object')return null;return {bills:Array.isArray(state.bills)?state.bills:[],oneTimeEvents:Array.isArray(state.oneTimeEvents)?state.oneTimeEvents:[],income:Array.isArray(state.income)?state.income:[],updatedAt:state.updatedAt||null}}catch(e){return null}}
  async function pullCloud(){try{var r=await fetch('/api/bills?actionLogPull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json(),meta=(data.oneTimeEvents||[]).find(function(x){return x&&x.id===META_ID});if(meta){var cloud=readMeta(meta);if(cloud.length){saveLocal(cloud);renderLog()}}hideMetaRows();removeBalanceBridge()}catch(e){}}
  async function pushCloud(rows){if(syncing)return;syncing=true;try{var r=await fetch('/api/bills?actionLogPush='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();data=mergeControlState(data||{});data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];var idx=data.oneTimeEvents.findIndex(function(x){return x&&x.id===META_ID});var row={id:META_ID,name:'BillsOS action log',type:'meta',amount:0,date:null,notes:JSON.stringify((rows||[]).slice(0,30))};if(idx>=0)data.oneTimeEvents[idx]=row;else data.oneTimeEvents.push(row);await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});hideMetaRows();removeBalanceBridge()}catch(e){}finally{syncing=false}}
  function addLog(text){var rows=readLocal();rows.unshift({time:new Date().toISOString(),text:String(text||'')});rows=rows.slice(0,30);saveLocal(rows);renderLog();pushCloud(rows)}
  window.BillsOSLogAction=addLog;

  function renderLog(){var box=document.getElementById('billsosActionLogRows');if(!box)return;var rows=readLocal().slice(0,10);box.innerHTML=rows.length?rows.map(function(row){var d=new Date(row.time);return '<div class="billsosActionRow"><span>'+clean(d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</span><b>'+clean(row.text)+'</b></div>'}).join(''):'<div class="billsosActionEmpty">No recent actions recorded.</div>'}
  function addPanel(){if(document.getElementById('billsosActionLog')){renderLog();hideMetaRows();removeBalanceBridge();return}var anchor=document.querySelector('.grid');if(!anchor)return;var card=document.createElement('div');card.id='billsosActionLog';card.className='card billsosActionCard';card.innerHTML='<div class="billsosActionHead"><h2>Action summary</h2><button class="billsosActionClear" type="button" id="billsosActionClear">Clear</button></div><div id="billsosActionLogRows"></div>';anchor.parentNode.insertBefore(card,anchor.nextSibling);var clear=document.getElementById('billsosActionClear');if(clear)clear.onclick=function(){saveLocal([]);renderLog();pushCloud([])};renderLog();hideMetaRows();removeBalanceBridge()}

  function wrap(name,makeText){var original=window[name];if(typeof original!=='function'||original.__actionWrapped)return;var wrapped=function(){var text='';try{text=makeText()}catch(e){}var result=original.apply(this,arguments);if(text)addLog(text);return result};wrapped.__actionWrapped=true;window[name]=wrapped}
  function wrapControl(){wrap('saveOneFromForm',function(){return 'Added one-time item: '+(val('oneName')||'One-time item')+' — '+fmt(val('oneAmount'))});wrap('saveBillFromForm',function(){return 'Added/updated bill: '+(val('billName')||'Bill')+' — '+fmt(val('billAmount'))});wrap('saveIncomeFromForm',function(){return 'Added/updated income: '+(val('incomeName')||'Income')+' — '+fmt(val('incomeAmount'))});wrap('saveBalanceCorrection',function(){return 'Added balance correction: '+(val('balNote')||'Balance correction')+' — '+fmt(val('balAmount'))})}

  installSweepVisuals();watchAmountLocal();
  document.addEventListener('change',function(e){var cb=e.target;if(!cb||cb.type!=='checkbox'||!cb.dataset||!cb.dataset.id)return;var label=cb.closest('label'),name=label&&label.querySelector('span')?label.querySelector('span').textContent.trim():'item',amt=label&&label.querySelector('b')?' — '+label.querySelector('b').textContent.trim():'';addLog((cb.checked?'Marked completed: ':'Reopened: ')+name+amt);setTimeout(function(){pushCheckmarks(doneFromDom())},0)},true);
  document.addEventListener('DOMContentLoaded',function(){installSweepVisuals();loadDesign();applyTheme();pullCloud();pullAmounts();setTimeout(pullAmounts,900);setTimeout(pullCheckmarks,200);setTimeout(pullCheckmarks,900);setTimeout(addThemeToggle,200);setTimeout(addPanel,300);setTimeout(addPanel,1200);setTimeout(wrapControl,500);setTimeout(wrapControl,1500);setTimeout(hideMetaRows,1800);setTimeout(removeBalanceBridge,1900);setTimeout(tagSweepRows,300);setInterval(enhanceDashboard,500);setInterval(removeBalanceBridge,500);setInterval(pullCheckmarks,15000);setInterval(pullAmounts,15000)});
})();
