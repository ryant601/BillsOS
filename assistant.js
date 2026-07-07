(function(){
  'use strict';
  var BUILD='billsos-state-sync-20260707-1';
  var VERSION='20260707balancechain1';
  var LOCAL_COMPLETED='billsos-completed-events-v1';
  var cloudCompleted=null;
  var isApplying=false;
  var balanceChainTimer=null;
  var balanceChainRunning=false;
  var balanceChainReady=false;
  var MONTHS=['june','july','aug','sep','oct','nov','dec'];
  var MONTH_NUMS={june:5,july:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  var OVERLAYS=[{name:'Travelers Insurance',startMonth:'july',day:1,amountByMonth:{july:521},defaultAmount:261,flag:'auto'}];

  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.bootstrap={loaded:true,build:BUILD,at:new Date().toISOString(),modules:[]};

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function readLocalCompleted(){try{return JSON.parse(localStorage.getItem(LOCAL_COMPLETED)||'{}')||{};}catch(e){return {};}}
  function writeLocalCompleted(completed){try{localStorage.setItem(LOCAL_COMPLETED,JSON.stringify(completed||{}));}catch(e){}}
  function eventIdFromElement(ev){
    var day=ev.closest('.day');
    var panel=ev.closest('.month-panel');
    var month=panel&&panel.id?panel.id.replace('panel-',''):'month';
    var d=day?day.getAttribute('data-day'):'x';
    var nm=cleanText((ev.querySelector('.nm')||{}).textContent||'');
    var amt=cleanText((ev.querySelector('.amt')||{}).textContent||'');
    return month+'|'+d+'|'+nm+'|'+amt;
  }
  function collectCompletedFromDom(){
    var completed={};
    document.querySelectorAll('.month-panel .ev').forEach(function(ev){
      if(ev.classList.contains('in')||ev.classList.contains('note'))return;
      var box=ev.querySelector('input[type="checkbox"]');
      if(box&&box.checked)completed[eventIdFromElement(ev)]=1;
    });
    return completed;
  }
  function updatePanelProgress(panel){
    var billEvents=[].slice.call(panel.querySelectorAll('.ev')).filter(function(ev){return !ev.classList.contains('in')&&!ev.classList.contains('note');});
    var total=billEvents.length;
    var paid=billEvents.filter(function(ev){return ev.classList.contains('done');}).length;
    var pc=panel.querySelector('.paidCount');
    var pt=panel.querySelector('.paidTotal');
    var bar=panel.querySelector('.paidBar');
    var st=panel.querySelector('.saveStatus,.savestatus');
    if(pc)pc.textContent=paid;
    if(pt)pt.textContent=total;
    if(bar)bar.style.width=total?Math.round((paid/total)*100)+'%':'0%';
    if(st){st.textContent='Synced';st.className=(st.className||'')+' ok';}
  }
  function applyCompleted(completed){
    if(!completed)return;
    isApplying=true;
    document.querySelectorAll('.month-panel .ev').forEach(function(ev){
      if(ev.classList.contains('in')||ev.classList.contains('note'))return;
      var box=ev.querySelector('input[type="checkbox"]');
      if(!box)return;
      var checked=!!completed[eventIdFromElement(ev)];
      box.checked=checked;
      ev.classList.toggle('done',checked);
    });
    document.querySelectorAll('.month-panel').forEach(updatePanelProgress);
    isApplying=false;
  }
  async function saveCloud(completed){
    writeLocalCompleted(completed);
    cloudCompleted=completed;
    try{
      await fetch('/api/checkmarks',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:completed})});
    }catch(e){
      window.BillsOSModules.checkmarkSync={loaded:false,build:BUILD,error:String(e&&e.message||e),at:new Date().toISOString()};
    }
  }
  async function loadCloud(){
    var local=readLocalCompleted();
    try{
      var response=await fetch('/api/checkmarks',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      var data=await response.json();
      var remote=(data&&data.completed&&typeof data.completed==='object')?data.completed:{};
      var remoteEmpty=!Object.keys(remote).length;
      var localKeys=Object.keys(local);
      cloudCompleted=remoteEmpty&&localKeys.length?local:remote;
      writeLocalCompleted(cloudCompleted);
      if(remoteEmpty&&localKeys.length)saveCloud(cloudCompleted);
      applyCompleted(cloudCompleted);
      window.BillsOSModules.checkmarkSync={loaded:true,build:BUILD,updatedAt:data&&data.updatedAt||null,at:new Date().toISOString()};
    }catch(e){
      cloudCompleted=local;
      applyCompleted(cloudCompleted);
      window.BillsOSModules.checkmarkSync={loaded:false,build:BUILD,error:String(e&&e.message||e),fallback:'localStorage',at:new Date().toISOString()};
    }
  }
  function scheduleApply(){
    if(cloudCompleted)applyCompleted(cloudCompleted);
    scheduleBalanceChain();
  }
  function bindCheckboxSync(){
    document.addEventListener('change',function(event){
      var target=event.target;
      if(isApplying||!target||!target.matches||!target.matches('.month-panel .ev input[type="checkbox"]'))return;
      setTimeout(function(){saveCloud(collectCompletedFromDom());},0);
    },true);
  }
  function addFallbackStyle(){
    if(document.getElementById('billsos-bootstrap-fallback-style'))return;
    var style=document.createElement('style');
    style.id='billsos-bootstrap-fallback-style';
    style.textContent='.toggle{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important}.toggle .tabs{display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;gap:8px!important}.toggle .tabs button{flex:0 0 auto!important;white-space:nowrap!important}';
    document.head.appendChild(style);
  }
  function loadModule(src,name){
    try{
      var script=document.createElement('script');
      script.src=src+'?v='+VERSION;
      script.async=false;
      script.onload=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:true,at:new Date().toISOString()});};
      script.onerror=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:'load failed',at:new Date().toISOString()});};
      document.head.appendChild(script);
    }catch(e){
      window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:String(e&&e.message||e),at:new Date().toISOString()});
    }
  }

  function parseMoney(value){
    var text=String(value||'').replace(/[−–—]/g,'-');
    var number=Number(text.replace(/[^0-9.\-]/g,''));
    return isNaN(number)?null:number;
  }
  function money2(value){
    if(value==null||isNaN(value))return '—';
    return '$'+Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function money0(value){
    if(value==null||isNaN(value))return '—';
    return '$'+Number(value).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});
  }
  function eventDelta(ev){
    if(!ev||ev.classList.contains('note'))return 0;
    var raw=cleanText((ev.querySelector('.amt')||{}).textContent||'');
    var amount=parseMoney(raw);
    if(amount==null)return 0;
    amount=Math.abs(amount);
    return ev.classList.contains('in')?amount:-amount;
  }
  function updateChip(panel,label,value){
    var labels=[].slice.call(panel.querySelectorAll('.chip .k'));
    var key=labels.find(function(el){return cleanText(el.textContent).toLowerCase()===label.toLowerCase();});
    if(!key)return;
    var valueNode=key.closest('.chip').querySelector('.v');
    if(valueNode)valueNode.textContent=value;
  }
  function overlayAmount(item,month){return item.amountByMonth&&item.amountByMonth[month]!=null?item.amountByMonth[month]:item.defaultAmount;}
  function ensureOverlay(doc,month){
    OVERLAYS.forEach(function(item){
      if((MONTH_NUMS[month]+1)<(MONTH_NUMS[item.startMonth]+1))return;
      var day=doc.querySelector('.day[data-day="'+item.day+'"]');
      if(!day)return;
      var events=day.querySelector('.events');
      if(!events)return;
      var exists=[].slice.call(events.querySelectorAll('.nm')).some(function(el){return cleanText(el.textContent)===item.name;});
      if(exists)return;
      var ev=doc.createElement('div');
      ev.className='ev out billsos-overlay';
      ev.innerHTML='<span class="dot"></span><span class="nm">'+item.name+'</span><span class="flag '+item.flag+'">'+(item.flag==='auto'?'A':'M')+'</span><span class="amt">−'+Number(overlayAmount(item,month)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</span>';
      events.appendChild(ev);
    });
  }
  async function fetchMonthDoc(month){
    var response=await fetch('/months/'+month+'.html?v='+VERSION,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error(month+' returned HTTP '+response.status);
    var html=await response.text();
    var doc=new DOMParser().parseFromString(html,'text/html');
    ensureOverlay(doc,month);
    return doc;
  }
  function rebuildSpark(panel,balances){
    var svg=panel.querySelector('.sparksvg');
    if(!svg||!balances.length)return;
    var vals=balances.map(function(x){return x.balance;}).concat([1000]);
    var min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);
    if(max===min){max+=1;min-=1;}
    var padX=26,w=948,padY=26,h=174;
    function x(i){return padX+(balances.length<=1?0:(i/(balances.length-1))*w);}
    function y(v){return padY+((max-v)/(max-min))*h;}
    var pts=balances.map(function(b,i){return x(i).toFixed(1)+','+y(b.balance).toFixed(1);}).join(' ');
    var area='M '+x(0).toFixed(1)+',200.0 L '+pts.replace(/ /g,' L ')+' L '+x(balances.length-1).toFixed(1)+',200.0 Z';
    var low=balances.reduce(function(a,b){return b.balance<a.balance?b:a;},balances[0]);
    var high=balances.reduce(function(a,b){return b.balance>a.balance?b:a;},balances[0]);
    svg.innerHTML='<defs><linearGradient id="ag-chain-'+panel.id+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0f9d58" stop-opacity="0.22"></stop><stop offset="100%" stop-color="#0f9d58" stop-opacity="0"></stop></linearGradient><linearGradient id="lg-chain-'+panel.id+'" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="#0c7d46"></stop><stop offset="55%" stop-color="#0f9d58"></stop><stop offset="100%" stop-color="#28b56e"></stop></linearGradient></defs><line class="warnline" x1="0" x2="1000" y1="'+y(1000).toFixed(1)+'" y2="'+y(1000).toFixed(1)+'"></line><text class="warnlbl" x="6" y="'+(y(1000)-6).toFixed(1)+'">$1,000 floor</text><path d="'+area+'" fill="url(#ag-chain-'+panel.id+')"></path><polyline class="balpath" fill="none" points="'+pts+'" stroke="url(#lg-chain-'+panel.id+')"></polyline><circle cx="'+x(high.day-1).toFixed(1)+'" cy="'+y(high.balance).toFixed(1)+'" fill="#0f9d58" r="4.5"></circle><text class="mk" fill="#0f9d58" text-anchor="middle" x="'+x(high.day-1).toFixed(1)+'" y="'+(y(high.balance)-12).toFixed(1)+'">peak '+money0(high.balance)+'</text><circle cx="'+x(low.day-1).toFixed(1)+'" cy="'+y(low.balance).toFixed(1)+'" fill="#a8651a" r="4.5"></circle><text class="mk" fill="#a8651a" text-anchor="middle" x="'+x(low.day-1).toFixed(1)+'" y="'+(y(low.balance)+20).toFixed(1)+'">low '+money0(low.balance)+'</text>';
  }
  function applyMonthBalances(month,doc,opening){
    var panel=document.getElementById('panel-'+month);
    if(!panel)return opening;
    var sourceDays=[].slice.call(doc.querySelectorAll('.day[data-day]')).sort(function(a,b){return Number(a.getAttribute('data-day'))-Number(b.getAttribute('data-day'));});
    if(!sourceDays.length)return opening;
    var running=opening;
    if(running==null){
      var first=sourceDays[0].querySelector('.bod b');
      running=parseMoney(first&&first.textContent);
    }
    if(running==null)return opening;
    var monthOpening=running, income=0, outflow=0, sweep=0, balances=[];
    sourceDays.forEach(function(sourceDay){
      var dayNumber=Number(sourceDay.getAttribute('data-day'));
      var rendered=panel.querySelector('.day[data-day="'+dayNumber+'"]');
      if(rendered){
        var bod=rendered.querySelector('.bod b');
        if(bod)bod.textContent=money2(running);
      }
      var dayDelta=0;
      sourceDay.querySelectorAll('.ev').forEach(function(ev){
        var delta=eventDelta(ev);
        if(delta>0)income+=delta;
        if(delta<0)outflow+=Math.abs(delta);
        if(delta<0&&ev.classList.contains('xfer')&&cleanText((ev.querySelector('.nm')||{}).textContent||'').toLowerCase().indexOf('sweep')>-1)sweep+=Math.abs(delta);
        dayDelta+=delta;
      });
      running+=dayDelta;
      if(rendered){
        var eod=rendered.querySelector('.eod b');
        if(eod)eod.textContent=money2(running);
        rendered.classList.toggle('is-warn',running<1250);
      }
      balances.push({day:dayNumber,balance:running});
    });
    updateChip(panel,'Starting',money2(monthOpening));
    updateChip(panel,'Opening',money2(monthOpening));
    updateChip(panel,'Income',money2(income));
    updateChip(panel,'Money in',money2(income));
    updateChip(panel,'Outflow',money2(outflow));
    updateChip(panel,'Money out',money2(outflow));
    if(sweep>0)updateChip(panel,'Sweep',money2(sweep));
    rebuildSpark(panel,balances);
    panel.dataset.balanceChained='1';
    return running;
  }
  async function applyBalanceChain(){
    if(balanceChainRunning)return;
    if(!document.getElementById('panel-july')||!document.getElementById('panel-aug'))return;
    balanceChainRunning=true;
    try{
      var ending=null;
      for(var i=0;i<MONTHS.length;i++){
        var month=MONTHS[i];
        var doc=await fetchMonthDoc(month);
        ending=applyMonthBalances(month,doc,ending);
      }
      balanceChainReady=true;
      window.BillsOSModules.balanceChain={loaded:true,build:BUILD,at:new Date().toISOString()};
    }catch(e){
      window.BillsOSModules.balanceChain={loaded:false,build:BUILD,error:String(e&&e.message||e),at:new Date().toISOString()};
    }finally{
      balanceChainRunning=false;
    }
  }
  function scheduleBalanceChain(){
    clearTimeout(balanceChainTimer);
    balanceChainTimer=setTimeout(applyBalanceChain,balanceChainReady?500:50);
  }

  function init(){
    addFallbackStyle();
    bindCheckboxSync();
    loadCloud();
    scheduleBalanceChain();
    var target=document.getElementById('month-panels')||document.body;
    new MutationObserver(function(){scheduleApply();}).observe(target,{childList:true,subtree:true});
    setInterval(function(){loadCloud();},30000);
    loadModule('/mobile-ui.js','mobile-ui');
    loadModule('/dashboard-sync.js','dashboard-sync');
    loadModule('/assistant-ui.js','assistant-ui');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();