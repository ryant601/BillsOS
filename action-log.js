(function(){
  var KEY='billsos-action-log-v1';
  var THEME_KEY='billsos-theme-v1';
  var CHECKMARK_KEY='billsos-generated-done-v5';
  var META_ID='__billsos_action_log__';
  var syncing=false;
  var checkmarkSyncing=false;
  var lastCheckmarkUpdatedAt=null;

  function readLocal(){try{var rows=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(rows)?rows:[]}catch(e){return []}}
  function saveLocal(rows){localStorage.setItem(KEY,JSON.stringify((rows||[]).slice(0,30)))}
  function clean(s){return String(s||'').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function fmt(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0})}
  function val(id){var el=document.getElementById(id);return el?el.value:''}
  function currentTheme(){return localStorage.getItem(THEME_KEY)||'light'}
  function themeLabel(){return currentTheme()==='dark'?'☀️':'🌙'}
  function loadCss(id,href){if(document.getElementById(id))return;var l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
  function loadJs(id,src){if(document.getElementById(id))return;var s=document.createElement('script');s.id=id;s.src=src;s.defer=true;document.head.appendChild(s)}
  function loadDesign(){loadCss('billsosDesignCss','/billsos-design.css?v=20260629manrope1');loadCss('billsosImpactCss','/billsos-impact.css?v=20260629move1');loadCss('billsosDarkA11yCss','/billsos-dark-a11y.css?v=20260629a11y1');loadJs('billsosWeekToggleJs','/billsos-week-toggle.js?v=20260629week2');loadJs('billsosCashflowEngine','/cashflow-engine.js?v=20260630engine1');loadJs('billsosAssistantUi','/assistant-ui.js?v=20260630assistant9');loadJs('billsosAssistantAiBridge','/assistant-ai-bridge.js?v=20260630bridge7')}

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

  function readMeta(row){try{var parsed=JSON.parse(row&&row.notes||'[]');return Array.isArray(parsed)?parsed:[]}catch(e){return []}}
  function hideMetaRows(){document.querySelectorAll('tr').forEach(function(tr){if((tr.textContent||'').indexOf('BillsOS action log')>=0)tr.style.display='none'})}
  function moneyNumber(text){var n=Number(String(text||'').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function enhanceDashboard(){try{var now=new Date(),heading=document.querySelector('.monthHead h2'),monthText=heading?heading.textContent:'',isThisMonth=monthText.indexOf(now.getFullYear())>=0&&monthText.toLowerCase().indexOf(now.toLocaleString('en-US',{month:'long'}).toLowerCase())>=0;document.querySelectorAll('.ev').forEach(function(ev){if((ev.textContent||'').indexOf('BillsOS action log')>=0)ev.style.display='none'});document.querySelectorAll('.day').forEach(function(day){day.classList.remove('today','low','negative','has-more');var first=day.querySelector('.topline span:first-child b'),end=day.querySelector('.endline b'),events=day.querySelector('.events');if(first&&isThisMonth&&Number(first.textContent)===now.getDate())day.classList.add('today');if(end){var bal=moneyNumber(end.textContent);if(bal<0)day.classList.add('negative');else if(bal>0&&bal<1000)day.classList.add('low')}if(events&&events.scrollHeight>events.clientHeight+8)day.classList.add('has-more')})}catch(e){}}

  async function pullCloud(){try{var r=await fetch('/api/bills?actionLogPull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json(),meta=(data.oneTimeEvents||[]).find(function(x){return x&&x.id===META_ID});if(meta){var cloud=readMeta(meta);if(cloud.length){saveLocal(cloud);renderLog()}}hideMetaRows()}catch(e){}}
  async function pushCloud(rows){if(syncing)return;syncing=true;try{var r=await fetch('/api/bills?actionLogPush='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];var idx=data.oneTimeEvents.findIndex(function(x){return x&&x.id===META_ID});var row={id:META_ID,name:'BillsOS action log',type:'meta',amount:0,date:null,notes:JSON.stringify((rows||[]).slice(0,30))};if(idx>=0)data.oneTimeEvents[idx]=row;else data.oneTimeEvents.push(row);await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});hideMetaRows()}catch(e){}finally{syncing=false}}
  function addLog(text){var rows=readLocal();rows.unshift({time:new Date().toISOString(),text:String(text||'')});rows=rows.slice(0,30);saveLocal(rows);renderLog();pushCloud(rows)}
  window.BillsOSLogAction=addLog;

  function renderLog(){var box=document.getElementById('billsosActionLogRows');if(!box)return;var rows=readLocal().slice(0,10);box.innerHTML=rows.length?rows.map(function(row){var d=new Date(row.time);return '<div class="billsosActionRow"><span>'+clean(d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))+'</span><b>'+clean(row.text)+'</b></div>'}).join(''):'<div class="billsosActionEmpty">No recent actions recorded.</div>'}
  function addPanel(){if(document.getElementById('billsosActionLog')){renderLog();hideMetaRows();return}var anchor=document.querySelector('.grid');if(!anchor)return;var card=document.createElement('div');card.id='billsosActionLog';card.className='card billsosActionCard';card.innerHTML='<div class="billsosActionHead"><h2>Action summary</h2><button class="billsosActionClear" type="button" id="billsosActionClear">Clear</button></div><div id="billsosActionLogRows"></div>';anchor.parentNode.insertBefore(card,anchor.nextSibling);var clear=document.getElementById('billsosActionClear');if(clear)clear.onclick=function(){saveLocal([]);renderLog();pushCloud([])};renderLog();hideMetaRows()}

  function wrap(name,makeText){var original=window[name];if(typeof original!=='function'||original.__actionWrapped)return;var wrapped=function(){var text='';try{text=makeText()}catch(e){}var result=original.apply(this,arguments);if(text)addLog(text);return result};wrapped.__actionWrapped=true;window[name]=wrapped}
  function wrapControl(){wrap('saveOneFromForm',function(){return 'Added one-time item: '+(val('oneName')||'One-time item')+' — '+fmt(val('oneAmount'))});wrap('saveBillFromForm',function(){return 'Added/updated bill: '+(val('billName')||'Bill')+' — '+fmt(val('billAmount'))});wrap('saveIncomeFromForm',function(){return 'Added/updated income: '+(val('incomeName')||'Income')+' — '+fmt(val('incomeAmount'))});wrap('saveBalanceCorrection',function(){return 'Added balance correction: '+(val('balNote')||'Balance correction')+' — '+fmt(val('balAmount'))})}

  document.addEventListener('change',function(e){var cb=e.target;if(!cb||cb.type!=='checkbox'||!cb.dataset||!cb.dataset.id)return;var label=cb.closest('label'),name=label&&label.querySelector('span')?label.querySelector('span').textContent.trim():'item',amt=label&&label.querySelector('b')?' — '+label.querySelector('b').textContent.trim():'';addLog((cb.checked?'Marked completed: ':'Reopened: ')+name+amt);setTimeout(function(){pushCheckmarks(doneFromDom())},0)},true);
  document.addEventListener('DOMContentLoaded',function(){loadDesign();applyTheme();pullCloud();setTimeout(pullCheckmarks,200);setTimeout(pullCheckmarks,900);setTimeout(addThemeToggle,200);setTimeout(addPanel,300);setTimeout(addPanel,1200);setTimeout(wrapControl,500);setTimeout(wrapControl,1500);setTimeout(hideMetaRows,1800);setInterval(enhanceDashboard,500);setInterval(pullCheckmarks,15000)});
})();