(function(){
  var THEME_KEY='billsos-theme-v1';
  var CHECKMARK_KEY='billsos-generated-done-v5';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var LOW_BALANCE_WARNING=300;
  var LEGACY_META_IDS={__billsos_action_log__:1,__billsos_system_rules__:1};
  var checkmarkSyncing=false;
  var lastCheckmarkUpdatedAt=null;
  var lastAmountSignature='';
  var purgePosted=false;

  function currentTheme(){return localStorage.getItem(THEME_KEY)||'light'}
  function themeLabel(){return currentTheme()==='dark'?'☀️':'🌙'}
  function loadCss(id,href){if(document.getElementById(id))return;var l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
  function loadJs(id,src){if(document.getElementById(id))return;var s=document.createElement('script');s.id=id;s.src=src;s.defer=true;document.head.appendChild(s)}
  function loadDesign(){loadCss('billsosDesignCss','/billsos-design.css?v=20260629manrope1');loadCss('billsosImpactCss','/billsos-impact.css?v=20260630assistantbubble1');loadCss('billsosDarkA11yCss','/billsos-dark-a11y.css?v=20260629a11y1');loadJs('billsosWeekToggleJs','/billsos-week-toggle.js?v=20260826q12027a');loadJs('billsosCashflowEngine','/cashflow-engine.js?v=20260826q12027a');loadJs('billsosAssistantUi','/assistant-ui.js?v=20260826q12027a');loadJs('billsosAssistantAiBridge','/assistant-ai-bridge.js?v=20260820format1');loadJs('billsosMonthExport','/billsos-month-export.js?v=20260826transparent2')}

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

  function saveDone(done){try{localStorage.setItem(CHECKMARK_KEY,JSON.stringify(done||{}))}catch(e){}}
  function cleanDone(done){var out={};Object.keys(done||{}).forEach(function(k){if(done[k])out[k]=1});return out}
  function dashboardHasCheckmarks(){return !!document.querySelector('input[type="checkbox"][data-id]')||location.pathname==='/'||location.pathname.indexOf('/generated')===0}
  function doneFromDom(){var done={};document.querySelectorAll('input[type="checkbox"][data-id]').forEach(function(cb){if(cb.checked)done[cb.dataset.id]=1});return done}
  function applyDone(done){done=cleanDone(done);saveDone(done);document.querySelectorAll('input[type="checkbox"][data-id]').forEach(function(cb){var checked=!!done[cb.dataset.id];cb.checked=checked;var row=cb.closest('.ev');if(row)row.classList.toggle('done',checked)});enhanceDashboard()}
  function primeCheckmarks(){if(location.pathname.indexOf('/control')===0)return;try{var xhr=new XMLHttpRequest();xhr.open('GET','/api/checkmarks?prime='+Date.now(),false);xhr.setRequestHeader('Cache-Control','no-store');xhr.send(null);if(xhr.status>=200&&xhr.status<300){var data=JSON.parse(xhr.responseText||'{}');if(data&&data.completed){lastCheckmarkUpdatedAt=data.updatedAt||null;saveDone(cleanDone(data.completed))}}}catch(e){}}
  async function pullCheckmarks(){if(!dashboardHasCheckmarks())return;try{var r=await fetch('/api/checkmarks?pull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();if(!data||!data.completed)return;if(data.updatedAt&&data.updatedAt===lastCheckmarkUpdatedAt)return;lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt;applyDone(data.completed)}catch(e){}}
  async function pushCheckmarks(done){if(checkmarkSyncing)return;checkmarkSyncing=true;done=cleanDone(done||doneFromDom());saveDone(done);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:done})});if(r.ok){var data=await r.json();lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt}}catch(e){}finally{checkmarkSyncing=false}}
  primeCheckmarks();

  function cleanAmountMap(map){var out={};Object.keys(map||{}).forEach(function(k){var row=map[k]||{},amount=Number(row.amount);if(Number.isFinite(amount)&&amount>=0)out[k]={amount:Math.round(amount*100)/100,updatedAt:row.updatedAt||null}});return out}
  function readAmountLocal(){try{var map=JSON.parse(localStorage.getItem(AMOUNT_KEY)||'{}');return map&&typeof map==='object'&&!Array.isArray(map)?cleanAmountMap(map):{}}catch(e){return {}}}
  function amountSignature(map){try{return JSON.stringify(cleanAmountMap(map||{}))}catch(e){return '{}'}}
  function nudgeDashboard(){try{var marker=document.createElement('span');marker.hidden=true;marker.setAttribute('data-billsos-amount-sync','1');(document.body||document.documentElement).appendChild(marker);setTimeout(function(){marker.remove()},40)}catch(e){}}
  function watchAmountLocal(){lastAmountSignature=amountSignature(readAmountLocal());setInterval(function(){var current=amountSignature(readAmountLocal());if(current!==lastAmountSignature){lastAmountSignature=current;nudgeDashboard()}},1000)}

  function stripLegacyMetaRows(data){
    if(!data||typeof data!=='object'||!Array.isArray(data.oneTimeEvents))return {data:data,changed:false};
    var before=data.oneTimeEvents.length;
    var clean=data.oneTimeEvents.filter(function(row){return !(row&&LEGACY_META_IDS[row.id])});
    if(clean.length===before)return {data:data,changed:false};
    var out=Object.assign({},data,{oneTimeEvents:clean});
    return {data:out,changed:true};
  }
  function installBillsDataGuard(){
    if(!window.fetch||window.fetch.__billsosNoHiddenMeta)return;
    var nativeFetch=window.fetch.bind(window);
    var guarded=function(input,init){
      var url=typeof input==='string'?input:(input&&input.url)||'';
      var method=String((init&&init.method)||'GET').toUpperCase();
      if(url.indexOf('/api/bills')>=0&&method==='POST'&&init&&typeof init.body==='string'){
        try{var parsed=JSON.parse(init.body),cleaned=stripLegacyMetaRows(parsed);if(cleaned.changed)init=Object.assign({},init,{body:JSON.stringify(cleaned.data)})}catch(e){}
      }
      return nativeFetch(input,init).then(function(res){
        if(url.indexOf('/api/bills')>=0&&method==='GET'){
          try{var json=res.json.bind(res);res.json=function(){return json().then(function(data){return stripLegacyMetaRows(data).data})}}catch(e){}
        }
        return res;
      });
    };
    guarded.__billsosNoHiddenMeta=true;
    window.fetch=guarded;
  }
  function purgeLegacyControlRows(){
    try{
      if(location.pathname.indexOf('/control')!==0||typeof state==='undefined'||!state||!Array.isArray(state.oneTimeEvents))return;
      var cleaned=stripLegacyMetaRows(state);
      if(!cleaned.changed)return;
      state.oneTimeEvents=cleaned.data.oneTimeEvents;
      if(typeof renderAll==='function')renderAll();
      if(!purgePosted){
        purgePosted=true;
        fetch('/api/bills?purgeHiddenMeta='+Date.now(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)}).catch(function(){});
      }
    }catch(e){}
  }

  function removeBalanceBridge(){document.querySelectorAll('.drawerBalanceBridge').forEach(function(node){node.remove()})}
  function moneyNumber(text){var n=Number(String(text||'').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function enhanceDashboard(){try{removeBalanceBridge();tagSweepRows();var now=new Date(),heading=document.querySelector('.monthHead h2'),monthText=heading?heading.textContent:'',isThisMonth=monthText.indexOf(now.getFullYear())>=0&&monthText.toLowerCase().indexOf(now.toLocaleString('en-US',{month:'long'}).toLowerCase())>=0;document.querySelectorAll('.ev').forEach(function(ev){var txt=(ev.textContent||'').toLowerCase();if(txt.indexOf('sweep')>=0){ev.classList.add('sweep');ev.classList.remove('out')}});document.querySelectorAll('.day').forEach(function(day){day.classList.remove('today','low','negative','has-more');var first=day.querySelector('.topline span:first-child b'),end=day.querySelector('.endline b'),events=day.querySelector('.events');if(first&&isThisMonth&&Number(first.textContent)===now.getDate())day.classList.add('today');if(end){var bal=moneyNumber(end.textContent);if(bal<0)day.classList.add('negative');else if(bal>=0&&bal<LOW_BALANCE_WARNING)day.classList.add('low')}if(events&&events.scrollHeight>events.clientHeight+8)day.classList.add('has-more')})}catch(e){}}

  function installResizeControlFix(){
    if(document.getElementById('billsosResizeControlFix'))return;
    var s=document.createElement('style');
    s.id='billsosResizeControlFix';
    s.textContent='@media(min-width:901px){html body .month-shell{display:grid!important;grid-template-columns:minmax(0,1fr) 12px var(--drawer-w,260px)!important;gap:14px!important;align-items:start!important}html body .resizeHandle{display:flex!important;align-self:stretch!important;justify-content:center!important;cursor:col-resize!important;user-select:none!important;touch-action:none!important;min-height:100%!important}html body .resizeHandle::before{content:""!important;width:2px!important;border-radius:999px!important;background:rgba(31,58,61,.18)!important}html body .resizeHandle:hover::before,html body .resizeHandle.dragging::before{background:rgba(31,58,61,.48)!important}html body .drawer{position:sticky!important;top:12px!important;grid-column:auto!important;margin-top:0!important}}@media(max-width:900px){html body .resizeHandle{display:none!important}}';
    document.head.appendChild(s);
  }
  function loadDrawerWidth(){var saved=Number(localStorage.getItem('billsos-drawer-width-v1')||260);return isFinite(saved)?Math.max(220,Math.min(560,saved)):260}
  function applyDrawerWidth(n){var v=Math.max(220,Math.min(560,Number(n)||260));document.documentElement.style.setProperty('--drawer-w',v+'px');try{localStorage.setItem('billsos-drawer-width-v1',String(v))}catch(e){}return v}
  function bindResizeHandle(){
    installResizeControlFix();
    if(window.innerWidth<=900)return;
    var handle=document.getElementById('resizeHandle');
    if(!handle)return;
    applyDrawerWidth(loadDrawerWidth());
    if(handle.dataset.billsosResizeBound==='1')return;
    handle.dataset.billsosResizeBound='1';
    var dragging=false,startX=0,startW=0;
    function move(ev){if(!dragging)return;var point=ev.touches&&ev.touches[0]?ev.touches[0]:ev;applyDrawerWidth(startW-(point.clientX-startX))}
    function up(){if(!dragging)return;dragging=false;handle.classList.remove('dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up)}
    function down(ev){if(window.innerWidth<=900)return;var point=ev.touches&&ev.touches[0]?ev.touches[0]:ev;dragging=true;startX=point.clientX;startW=loadDrawerWidth();handle.classList.add('dragging');if(ev.pointerId&&handle.setPointerCapture)try{handle.setPointerCapture(ev.pointerId)}catch(e){}window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);if(ev.cancelable)ev.preventDefault()}
    handle.addEventListener('pointerdown',down);
    handle.addEventListener('touchstart',down,{passive:false});
  }

  installBillsDataGuard();installSweepVisuals();installResizeControlFix();watchAmountLocal();
  document.addEventListener('change',function(e){var cb=e.target;if(!cb||cb.type!=='checkbox'||!cb.dataset||!cb.dataset.id)return;setTimeout(function(){pushCheckmarks(doneFromDom())},0)},true);
  document.addEventListener('DOMContentLoaded',function(){installBillsDataGuard();installSweepVisuals();installResizeControlFix();loadDesign();applyTheme();setTimeout(pullCheckmarks,200);setTimeout(pullCheckmarks,900);setTimeout(addThemeToggle,200);setTimeout(purgeLegacyControlRows,300);setTimeout(purgeLegacyControlRows,1200);setTimeout(tagSweepRows,300);setTimeout(bindResizeHandle,300);setTimeout(bindResizeHandle,1200);setInterval(enhanceDashboard,500);setInterval(removeBalanceBridge,500);setInterval(bindResizeHandle,1000);setInterval(pullCheckmarks,15000);setInterval(purgeLegacyControlRows,15000)});
})();
