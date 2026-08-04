'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

function upsertScript(html, script) {
  const match = script.match(/src="([^"]+)/);
  if (!match) return html;
  const src = match[1].split('?')[0];
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp('<script[^>]+src=["\\\']' + escaped + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
  if (existing.test(html)) return html.replace(existing, script);
  return html.replace('</body>', script + '\n</body>');
}

const polishedUi = String.raw`<script id="billsosPolishedUi">
(function(){
  'use strict';
  if(window.__billsosPolishedUi)return;
  window.__billsosPolishedUi=true;

  function money(value){return Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function addFont(){if(document.getElementById('billsosPolishedFont'))return;var link=document.createElement('link');link.id='billsosPolishedFont';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';document.head.appendChild(link)}

  function addStyles(){
    if(document.getElementById('billsosPolishedStyles'))return;
    var style=document.createElement('style');style.id='billsosPolishedStyles';style.textContent=[
      ':root{--bo-bg:#f5f7f2;--bo-card:#fff;--bo-ink:#18231d;--bo-muted:#69756e;--bo-line:#dfe6de;--bo-green:#2f7048;--bo-green-dark:#205837;--bo-green-soft:#e7f0e6;--bo-red:#c74438;--bo-shadow:0 10px 28px rgba(31,59,44,.07)}',
      'html{background:var(--bo-bg)}body.billsos-polished{margin:0!important;background:linear-gradient(135deg,#f4f7f1 0%,#fffdfa 56%,#eef4ec 100%)!important;color:var(--bo-ink)!important;font-family:Manrope,"Avenir Next","Segoe UI",sans-serif!important}',
      '.bo-sidebar{position:fixed;inset:0 auto 0 0;width:220px;z-index:80;display:flex;flex-direction:column;padding:28px 16px 18px;background:rgba(250,252,248,.96);border-right:1px solid var(--bo-line);backdrop-filter:blur(20px)}',
      '.bo-brand{display:flex;align-items:center;gap:12px;padding:0 10px 26px}.bo-leaf{font-size:30px;line-height:1;color:var(--bo-green)}.bo-brand strong{display:block;font-size:22px;letter-spacing:-.05em}.bo-brand small{display:block;margin-top:2px;color:var(--bo-muted);font-size:11px}',
      '.bo-nav{display:grid;gap:5px}.bo-nav a,.bo-nav button{display:flex;align-items:center;gap:12px;width:100%;padding:12px 13px;border:0;border-radius:12px;background:transparent;color:#34433a;text-decoration:none;font:inherit;font-size:14px;font-weight:650;text-align:left;cursor:pointer}.bo-nav a:hover,.bo-nav button:hover{background:#edf3eb}.bo-nav .is-active{background:linear-gradient(135deg,#3d7d55,#6f9f78);color:#fff;box-shadow:0 8px 20px rgba(47,112,72,.18)}.bo-icon{width:24px;text-align:center;font-size:16px}.bo-divider{height:1px;margin:13px 9px;background:var(--bo-line)}',
      '.bo-sidebar-bottom{margin-top:auto}.bo-week-control{margin-bottom:18px}.bo-status{padding:14px;border:1px solid var(--bo-line);border-radius:14px;background:#fff;box-shadow:0 5px 18px rgba(31,59,44,.04);font-size:11px;color:var(--bo-muted);line-height:1.65}.bo-status strong{display:block;color:var(--bo-green);font-size:12px}.bo-dot{display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:#39a160}.bo-copy{margin-top:28px;color:#879189;font-size:11px}',
      'body.billsos-polished>.wrap{max-width:none!important;margin-left:220px!important;padding:24px 28px 44px!important}',
      'body.billsos-polished .top{display:none!important}body.billsos-polished>.wrap>.banner{display:none!important}',
      '.bo-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}.bo-page-head h1{margin:0;font-size:32px;line-height:1.05;letter-spacing:-.05em}.bo-page-head p{margin:7px 0 0;color:var(--bo-muted);font-size:14px}.bo-head-actions{display:flex;gap:9px}.bo-head-btn{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--bo-line);border-radius:12px;background:#fff;box-shadow:0 4px 12px rgba(31,59,44,.04);font-size:17px;cursor:pointer}',
      '.bo-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}.bo-metric{position:relative;padding:20px;border:1px solid var(--bo-line);border-radius:16px;background:#fff;box-shadow:var(--bo-shadow)}.bo-metric-label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#526058}.bo-metric-value{margin-top:14px;font-size:30px;line-height:1;font-weight:800;letter-spacing:-.045em}.bo-metric-note{margin-top:12px;color:var(--bo-green);font-size:12px;font-weight:700}.bo-metric-icon{position:absolute;right:18px;top:48px;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--bo-green-soft);color:var(--bo-green);font-size:19px}',
      'body.billsos-polished .tabs{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:0 0 16px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}body.billsos-polished .tab{padding:9px 15px!important;border:1px solid var(--bo-line)!important;border-radius:999px!important;background:#fff!important;color:var(--bo-ink)!important;font-size:12px!important;font-weight:700!important;box-shadow:0 3px 9px rgba(31,59,44,.04)}body.billsos-polished .tab.active{background:linear-gradient(135deg,#2f7048,#4d8b61)!important;border-color:transparent!important;color:#fff!important}',
      'body.billsos-polished .card{padding:20px!important;border:1px solid var(--bo-line)!important;border-radius:16px!important;background:#fff!important;box-shadow:var(--bo-shadow)!important}body.billsos-polished .cardhead{margin-bottom:16px!important}body.billsos-polished .card h2{font-size:18px!important;letter-spacing:-.025em!important}',
      'body.billsos-polished .grid{gap:13px!important}body.billsos-polished label{margin-bottom:7px!important;color:#657269!important;font-size:10px!important;font-weight:800!important;letter-spacing:.1em!important}body.billsos-polished input,body.billsos-polished select,body.billsos-polished textarea{min-height:44px!important;padding:11px 13px!important;border:1px solid var(--bo-line)!important;border-radius:11px!important;background:#fff!important;color:var(--bo-ink)!important;font-family:inherit!important;box-shadow:inset 0 1px 2px rgba(31,59,44,.02)}body.billsos-polished textarea{min-height:72px!important}body.billsos-polished input:focus,body.billsos-polished select:focus,body.billsos-polished textarea:focus{outline:3px solid rgba(47,112,72,.12)!important;border-color:#6a9877!important}',
      'body.billsos-polished .btn,body.billsos-polished .linkbtn{min-height:40px!important;padding:9px 14px!important;border:1px solid var(--bo-line)!important;border-radius:11px!important;background:#fff!important;color:var(--bo-ink)!important;font-size:12px!important;font-weight:750!important;box-shadow:0 4px 12px rgba(31,59,44,.04)}body.billsos-polished .btn.primary{background:linear-gradient(135deg,#2f7048,#47865b)!important;border-color:transparent!important;color:#fff!important}body.billsos-polished .btn.danger{color:var(--bo-red)!important}',
      'body.billsos-polished .tablewrap{border:1px solid var(--bo-line)!important;border-radius:13px!important;overflow:auto!important;background:#fff!important}body.billsos-polished table{min-width:820px!important}body.billsos-polished th{padding:11px!important;background:#f1f5ef!important;color:#5f6b63!important;font-size:9px!important}body.billsos-polished td{padding:11px!important;border-bottom:1px solid #edf1ec!important;font-size:12px!important}body.billsos-polished tr:hover td{background:#fbfcfa}',
      '.bo-saved-tools{display:flex;align-items:center;gap:12px}.bo-search{position:relative}.bo-search input{width:220px!important;padding-right:36px!important}.bo-search span{position:absolute;right:12px;top:12px}',
      '#boMenu{display:none;position:fixed;left:12px;top:12px;z-index:100;width:42px;height:42px;border:1px solid var(--bo-line);border-radius:12px;background:#fff;box-shadow:var(--bo-shadow);font-size:19px}#boScrim{display:none}',
      'body.billsos-polished .hero{border:1px solid var(--bo-line)!important;background:#fff!important;box-shadow:var(--bo-shadow)!important}body.billsos-polished .hero .nav{display:none!important}body.billsos-polished .month-panel{border-color:var(--bo-line)!important;background:#fff!important;box-shadow:var(--bo-shadow)!important}',
      '@media(max-width:1050px){.bo-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:760px){body.billsos-polished>.wrap{margin-left:0!important;padding:68px 10px 30px!important}.bo-sidebar{width:min(84vw,290px);transform:translateX(-105%);transition:transform .2s ease}.bo-open .bo-sidebar{transform:translateX(0)}#boMenu{display:grid;place-items:center}.bo-open #boScrim{display:block;position:fixed;inset:0;z-index:70;background:rgba(24,35,29,.30);backdrop-filter:blur(2px)}.bo-metrics{grid-template-columns:1fr}.bo-page-head{display:block}.bo-head-actions{margin-top:14px}.bo-search input{width:160px!important}body.billsos-polished .field,body.billsos-polished .field.wide,body.billsos-polished .field.small{grid-column:1/-1!important}}'
    ].join('');document.head.appendChild(style)
  }

  function navLink(icon,label,href,active){return '<a href="'+href+'" target="_self"'+(active?' class="is-active"':'')+'><span class="bo-icon">'+icon+'</span><span>'+label+'</span></a>'}
  function tabLink(icon,label,tab,active){return '<a href="/control#'+tab+'" data-bo-tab="'+tab+'"'+(active?' class="is-active"':'')+'><span class="bo-icon">'+icon+'</span><span>'+label+'</span></a>'}

  function installSidebar(){
    if(document.getElementById('boSidebar'))return;
    var path=location.pathname,control=path.indexOf('/control')===0,legacy=path.indexOf('/legacy')===0,dashboard=!control&&!legacy,hash=location.hash.replace('#','')||'bills';
    var aside=document.createElement('aside');aside.id='boSidebar';aside.className='bo-sidebar';
    aside.innerHTML='<div class="bo-brand"><div class="bo-leaf">◒</div><div><strong>BillsOS</strong><small>Cash flow planner</small></div></div><nav class="bo-nav">'+navLink('⌂','Home','/',dashboard)+navLink('▦','Calendar','/#calendar',false)+tabLink('▤','Bills','bills',control&&hash==='bills')+tabLink('♙','Income','income',control&&hash==='income')+tabLink('↝','Cash Flow','oneTime',control&&hash==='oneTime')+navLink('▥','Accounts','/control#backup',control&&hash==='backup')+'<div class="bo-divider"></div>'+navLink('↗','Reports','/control#backup',false)+navLink('⚙','Settings','/control#backup',false)+'</nav><div class="bo-sidebar-bottom"><button class="bo-week-control" id="boWeekButton" hidden><span class="bo-icon">−</span><span>Collapse weeks</span></button><div class="bo-status"><strong><span class="bo-dot"></span>BillsOS online</strong><span>All changes synced</span><br><span id="boStatusTime"></span></div><div class="bo-copy">© 2026 BillsOS</div></div>';
    document.body.appendChild(aside);
    var menu=document.createElement('button');menu.id='boMenu';menu.type='button';menu.textContent='☰';menu.setAttribute('aria-label','Open navigation');document.body.appendChild(menu);
    var scrim=document.createElement('div');scrim.id='boScrim';document.body.appendChild(scrim);
    menu.onclick=function(){document.body.classList.toggle('bo-open')};scrim.onclick=function(){document.body.classList.remove('bo-open')};
    aside.addEventListener('click',function(event){var link=event.target.closest&&event.target.closest('a[href]');if(!link)return;event.preventDefault();var href=link.getAttribute('href'),tab=link.getAttribute('data-bo-tab');if(control&&tab&&typeof window.showTab==='function'){window.showTab(tab);history.replaceState(null,'','#'+tab);aside.querySelectorAll('a').forEach(function(a){a.classList.remove('is-active')});link.classList.add('is-active')}else if(href==='/#calendar'&&dashboard){var panel=document.querySelector('.month-panel.show')||document.querySelector('.month-panel');if(panel)panel.scrollIntoView({behavior:'smooth'});else location.assign(href)}else location.assign(href);document.body.classList.remove('bo-open')});
    var time=document.getElementById('boStatusTime');if(time)time.textContent=new Date().toLocaleString([], {month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
  }

  function addControlHeader(){
    if(location.pathname.indexOf('/control')!==0||document.getElementById('boPageHead'))return;
    var wrap=document.querySelector('.wrap'),tabs=wrap&&wrap.querySelector('.tabs');if(!wrap||!tabs)return;
    var head=document.createElement('section');head.id='boPageHead';head.className='bo-page-head';head.innerHTML='<div><h1>Good '+(new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening')+', Ryan</h1><p>Take control of your cash flow.</p></div><div class="bo-head-actions"><button class="bo-head-btn" type="button" title="Refresh" onclick="loadData()">↻</button><button class="bo-head-btn" type="button" title="Save" onclick="saveData()">✓</button></div>';
    var metrics=document.createElement('section');metrics.id='boMetrics';metrics.className='bo-metrics';
    wrap.insertBefore(head,wrap.firstChild);wrap.insertBefore(metrics,tabs);
    fetch('/api/bills?ui='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{}}).then(function(data){
      var bills=(data.bills||[]).filter(function(x){return x&&x.active!==false}),income=(data.income||[]).filter(function(x){return x&&x.active!==false}),one=(data.oneTimeEvents||[]).filter(function(x){return x&&!/^__billsos_/.test(String(x.id||''))});
      var monthly=bills.filter(function(x){return !x.frequency||x.frequency==='monthly'}).reduce(function(s,x){return s+Math.abs(Number(x.amount||0))},0);
      var incomeTotal=income.reduce(function(s,x){return s+Math.abs(Number(x.amount||0))},0);
      var cards=[['Active bills',bills.length,'Recurring obligations','▤'],['Monthly outflow',money(monthly),'Scheduled bills','↘'],['Income sources',income.length,money(incomeTotal)+' per cycle','♙'],['Adjustments',one.length,'One-time cash flow','↝']];
      metrics.innerHTML=cards.map(function(c){return '<article class="bo-metric"><div class="bo-metric-label">'+esc(c[0])+'</div><div class="bo-metric-value">'+esc(c[1])+'</div><div class="bo-metric-note">'+esc(c[2])+'</div><div class="bo-metric-icon">'+c[3]+'</div></article>'}).join('')
    }).catch(function(){metrics.innerHTML=''})
  }

  function addSearch(){
    if(location.pathname.indexOf('/control')!==0)return;
    var tableCard=document.querySelector('#panel-bills .card:nth-of-type(2)');if(!tableCard||tableCard.querySelector('.bo-search'))return;
    var head=tableCard.querySelector('.cardhead');if(!head)return;
    var tools=document.createElement('div');tools.className='bo-saved-tools';
    var count=head.querySelector('#billCount');if(count)tools.appendChild(count);
    var search=document.createElement('label');search.className='bo-search';search.innerHTML='<input type="search" placeholder="Search bills…" aria-label="Search bills"><span>⌕</span>';tools.appendChild(search);head.appendChild(tools);
    search.querySelector('input').addEventListener('input',function(){var q=this.value.toLowerCase();tableCard.querySelectorAll('tbody tr').forEach(function(row){row.style.display=row.textContent.toLowerCase().indexOf(q)>=0?'':'none'})})
  }

  function selectHashTab(){if(location.pathname.indexOf('/control')!==0)return;var tab=location.hash.replace('#','');if(tab&&typeof window.showTab==='function'&&['bills','oneTime','income','backup'].indexOf(tab)>=0)window.showTab(tab)}
  function install(){addFont();addStyles();document.body.classList.add('billsos-polished');installSidebar();addControlHeader();selectHashTab();setTimeout(addSearch,300)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  const isDashboard = name.endsWith('generated-v5.html');
  const isControl = name.endsWith('control.html');
  const isLegacy = name.endsWith('index.html');
  if (!isText || (!isDashboard && !isControl && !isLegacy)) return result;
  let html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  if (isDashboard) {
    html = upsertScript(html, '<script defer src="/amount-balance-hotfix.js?v=20260728calendartruth4"></script>');
    html = upsertScript(html, '<script defer src="/billsos-cross-device-sync.js?v=20260730localfirst1"></script>');
  }
  if (!html.includes('id="billsosPolishedUi"')) html = html.replace('</body>', polishedUi + '\n</body>');
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};
