(function(){
  var STORE='billsos-completed-events-v1';
  var API='/api/checkmarks';
  var syncing=false;
  var saveTimer=null;

  function installUiPolish(){
    if(!document.getElementById('billsos-ui-polish')){
      var style=document.createElement('style');
      style.id='billsos-ui-polish';
      style.textContent=[
        'body{padding-top:18px!important;padding-bottom:56px!important}',
        '.wrap{max-width:1180px!important}',
        '.build-stamp{margin-bottom:8px!important;padding:5px 10px!important;font-size:10px!important}',
        '.bills-sync-pill{display:flex;align-items:center;gap:7px;width:max-content;max-width:100%;margin:0 auto 10px;padding:6px 11px;border:1px solid rgba(20,35,55,.12);border-radius:999px;background:#fff;color:#41505f;font-size:11px;box-shadow:0 6px 18px -14px rgba(20,35,55,.28)}',
        '.bills-sync-pill i{width:7px;height:7px;border-radius:99px;background:#a8651a;display:inline-block}',
        '.bills-sync-pill.ok i{background:#0a7d44}.bills-sync-pill.warn i{background:#a8651a}.bills-sync-pill.err i{background:#b8362c}',
        '.toggle{margin-bottom:16px!important}',
        '.tabs button{padding:7px 13px!important;font-size:12px!important}',
        'header{margin-bottom:14px!important;gap:16px!important}',
        '.eyebrow{margin-bottom:6px!important;font-size:9.5px!important}',
        'h1{font-size:clamp(34px,5.4vw,64px)!important}',
        '.tag{margin-top:8px!important;font-size:12px!important}',
        '.chips{gap:7px!important;max-width:640px!important}',
        '.chip{padding:8px 11px!important;border-radius:13px!important;min-width:94px!important}',
        '.chip .k{font-size:9px!important;margin-bottom:4px!important}',
        '.chip .v,.chip.prog .v{font-size:16px!important}',
        '.pbar{margin-top:6px!important;height:4px!important}',
        '.savestatus{font-size:8px!important;margin-top:4px!important;min-height:9px!important}',
        '.global-briefing,.status-hero,.spark{margin-bottom:14px!important;padding:14px 16px!important;border-radius:18px!important}',
        '.global-briefing{margin-top:10px!important}',
        '.global-briefing .brief-head{margin-bottom:10px!important}',
        '.global-briefing h2{font-size:18px!important}',
        '.global-briefing .brief-grid{gap:10px!important}',
        '.global-briefing .brief-box{padding:10px!important;border-radius:13px!important}',
        '.global-briefing .brief-item{padding:6px 0!important;font-size:12px!important}',
        '.global-briefing .brief-kpis{gap:7px!important;margin-bottom:8px!important}',
        '.global-briefing .brief-kpi{padding:8px!important;border-radius:12px!important}',
        '.global-briefing .brief-kpi b{font-size:14px!important}',
        '.status-hero-top{gap:10px!important;margin-bottom:10px!important}',
        '.status-title{font-size:22px!important;margin-top:6px!important}',
        '.status-sub{font-size:12px!important}',
        '.conf-card{padding:10px!important;border-radius:14px!important}',
        '.status-metrics{gap:8px!important}',
        '.status-metric{padding:9px 10px!important;border-radius:13px!important}',
        '.status-metric .v{font-size:16px!important}',
        '.next-timeline{margin-top:10px!important;padding-top:10px!important}',
        '.timeline-list{gap:8px!important}',
        '.timeline-node{padding:9px 10px!important;border-radius:13px!important}',
        '.spark{padding-bottom:4px!important}',
        '.spark-head p{font-size:11px!important;margin:3px 0 2px!important}',
        '.sparksvg{max-height:165px!important}',
        '.grid{gap:9px!important}',
        '.day{padding:10px!important;border-radius:16px!important}',
        '.events{gap:5px!important}',
        '.ev{padding:6px 7px!important}',
        '@media(max-width:760px){body{padding:12px 10px 48px!important}.global-briefing,.status-hero,.spark{padding:12px!important}.status-metrics{grid-template-columns:1fr 1fr!important}.sparksvg{max-height:145px!important}}'
      ].join('\n');
      document.head.appendChild(style);
    }
    if(!document.getElementById('billsSyncPill')){
      var pill=document.createElement('div');
      pill.id='billsSyncPill';
      pill.className='bills-sync-pill warn';
      pill.innerHTML='<i></i><span>Cloud sync loading…</span>';
      var stamp=document.querySelector('.build-stamp');
      if(stamp&&stamp.parentNode)stamp.parentNode.insertBefore(pill,stamp.nextSibling);
      else document.body.insertBefore(pill,document.body.firstChild);
    }
  }
  function readLocal(){
    try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){return {};}
  }
  function writeLocal(obj){
    try{localStorage.setItem(STORE,JSON.stringify(obj||{}));}catch(e){}
  }
  function cleanText(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function eventId(ev){
    var day=ev.closest('.day');
    var panel=ev.closest('.month-panel');
    var month=panel?panel.id.replace('panel-',''):'month';
    var d=day?day.getAttribute('data-day'):'x';
    var nm=cleanText((ev.querySelector('.nm')||{}).textContent||'');
    var amt=cleanText((ev.querySelector('.amt')||{}).textContent||'');
    return month+'|'+d+'|'+nm+'|'+amt;
  }
  function setSyncStatus(text,kind){
    var pill=document.getElementById('billsSyncPill');
    if(pill){
      pill.className='bills-sync-pill '+(kind||'warn');
      var span=pill.querySelector('span');
      if(span)span.textContent=text;
    }
    document.querySelectorAll('.saveStatus,.savestatus').forEach(function(el){
      el.textContent=text;
      if(kind==='ok')el.className='saveStatus savestatus ok';
      if(kind==='warn')el.className='saveStatus savestatus warn';
      if(kind==='err')el.className='saveStatus savestatus err';
    });
  }
  function currentFromDom(){
    var out=readLocal();
    document.querySelectorAll('.month-panel .ev input[type="checkbox"]').forEach(function(box){
      var ev=box.closest('.ev');
      if(!ev)return;
      var id=eventId(ev);
      if(box.checked)out[id]=1; else delete out[id];
    });
    return out;
  }
  function applyToDom(completed){
    document.querySelectorAll('.month-panel .ev input[type="checkbox"]').forEach(function(box){
      var ev=box.closest('.ev');
      if(!ev)return;
      var checked=!!completed[eventId(ev)];
      if(box.checked!==checked){
        box.checked=checked;
        ev.classList.toggle('done',checked);
        box.dispatchEvent(new Event('change',{bubbles:true}));
      }else{
        ev.classList.toggle('done',checked);
      }
    });
  }
  async function pushCloud(){
    if(syncing)return;
    syncing=true;
    try{
      var completed=currentFromDom();
      writeLocal(completed);
      setSyncStatus('Cloud syncing…','warn');
      var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({completed:completed})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json();
      if(data&&data.completed)writeLocal(data.completed);
      setSyncStatus('Cloud synced','ok');
    }catch(e){
      setSyncStatus('Saved locally · cloud offline','warn');
    }finally{
      syncing=false;
    }
  }
  function queuePush(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(pushCloud,350);
  }
  async function pullCloud(){
    try{
      setSyncStatus('Cloud sync loading…','warn');
      var r=await fetch(API,{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json();
      var cloud=(data&&data.completed)||{};
      var local=readLocal();
      var merged=Object.assign({},cloud,local);
      writeLocal(merged);
      applyToDom(merged);
      setSyncStatus('Cloud synced','ok');
      await pushCloud();
    }catch(e){
      setSyncStatus('Saved locally · cloud offline','warn');
    }
  }
  function waitForCalendar(){
    installUiPolish();
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(document.querySelector('.month-panel .ev input[type="checkbox"]')){
        clearInterval(t);
        pullCloud();
      }
      if(tries>80)clearInterval(t);
    },250);
  }
  document.addEventListener('change',function(e){
    if(e.target&&e.target.matches&&e.target.matches('.month-panel .ev input[type="checkbox"]'))queuePush();
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForCalendar);else waitForCalendar();
})();
