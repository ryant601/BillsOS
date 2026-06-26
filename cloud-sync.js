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
        'body{padding-top:14px!important;padding-bottom:48px!important}',
        '.wrap{max-width:1120px!important}',
        '.build-stamp{margin-bottom:6px!important;padding:4px 9px!important;font-size:9.5px!important}',
        '.bills-sync-pill{display:flex;align-items:center;gap:7px;width:max-content;max-width:100%;margin:0 auto 8px;padding:5px 10px;border:1px solid rgba(20,35,55,.12);border-radius:999px;background:#fff;color:#41505f;font-size:10.5px;box-shadow:0 6px 18px -14px rgba(20,35,55,.28)}',
        '.bills-sync-pill i{width:7px;height:7px;border-radius:99px;background:#a8651a;display:inline-block}',
        '.bills-sync-pill.ok i{background:#0a7d44}.bills-sync-pill.warn i{background:#a8651a}.bills-sync-pill.err i{background:#b8362c}',
        '.toggle{margin-bottom:12px!important}',
        '.tabs{padding:3px!important;border-radius:12px!important}',
        '.tabs button{padding:6px 12px!important;font-size:12px!important;border-radius:9px!important}',
        '.spark{display:none!important}',
        '.v2-briefing{display:none!important}',
        '.ops-panel,.status-grid,.plan-card{display:none!important}',
        'header{display:grid!important;grid-template-columns:minmax(240px,1fr) auto!important;align-items:end!important;margin-bottom:10px!important;gap:12px!important}',
        '.eyebrow{margin-bottom:5px!important;font-size:9px!important;letter-spacing:.2em!important}',
        'h1{font-size:clamp(32px,4.6vw,56px)!important;line-height:.88!important}',
        '.tag{margin-top:6px!important;font-size:11.5px!important}',
        '.chips{gap:6px!important;max-width:560px!important;justify-content:flex-end!important}',
        '.chip{padding:7px 10px!important;border-radius:12px!important;min-width:86px!important}',
        '.chip .k{font-size:8.5px!important;margin-bottom:3px!important;letter-spacing:.1em!important}',
        '.chip .v,.chip.prog .v{font-size:15px!important}',
        '.chip.prog{min-width:105px!important}',
        '.pbar{margin-top:5px!important;height:4px!important}',
        '.savestatus{font-size:7.5px!important;margin-top:3px!important;min-height:8px!important}',
        '.global-briefing{display:block!important;margin:8px 0 10px!important;padding:11px 13px!important;border-radius:16px!important}',
        '.global-briefing .brief-head{margin-bottom:8px!important}',
        '.global-briefing h2{font-size:17px!important}',
        '.global-briefing .brief-sub{font-size:11.5px!important;margin-top:3px!important}',
        '.global-briefing .brief-grid{gap:8px!important}',
        '.global-briefing .brief-box{padding:9px!important;border-radius:12px!important}',
        '.global-briefing .brief-box h3{margin-bottom:6px!important;font-size:12.5px!important}',
        '.global-briefing .brief-item{padding:5px 0!important;font-size:11.5px!important}',
        '.global-briefing .brief-kpis{gap:6px!important;margin-bottom:6px!important}',
        '.global-briefing .brief-kpi{padding:7px!important;border-radius:11px!important}',
        '.global-briefing .brief-kpi span{font-size:9px!important}',
        '.global-briefing .brief-kpi b{font-size:13px!important}',
        '.status-hero{margin-bottom:10px!important;padding:12px 14px!important;border-radius:16px!important}',
        '.status-hero-top{gap:8px!important;margin-bottom:8px!important;align-items:center!important}',
        '.status-pill{font-size:11px!important;padding:5px 9px!important}',
        '.status-title{font-size:20px!important;margin-top:5px!important;margin-bottom:4px!important}',
        '.status-sub{font-size:11.5px!important}',
        '.conf-card{padding:9px!important;border-radius:13px!important;min-width:220px!important}',
        '.conf-card .v{font-size:22px!important}',
        '.conf-note{font-size:10.5px!important;margin-top:4px!important}',
        '.status-metrics{gap:7px!important}',
        '.status-metric{padding:8px 9px!important;border-radius:12px!important;min-height:70px!important}',
        '.status-metric .k{font-size:8.5px!important;margin-bottom:5px!important}',
        '.status-metric .v{font-size:15px!important}',
        '.status-metric .n{font-size:10.5px!important;margin-top:4px!important}',
        '.next-timeline{margin-top:8px!important;padding-top:8px!important}',
        '.timeline-title{font-size:13px!important;margin-bottom:6px!important}',
        '.timeline-list{gap:7px!important}',
        '.timeline-node{padding:8px 9px!important;border-radius:12px!important}',
        '.timeline-node .when{font-size:10px!important}',
        '.timeline-node .what{font-size:11.5px!important}',
        '.dow-row{margin-top:10px!important;margin-bottom:6px!important}',
        '.grid{gap:8px!important}',
        '.day{padding:9px!important;border-radius:14px!important;min-height:0!important}',
        '.dtop{margin-bottom:6px!important}',
        '.bod,.eod{padding:5px 0!important}',
        '.events{gap:4px!important}',
        '.ev{padding:5px 6px!important;border-radius:9px!important;font-size:11px!important}',
        '.legend{margin-top:10px!important}',
        '@media(max-width:900px){header{grid-template-columns:1fr!important}.chips{justify-content:flex-start!important;max-width:100%!important}.status-hero-top{display:block!important}.conf-card{margin-top:8px!important}.status-metrics{grid-template-columns:1fr 1fr!important}}',
        '@media(max-width:760px){body{padding:10px 9px 42px!important}.global-briefing,.status-hero{padding:10px!important}.status-metrics{grid-template-columns:1fr!important}.chip{min-width:82px!important}.grid{gap:7px!important}}'
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
