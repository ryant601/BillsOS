'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

const billsosV2Ui = String.raw`<script id="billsosV2Ui">
(function(){
  'use strict';
  var COLLAPSE_KEY='billsos-collapsed-weeks-v2';

  function readCollapsed(){try{var parsed=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'{}');return parsed&&typeof parsed==='object'?parsed:{}}catch(e){return {}}}
  function writeCollapsed(map){try{localStorage.setItem(COLLAPSE_KEY,JSON.stringify(map||{}))}catch(e){}}
  function weekKey(panel,index){return (panel.id||'month')+'|'+index}
  function setWeekCollapsed(week,collapsed,persist){
    if(!week)return;
    week.classList.toggle('is-collapsed',!!collapsed);
    var button=week.querySelector('.billsos-week-toggle');
    if(button)button.setAttribute('aria-expanded',collapsed?'false':'true');
    if(persist!==false){var map=readCollapsed();map[week.dataset.weekKey]=!!collapsed;writeCollapsed(map)}
  }

  function installFont(){
    if(document.getElementById('billsosManropeFont'))return;
    var link=document.createElement('link');
    link.id='billsosManropeFont';link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  function installStyles(){
    if(document.getElementById('billsosV2Styles'))return;
    var style=document.createElement('style');
    style.id='billsosV2Styles';
    style.textContent=[
      ':root{--ink:#1f2b26!important;--mut:#68766e!important;--line:#dce5dc!important;--primary:#496f5b!important;--green:#3d7556!important;--out:#b65e52!important;--card:#ffffff!important;--bg:#eef3ec!important;--sage-950:#1f3b30;--sage-800:#345846;--sage-700:#496f5b;--sage-500:#7fa087;--sage-200:#dce8dc;--sage-100:#edf4ec;--sage-50:#f7faf6}',
      'html{background:var(--bg)}body.billsos-v2{margin:0!important;padding:0!important;background:linear-gradient(135deg,#eef3ec 0%,#f7f8f4 48%,#e8efe7 100%)!important;color:var(--ink);font-family:Manrope,"Avenir Next","Segoe UI",sans-serif!important}',
      '.billsos-app-shell{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:100vh}',
      '.billsos-sidebar{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:22px 16px 16px;background:rgba(247,250,246,.96);border-right:1px solid rgba(73,111,91,.14);backdrop-filter:blur(20px);z-index:60}',
      '.billsos-brand{display:flex;align-items:center;gap:11px;padding:4px 8px 22px}.billsos-brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:var(--sage-800);color:white;font-size:18px;font-weight:900;box-shadow:0 9px 24px rgba(52,88,70,.22)}.billsos-brand strong{display:block;font-size:19px;letter-spacing:-.04em}.billsos-brand small{display:block;margin-top:2px;color:var(--mut);font-size:10px;font-weight:700}',
      '.billsos-side-nav{display:grid;gap:5px}.billsos-side-nav a,.billsos-side-nav button{width:100%;display:flex;align-items:center;gap:11px;border:0;border-radius:12px;padding:11px 12px;background:transparent;color:#425047;text-decoration:none;font:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer}.billsos-side-nav a:hover,.billsos-side-nav button:hover{background:#e8f0e6;color:var(--sage-950)}.billsos-side-nav .is-active{background:#d9e7d7;color:var(--sage-950);box-shadow:inset 0 0 0 1px rgba(73,111,91,.08)}.billsos-nav-icon{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:rgba(73,111,91,.09);font-size:14px;font-weight:900}.billsos-nav-divider{height:1px;margin:12px 8px;background:rgba(73,111,91,.12)}',
      '.billsos-sidebar-footer{margin-top:auto;display:grid;gap:8px;padding:14px 8px 2px;border-top:1px solid rgba(73,111,91,.12)}.billsos-sidebar-footer #billsosSyncStatus{justify-content:flex-start!important;padding:0!important;min-height:auto!important;color:var(--sage-700)!important}.billsos-sidebar-footer #billsosCanonicalSync{width:100%!important;margin:0!important;border-color:rgba(73,111,91,.16)!important;background:#fff!important;color:var(--sage-950)!important;box-shadow:none!important}',
      '.billsos-main{min-width:0;padding:22px 24px 40px}.billsos-main>.wrap{max-width:1480px!important;margin:0 auto!important}',
      'body.billsos-v2 .pill{display:none!important}body.billsos-v2 .hero{margin:0 0 14px!important;padding:20px 22px!important;border:1px solid rgba(73,111,91,.10)!important;border-radius:22px!important;background:rgba(255,255,255,.82)!important;box-shadow:0 14px 38px rgba(52,88,70,.08)!important}body.billsos-v2 .hero .nav{display:none!important}body.billsos-v2 .hero h1{font-size:clamp(30px,4vw,44px)!important;line-height:1!important;letter-spacing:-.05em!important;margin:4px 0 7px!important}body.billsos-v2 .hero .sub{max-width:720px;font-size:13px;line-height:1.55}',
      'body.billsos-v2 .tabs{gap:7px;margin:0 0 14px!important;padding:7px;border:1px solid rgba(73,111,91,.10);border-radius:16px;background:rgba(255,255,255,.66);box-shadow:0 7px 24px rgba(52,88,70,.05)}body.billsos-v2 .tabs button{border:0!important;background:transparent!important;color:#68766e!important;border-radius:11px!important;padding:9px 14px!important}body.billsos-v2 .tabs button.active{background:var(--sage-800)!important;color:#fff!important;box-shadow:0 7px 18px rgba(52,88,70,.20)}',
      'body.billsos-v2 .month-panel{padding:18px!important;border:1px solid rgba(73,111,91,.10)!important;border-radius:22px!important;background:rgba(255,255,255,.88)!important;box-shadow:0 18px 48px rgba(52,88,70,.08)!important}body.billsos-v2 .month-panel header{margin-bottom:12px!important}body.billsos-v2 .month-panel h1{font-size:30px!important;letter-spacing:-.04em}body.billsos-v2 .month-panel h1 span{color:var(--mut);font-weight:550}',
      'body.billsos-v2 .chips{gap:7px!important}body.billsos-v2 .chip,body.billsos-v2 .kpi{min-width:118px!important;padding:11px 12px!important;border:1px solid rgba(73,111,91,.10)!important;border-radius:15px!important;background:#f7faf6!important;box-shadow:none!important}body.billsos-v2 .chip .v,body.billsos-v2 .kpi b{font-size:18px!important}',
      'body.billsos-v2 .dow-row{padding:0 10px 4px}body.billsos-v2 .grid.billsos-week-grid{display:block!important;margin-top:5px!important}',
      '.billsos-week{margin:0 0 10px;border:1px solid rgba(73,111,91,.10);border-radius:17px;background:rgba(247,250,246,.68);overflow:hidden;transition:box-shadow .18s ease,border-color .18s ease}.billsos-week:hover{border-color:rgba(73,111,91,.20);box-shadow:0 9px 26px rgba(52,88,70,.06)}.billsos-week-toggle{width:100%;display:flex;align-items:center;gap:12px;border:0;padding:10px 12px;background:rgba(232,240,230,.72);color:var(--ink);font:inherit;cursor:pointer;text-align:left}.billsos-week-title{font-size:12px;font-weight:850;white-space:nowrap}.billsos-week-summary{min-width:0;flex:1;color:var(--mut);font-size:10px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.billsos-week-chevron{font-size:15px;color:var(--sage-700);transition:transform .18s ease}.billsos-week.is-collapsed .billsos-week-chevron{transform:rotate(-90deg)}.billsos-week-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;padding:8px}.billsos-week.is-collapsed .billsos-week-days{display:none}',
      'body.billsos-v2 .day{height:178px!important;min-height:178px!important;border:1px solid #e1e9e1!important;border-radius:14px!important;background:#fff!important;box-shadow:0 2px 10px rgba(52,88,70,.035)}body.billsos-v2 .day.is-blank{border:0!important;background:transparent!important;box-shadow:none!important}body.billsos-v2 .day.is-today{outline:2px solid rgba(73,111,91,.38)!important;outline-offset:-1px}body.billsos-v2 .day.is-warn{border-color:rgba(182,94,82,.30)!important;background:#fffdfc!important}',
      'body.billsos-v2 .ev{border-radius:10px!important}body.billsos-v2 .ev.in{background:#e6f1e7!important;color:#35684c!important}body.billsos-v2 .ev.out{background:#f8e9e5!important;color:#a95349!important}body.billsos-v2 .ev.xfer{background:#f5edcf!important;color:#806119!important}',
      '#billsosSidebarToggle{display:none;position:fixed;left:12px;top:12px;z-index:90;width:42px;height:42px;border:1px solid rgba(73,111,91,.16);border-radius:13px;background:#fff;color:var(--sage-950);font-size:20px;box-shadow:0 10px 28px rgba(52,88,70,.18)}.billsos-sidebar-scrim{display:none}',
      '@media(max-width:1050px) and (min-width:761px){.billsos-app-shell{grid-template-columns:200px minmax(0,1fr)}.billsos-sidebar{padding-left:11px;padding-right:11px}.billsos-main{padding-left:16px;padding-right:16px}.billsos-brand small{display:none}}',
      '@media(max-width:760px){.billsos-app-shell{display:block}.billsos-main{padding:66px 9px 28px}.billsos-sidebar{position:fixed;left:0;top:0;width:min(82vw,290px);height:100dvh;transform:translateX(-105%);transition:transform .22s ease;box-shadow:22px 0 60px rgba(31,59,48,.18)}body.billsos-sidebar-open .billsos-sidebar{transform:translateX(0)}#billsosSidebarToggle{display:grid;place-items:center}body.billsos-sidebar-open .billsos-sidebar-scrim{display:block;position:fixed;inset:0;z-index:55;background:rgba(31,43,38,.28);backdrop-filter:blur(2px)}body.billsos-v2 .hero{padding:16px!important}body.billsos-v2 .month-panel{padding:10px!important}.billsos-week-toggle{padding:10px}.billsos-week-days{display:block;padding:6px}.billsos-week-days .day{margin:7px 0!important}.billsos-week-days .day.is-blank{display:none!important}.billsos-week-summary{font-size:9px}body.billsos-v2 .tabs{overflow-x:auto;flex-wrap:nowrap!important;scrollbar-width:none}body.billsos-v2 .tabs::-webkit-scrollbar{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function navButton(icon,label,action){return '<button type="button" data-billsos-action="'+action+'"><span class="billsos-nav-icon">'+icon+'</span><span>'+label+'</span></button>'}

  function ensureShell(){
    if(document.getElementById('billsosAppShell'))return;
    var wrap=document.querySelector('.wrap');if(!wrap)return;
    document.body.classList.add('billsos-v2');
    var shell=document.createElement('div');shell.id='billsosAppShell';shell.className='billsos-app-shell';
    var sidebar=document.createElement('aside');sidebar.id='billsosSidebar';sidebar.className='billsos-sidebar';sidebar.setAttribute('aria-label','BillsOS navigation');
    sidebar.innerHTML='<div class="billsos-brand"><div class="billsos-brand-mark">B</div><div><strong>BillsOS</strong><small>Cash flow planner</small></div></div><nav class="billsos-side-nav"><a class="is-active" href="/"><span class="billsos-nav-icon">⌂</span><span>Dashboard</span></a>'+navButton('▦','Calendar','calendar')+'<a href="/control"><span class="billsos-nav-icon">◎</span><span>Control Center</span></a>'+navButton('✦','Ask BillsOS','ask')+'<div class="billsos-nav-divider"></div>'+navButton('−','Collapse weeks','collapse')+navButton('+','Expand weeks','expand')+'</nav><div class="billsos-sidebar-footer"><div id="billsosSidebarSyncSlot"></div></div>';
    var main=document.createElement('main');main.className='billsos-main';
    wrap.parentNode.insertBefore(shell,wrap);shell.appendChild(sidebar);shell.appendChild(main);main.appendChild(wrap);
    var toggle=document.createElement('button');toggle.id='billsosSidebarToggle';toggle.type='button';toggle.setAttribute('aria-label','Open navigation');toggle.textContent='☰';document.body.appendChild(toggle);
    var scrim=document.createElement('div');scrim.className='billsos-sidebar-scrim';document.body.appendChild(scrim);
    toggle.addEventListener('click',function(){document.body.classList.toggle('billsos-sidebar-open')});
    scrim.addEventListener('click',function(){document.body.classList.remove('billsos-sidebar-open')});
    sidebar.addEventListener('click',function(event){var action=event.target&&event.target.closest&&event.target.closest('[data-billsos-action]');if(!action)return;var name=action.getAttribute('data-billsos-action');if(name==='calendar'){var panel=document.querySelector('.month-panel.show')||document.querySelector('.month-panel');if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'})}if(name==='ask'){var buttons=Array.prototype.slice.call(document.querySelectorAll('button,a'));var ask=buttons.find(function(el){return /ask billsos/i.test(String(el.textContent||''))&&!el.closest('#billsosSidebar')});if(ask)ask.click()}if(name==='collapse'||name==='expand'){var panel=document.querySelector('.month-panel.show')||document;panel.querySelectorAll('.billsos-week').forEach(function(week){setWeekCollapsed(week,name==='collapse',true)})}document.body.classList.remove('billsos-sidebar-open')});
  }

  function moveSyncControls(){
    var slot=document.getElementById('billsosSidebarSyncSlot');if(!slot)return;
    var status=document.getElementById('billsosSyncStatus'),sync=document.getElementById('billsosCanonicalSync');
    if(status&&status.parentNode!==slot)slot.appendChild(status);
    if(sync&&sync.parentNode!==slot)slot.appendChild(sync);
  }

  function textOf(node){return String(node&&node.textContent||'').replace(/\s+/g,' ').trim()}
  function enhanceGrid(grid,panel){
    if(!grid||grid.dataset.billsosWeeks==='1')return;
    var cells=Array.prototype.slice.call(grid.children).filter(function(node){return node.classList&&node.classList.contains('day')});
    if(!cells.length)return;
    grid.dataset.billsosWeeks='1';grid.classList.add('billsos-week-grid');grid.innerHTML='';
    var state=readCollapsed();
    for(var i=0;i<cells.length;i+=7){
      var chunk=cells.slice(i,i+7),actual=chunk.filter(function(day){return !day.classList.contains('is-blank')&&!day.classList.contains('blank')});
      var week=document.createElement('section');week.className='billsos-week';week.dataset.weekKey=weekKey(panel,i/7);
      var first=actual[0],last=actual[actual.length-1],firstNum=first&&first.querySelector('.dnum,.topline b'),lastNum=last&&last.querySelector('.dnum,.topline b');
      var range=(firstNum&&lastNum)?textOf(firstNum)+'–'+textOf(lastNum):'Month edge';
      var events=chunk.reduce(function(sum,day){return sum+day.querySelectorAll('.ev').length},0);
      var closeNode=last&&last.querySelector('.eod b,.endline b');
      var toggle=document.createElement('button');toggle.type='button';toggle.className='billsos-week-toggle';toggle.setAttribute('aria-expanded','true');toggle.innerHTML='<span class="billsos-week-title">Week '+(i/7+1)+'</span><span class="billsos-week-summary">Days '+range+' · '+events+' item'+(events===1?'':'s')+(closeNode?' · closes '+textOf(closeNode):'')+'</span><span class="billsos-week-chevron">⌄</span>';
      var days=document.createElement('div');days.className='billsos-week-days';chunk.forEach(function(day){days.appendChild(day)});
      week.appendChild(toggle);week.appendChild(days);grid.appendChild(week);
      setWeekCollapsed(week,!!state[week.dataset.weekKey],false);
      toggle.addEventListener('click',function(event){var row=event.currentTarget.closest('.billsos-week');setWeekCollapsed(row,!row.classList.contains('is-collapsed'),true)});
    }
  }

  function enhance(){
    installFont();installStyles();ensureShell();
    document.querySelectorAll('.month-panel').forEach(function(panel){var grid=panel.querySelector('.grid');if(grid)enhanceGrid(grid,panel)});
    moveSyncControls();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
  try{new MutationObserver(function(){enhance()}).observe(document.documentElement,{subtree:true,childList:true})}catch(e){}
  window.addEventListener('load',enhance);
})();
</script>`;

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  if (!name.endsWith('generated-v5.html') || (encoding && encoding !== 'utf8' && encoding !== 'utf-8')) return result;

  let html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  const scripts = [
    '<script defer src="/amount-balance-hotfix.js?v=20260728calendartruth4"></script>',
    '<script defer src="/billsos-cross-device-sync.js?v=20260730localfirst1"></script>'
  ];
  scripts.forEach((script) => {
    const src = script.match(/src="([^"]+)/)[1].split('?')[0];
    const existing = new RegExp('<script[^>]+src=["\\\']' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
    if (existing.test(html)) html = html.replace(existing, script);
    else html = html.replace('</body>', script + '</body>');
  });
  if (!html.includes('id="billsosV2Ui"')) html = html.replace('</body>', billsosV2Ui + '</body>');
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};