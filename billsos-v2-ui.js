(function(){
  'use strict';
  var COLLAPSE_KEY='billsos-collapsed-weeks-v2';

  function readJson(key){try{var value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'?value:{}}catch(e){return {}}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value||{}))}catch(e){}}
  function text(node){return String(node&&node.textContent||'').replace(/\s+/g,' ').trim()}
  function currentPanel(){return document.querySelector('.month-panel.show')||document.querySelector('.month-panel')}
  function weekKey(panel,index){return (panel&&panel.id||'month')+'|'+index}

  function installFont(){
    if(document.getElementById('billsosJakartaFont'))return;
    var link=document.createElement('link');
    link.id='billsosJakartaFont';link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function installStyles(){
    if(document.getElementById('billsosV2Styles'))return;
    var style=document.createElement('style');style.id='billsosV2Styles';
    style.textContent=[
      ':root{--bg:#eef1f4!important;--card:#fff!important;--ink:#121a1e!important;--mut:#5c6a72!important;--line:rgba(26,111,118,.16)!important;--primary:#1a6f76!important;--green:#1f7a56!important;--red:#b54b42!important;--out:#b54b42!important;--gold:#9a7230!important;--sage-950:#0f2b2e;--sage-800:#1a6f76;--sage-700:#2d8d8f;--sage-200:#cde8e9;--sage-100:#e4f3f3;--sage-50:#f4fbfb}',
      'html{background:var(--bg)}body.billsos-v2{margin:0!important;padding:0!important;background:linear-gradient(180deg,#eef1f4 0%,#e4eaef 100%)!important;color:var(--ink)!important;font-family:"Plus Jakarta Sans",Inter,"Segoe UI",sans-serif!important}',
      '.billsos-app-shell{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:100vh}.billsos-main{min-width:0;padding:22px 24px 42px}.billsos-main>.wrap{width:100%;max-width:1480px!important;margin:0 auto!important}',
      '.billsos-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:22px 16px 16px;background:rgba(248,251,252,.97);border-right:1px solid rgba(26,111,118,.14);backdrop-filter:blur(20px);z-index:60}.billsos-brand{display:flex;align-items:center;gap:11px;padding:4px 8px 22px}.billsos-brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:var(--sage-800);color:#fff;font-size:18px;font-weight:900;box-shadow:0 9px 24px rgba(26,111,118,.22)}.billsos-brand strong{display:block;font-size:19px;letter-spacing:-.04em}.billsos-brand small{display:block;margin-top:2px;color:var(--mut);font-size:10px;font-weight:700}',
      '.billsos-side-nav{display:grid;gap:5px}.billsos-side-nav a,.billsos-side-nav button{width:100%;display:flex;align-items:center;gap:11px;border:0;border-radius:12px;padding:11px 12px;background:transparent;color:#425057;text-decoration:none;font:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer}.billsos-side-nav a:hover,.billsos-side-nav button:hover{background:var(--sage-100);color:var(--sage-950)}.billsos-side-nav .is-active{background:var(--sage-200);color:var(--sage-950);box-shadow:inset 0 0 0 1px rgba(26,111,118,.08)}.billsos-nav-icon{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:rgba(26,111,118,.09);font-size:14px;font-weight:900}.billsos-nav-divider{height:1px;margin:12px 8px;background:rgba(26,111,118,.12)}',
      '.billsos-sidebar-footer{margin-top:auto;display:grid;gap:8px;padding:14px 8px 2px;border-top:1px solid rgba(26,111,118,.12)}.billsos-sidebar-footer #billsosSyncStatus{justify-content:flex-start!important;padding:0!important;min-height:auto!important;color:var(--sage-700)!important}.billsos-sidebar-footer #billsosCanonicalSync{width:100%!important;margin:0!important;border:1px solid var(--line)!important;background:#fff!important;color:var(--sage-950)!important;box-shadow:none!important}',
      'body.billsos-v2 .pill{display:none!important}body.billsos-v2 .hero,body.billsos-v2 .top{margin:0 0 14px!important;padding:20px 22px!important;border:1px solid rgba(26,111,118,.10)!important;border-radius:18px!important;background:rgba(255,255,255,.92)!important;box-shadow:0 14px 38px rgba(18,40,48,.08)!important}body.billsos-v2 .hero .nav,body.billsos-v2 .top>.nav{display:none!important}body.billsos-v2 h1{color:var(--ink)!important;letter-spacing:-.045em!important}body.billsos-v2 .eyebrow,body.billsos-v2 .sub,body.billsos-v2 .mut,body.billsos-v2 label{color:var(--mut)!important}',
      'body.billsos-v2 .tabs{gap:7px!important;margin:0 0 14px!important;padding:7px!important;border:1px solid rgba(26,111,118,.10)!important;border-radius:16px!important;background:rgba(255,255,255,.78)!important;box-shadow:0 7px 24px rgba(18,40,48,.05)!important}body.billsos-v2 .tab,body.billsos-v2 .tabs button{border-color:transparent!important;background:transparent!important;color:var(--mut)!important}body.billsos-v2 .tab.active,body.billsos-v2 .tabs button.active{background:var(--sage-800)!important;color:#fff!important;box-shadow:0 7px 18px rgba(26,111,118,.18)!important}',
      'body.billsos-v2 .card,body.billsos-v2 .month-panel,body.billsos-v2 .banner{border:1px solid rgba(26,111,118,.12)!important;background:rgba(255,255,255,.94)!important;box-shadow:0 14px 38px -28px rgba(18,40,48,.45)!important}body.billsos-v2 .card{border-radius:16px!important}body.billsos-v2 .month-panel{border-radius:18px!important}body.billsos-v2 .banner{background:#f6efd8!important;color:#7a5a1c!important;border-color:rgba(154,114,48,.20)!important}',
      'body.billsos-v2 input,body.billsos-v2 select,body.billsos-v2 textarea{border:1px solid rgba(26,111,118,.18)!important;background:#fff!important;color:var(--ink)!important;box-shadow:none}body.billsos-v2 input:focus,body.billsos-v2 select:focus,body.billsos-v2 textarea:focus{outline:2px solid rgba(26,111,118,.22)!important;border-color:var(--sage-700)!important}',
      'body.billsos-v2 .btn,body.billsos-v2 .linkbtn{border-color:rgba(26,111,118,.18)!important;background:#fff!important;color:var(--ink)!important}body.billsos-v2 .btn:hover,body.billsos-v2 .linkbtn:hover{background:var(--sage-100)!important}body.billsos-v2 .btn.primary{background:var(--sage-800)!important;border-color:var(--sage-800)!important;color:#fff!important}body.billsos-v2 .btn.danger{color:var(--red)!important}',
      'body.billsos-v2 .tablewrap{border-color:rgba(26,111,118,.14)!important;background:#fff!important}body.billsos-v2 th{background:var(--sage-50)!important;color:var(--mut)!important}body.billsos-v2 th,body.billsos-v2 td{border-bottom-color:rgba(26,111,118,.10)!important}body.billsos-v2 .code{background:var(--sage-50)!important;border-color:rgba(26,111,118,.14)!important}',
      'body.billsos-v2 .pill.on,body.billsos-v2 .pill.inflow{display:inline-flex!important;background:#e5f4ec!important;color:#1f7a56!important}body.billsos-v2 .pill.off,body.billsos-v2 .pill.outflow{display:inline-flex!important;background:#f8e9e7!important;color:#b54b42!important}body.billsos-v2 .pill.auto{display:inline-flex!important;background:#e4f3f3!important;color:#1a6f76!important}body.billsos-v2 .pill.manual,body.billsos-v2 .pill.transfer{display:inline-flex!important;background:#f6efd8!important;color:#7a5a1c!important}',
      'body.billsos-v2 .grid.billsos-week-grid{display:block!important;margin-top:5px!important}.billsos-week{margin:0 0 10px;border:1px solid rgba(26,111,118,.10);border-radius:16px;background:rgba(244,251,251,.68);overflow:hidden}.billsos-week-toggle{width:100%;display:flex;align-items:center;gap:12px;border:0;padding:10px 12px;background:rgba(228,243,243,.72);color:var(--ink);font:inherit;cursor:pointer;text-align:left}.billsos-week-title{font-size:12px;font-weight:850;white-space:nowrap}.billsos-week-summary{min-width:0;flex:1;color:var(--mut);font-size:10px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.billsos-week-chevron{font-size:15px;color:var(--sage-700);transition:transform .18s ease}.billsos-week.is-collapsed .billsos-week-chevron{transform:rotate(-90deg)}.billsos-week-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;padding:8px}.billsos-week.is-collapsed .billsos-week-days{display:none}',
      'body.billsos-v2 .day{height:178px!important;min-height:178px!important;border-color:#d4dde3!important;border-radius:14px!important;background:#fff!important}body.billsos-v2 .ev.in{background:#e5f4ec!important;color:#1f7a56!important}body.billsos-v2 .ev.out{background:#f8e9e7!important;color:#b54b42!important}body.billsos-v2 .ev.funding{background:#e8f3fa!important;color:#225d7a!important;border-color:rgba(46,120,162,.26)!important}body.billsos-v2 .ev.xfer{background:#f6efd8!important;color:#7a5a1c!important}',
      '#billsosSidebarToggle{display:none;position:fixed;left:12px;top:12px;z-index:90;width:42px;height:42px;border:1px solid rgba(26,111,118,.16);border-radius:13px;background:#fff;color:var(--sage-950);font-size:20px;box-shadow:0 10px 28px rgba(18,40,48,.18)}.billsos-sidebar-scrim{display:none}',
      '@media(max-width:1050px) and (min-width:761px){.billsos-app-shell{grid-template-columns:200px minmax(0,1fr)}.billsos-sidebar{padding-left:11px;padding-right:11px}.billsos-main{padding-left:16px;padding-right:16px}.billsos-brand small{display:none}}',
      '@media(max-width:760px){.billsos-app-shell{display:block}.billsos-main{padding:66px 9px 28px}.billsos-sidebar{position:fixed;left:0;top:0;width:min(82vw,290px);height:100dvh;transform:translateX(-105%);transition:transform .22s ease;box-shadow:22px 0 60px rgba(31,59,48,.18)}body.billsos-sidebar-open .billsos-sidebar{transform:translateX(0)}#billsosSidebarToggle{display:grid;place-items:center}body.billsos-sidebar-open .billsos-sidebar-scrim{display:block;position:fixed;inset:0;z-index:55;background:rgba(31,43,38,.28);backdrop-filter:blur(2px)}.billsos-week-days{display:block;padding:6px}.billsos-week-days .day{margin:7px 0!important}.billsos-week-days .day.is-blank,.billsos-week-days .day.blank{display:none!important}body.billsos-v2 .tabs{overflow-x:auto;flex-wrap:nowrap!important;scrollbar-width:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function navLink(icon,label,href,active){return '<a'+(active?' class="is-active"':'')+' href="'+href+'" data-billsos-nav="1"><span class="billsos-nav-icon">'+icon+'</span><span>'+label+'</span></a>'}
  function navButton(icon,label,action){return '<button type="button" data-billsos-action="'+action+'"><span class="billsos-nav-icon">'+icon+'</span><span class="billsos-nav-label">'+label+'</span></button>'}

  function setWeekCollapsed(week,collapsed,persist){
    if(!week)return;
    week.classList.toggle('is-collapsed',!!collapsed);
    var toggle=week.querySelector('.billsos-week-toggle');if(toggle)toggle.setAttribute('aria-expanded',collapsed?'false':'true');
    if(persist!==false){var map=readJson(COLLAPSE_KEY);map[week.dataset.weekKey]=!!collapsed;writeJson(COLLAPSE_KEY,map)}
    updateWeekButton();
  }

  function updateWeekButton(){
    var button=document.querySelector('[data-billsos-action="week-toggle"]');if(!button)return;
    var panel=currentPanel(),weeks=panel?Array.prototype.slice.call(panel.querySelectorAll('.billsos-week')):[];
    button.hidden=!weeks.length;if(!weeks.length)return;
    var allCollapsed=weeks.every(function(week){return week.classList.contains('is-collapsed')});
    var icon=button.querySelector('.billsos-nav-icon'),label=button.querySelector('.billsos-nav-label');
    if(icon)icon.textContent=allCollapsed?'＋':'−';if(label)label.textContent=allCollapsed?'Expand weeks':'Collapse weeks';
    button.setAttribute('aria-label',allCollapsed?'Expand all weeks':'Collapse all weeks');
  }

  function ensureShell(){
    if(document.getElementById('billsosAppShell'))return;
    var wrap=document.querySelector('.wrap');if(!wrap)return;
    document.body.classList.add('billsos-v2');
    var path=location.pathname,control=path.indexOf('/control')===0,legacy=path.indexOf('/legacy')===0,dashboard=!control&&!legacy;
    var shell=document.createElement('div');shell.id='billsosAppShell';shell.className='billsos-app-shell';
    var sidebar=document.createElement('aside');sidebar.id='billsosSidebar';sidebar.className='billsos-sidebar';sidebar.setAttribute('aria-label','BillsOS navigation');
    sidebar.innerHTML='<div class="billsos-brand"><div class="billsos-brand-mark">B</div><div><strong>BillsOS</strong><small>Cash flow planner</small></div></div><nav class="billsos-side-nav">'+navLink('⌂','Dashboard','/',dashboard)+navButton('▦','Calendar','calendar')+navLink('◎','Control Center','/control',control)+navLink('◫','Legacy','/legacy',legacy)+navButton('✦','Ask BillsOS','ask')+'<div class="billsos-nav-divider"></div>'+navButton('−','Collapse weeks','week-toggle')+'</nav><div class="billsos-sidebar-footer"><div id="billsosSidebarSyncSlot"></div></div>';
    var main=document.createElement('main');main.className='billsos-main';
    wrap.parentNode.insertBefore(shell,wrap);shell.appendChild(sidebar);shell.appendChild(main);main.appendChild(wrap);
    var mobile=document.createElement('button');mobile.id='billsosSidebarToggle';mobile.type='button';mobile.setAttribute('aria-label','Open navigation');mobile.textContent='☰';document.body.appendChild(mobile);
    var scrim=document.createElement('div');scrim.className='billsos-sidebar-scrim';document.body.appendChild(scrim);
    mobile.onclick=function(){document.body.classList.toggle('billsos-sidebar-open')};scrim.onclick=function(){document.body.classList.remove('billsos-sidebar-open')};

    sidebar.addEventListener('click',function(event){
      var link=event.target&&event.target.closest&&event.target.closest('a[data-billsos-nav]');
      if(link){event.preventDefault();event.stopPropagation();window.location.assign(link.getAttribute('href'));return}
      var action=event.target&&event.target.closest&&event.target.closest('[data-billsos-action]');if(!action)return;
      var name=action.getAttribute('data-billsos-action');
      if(name==='calendar'){var panel=currentPanel();if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});else window.location.assign('/')}
      if(name==='ask'){var candidates=Array.prototype.slice.call(document.querySelectorAll('button,a'));var ask=candidates.find(function(el){return /ask billsos/i.test(text(el))&&!el.closest('#billsosSidebar')});if(ask)ask.click();else window.location.assign('/')}
      if(name==='week-toggle'){var panel=currentPanel(),weeks=panel?Array.prototype.slice.call(panel.querySelectorAll('.billsos-week')):[];var allCollapsed=weeks.length&&weeks.every(function(week){return week.classList.contains('is-collapsed')});weeks.forEach(function(week){setWeekCollapsed(week,!allCollapsed,true)})}
      document.body.classList.remove('billsos-sidebar-open');
    });
  }

  function moveSync(){var slot=document.getElementById('billsosSidebarSyncSlot');if(!slot)return;var status=document.getElementById('billsosSyncStatus'),button=document.getElementById('billsosCanonicalSync');if(status&&status.parentNode!==slot)slot.appendChild(status);if(button&&button.parentNode!==slot)slot.appendChild(button)}

  function enhanceGrid(grid,panel){
    if(!grid||grid.dataset.billsosWeeks==='1')return;
    var cells=Array.prototype.slice.call(grid.children).filter(function(node){return node.classList&&node.classList.contains('day')});if(!cells.length)return;
    grid.dataset.billsosWeeks='1';grid.classList.add('billsos-week-grid');grid.innerHTML='';var saved=readJson(COLLAPSE_KEY);
    for(var i=0;i<cells.length;i+=7){
      var chunk=cells.slice(i,i+7),actual=chunk.filter(function(day){return !day.classList.contains('is-blank')&&!day.classList.contains('blank')});
      var week=document.createElement('section');week.className='billsos-week';week.dataset.weekKey=weekKey(panel,i/7);
      var first=actual[0],last=actual[actual.length-1],firstNum=first&&first.querySelector('.dnum,.topline b'),lastNum=last&&last.querySelector('.dnum,.topline b');
      var range=firstNum&&lastNum?text(firstNum)+'–'+text(lastNum):'Month edge';var events=chunk.reduce(function(sum,day){return sum+day.querySelectorAll('.ev').length},0);var close=last&&last.querySelector('.eod b,.endline b');
      var toggle=document.createElement('button');toggle.type='button';toggle.className='billsos-week-toggle';toggle.setAttribute('aria-expanded','true');toggle.innerHTML='<span class="billsos-week-title">Week '+(i/7+1)+'</span><span class="billsos-week-summary">Days '+range+' · '+events+' item'+(events===1?'':'s')+(close?' · closes '+text(close):'')+'</span><span class="billsos-week-chevron">⌄</span>';
      var days=document.createElement('div');days.className='billsos-week-days';chunk.forEach(function(day){days.appendChild(day)});week.appendChild(toggle);week.appendChild(days);grid.appendChild(week);
      setWeekCollapsed(week,!!saved[week.dataset.weekKey],false);
      toggle.addEventListener('click',function(event){var row=event.currentTarget.closest('.billsos-week');setWeekCollapsed(row,!row.classList.contains('is-collapsed'),true)});
    }
    updateWeekButton();
  }

  function enhance(){installFont();installStyles();ensureShell();document.querySelectorAll('.month-panel').forEach(function(panel){enhanceGrid(panel.querySelector('.grid'),panel)});moveSync();updateWeekButton()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
  try{new MutationObserver(function(){enhance()}).observe(document.documentElement,{subtree:true,childList:true})}catch(e){}
  window.addEventListener('load',enhance);
})();
