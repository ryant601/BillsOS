'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

function normalizeBillPaymentsBalance(stamp) {
  const expected = { institution: 'TD Bank', name: 'Bill Payments', officialName: 'TD BEYOND CHECKING', mask: '6189' };
  const account = stamp && stamp.account;
  const exactAccount = account && account.institution === expected.institution && account.name === expected.name &&
    account.officialName === expected.officialName && String(account.mask || '') === expected.mask;
  if (!stamp || stamp.schema !== 'billsos-bill-payments-balance' || stamp.version !== 1 || !exactAccount) return null;
  if (!stamp.balance || !Object.prototype.hasOwnProperty.call(stamp.balance, 'available')) return null;
  const available = stamp.balance.available;
  if (typeof available !== 'number' || !Number.isFinite(available) || available < 0 || stamp.balance.currency !== 'USD') return null;
  if (typeof stamp.bankingAsOf !== 'string' || Number.isNaN(Date.parse(stamp.bankingAsOf))) return null;
  if (stamp.source !== 'Finances' || stamp.sourceField !== 'balances.available') return null;
  return {
    schema: stamp.schema,
    version: stamp.version,
    account: expected,
    balance: { available, currency: 'USD' },
    bankingAsOf: stamp.bankingAsOf,
    source: 'Finances',
    sourceField: 'balances.available'
  };
}

function normalizeSavingsAccountBalance(stamp) {
  const expected = { institution: 'TD Bank', name: 'Savings Account', officialName: 'TD SIMPLE SAVINGS', mask: '2468' };
  const account = stamp && stamp.account;
  const exactAccount = account && account.institution === expected.institution && account.name === expected.name &&
    account.officialName === expected.officialName && String(account.mask || '') === expected.mask;
  if (!stamp || stamp.schema !== 'billsos-savings-account-balance' || stamp.version !== 1 || !exactAccount) return null;
  if (!stamp.balance || !Object.prototype.hasOwnProperty.call(stamp.balance, 'available')) return null;
  const available = stamp.balance.available;
  if (typeof available !== 'number' || !Number.isFinite(available) || available < 0 || stamp.balance.currency !== 'USD') return null;
  if (typeof stamp.bankingAsOf !== 'string' || Number.isNaN(Date.parse(stamp.bankingAsOf))) return null;
  if (stamp.source !== 'Finances' || stamp.sourceField !== 'balances.available') return null;
  return {
    schema: stamp.schema,
    version: stamp.version,
    account: expected,
    balance: { available, currency: 'USD' },
    bankingAsOf: stamp.bankingAsOf,
    source: 'Finances',
    sourceField: 'balances.available'
  };
}

function normalizeEverydaySpendingBalance(snapshot) {
  if (!snapshot || snapshot.schema !== 'billsos-everyday-spending' || snapshot.version !== 1) return null;
  if (!snapshot.metrics || !Object.prototype.hasOwnProperty.call(snapshot.metrics, 'remainingAvailable')) return null;
  const available = snapshot.metrics.remainingAvailable;
  const bankingAsOf = snapshot.freshness && snapshot.freshness.balanceAsOf;
  if (typeof available !== 'number' || !Number.isFinite(available) || available < 0) return null;
  if (typeof bankingAsOf !== 'string' || Number.isNaN(Date.parse(bankingAsOf))) return null;
  return { available, bankingAsOf };
}

function upsertScript(html, script) {
  const match = script.match(/src="([^"]+)/);
  if (!match) return html;
  const src = match[1].split('?')[0];
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp('<script[^>]+src=["\\\']' + escaped + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
  if (existing.test(html)) return html.replace(existing, script);
  return html.replace('</body>', script + '\n</body>');
}

const appUi = String.raw`<script id="billsosAppUi">
(function(){
  'use strict';
  if(window.__billsosAppUi)return;
  window.__billsosAppUi=true;

  var normalizeBillPaymentsBalance=${normalizeBillPaymentsBalance.toString()};
  var normalizeSavingsAccountBalance=${normalizeSavingsAccountBalance.toString()};
  var normalizeEverydaySpendingBalance=${normalizeEverydaySpendingBalance.toString()};
  var DONE_KEY='billsos-generated-done-v5',AMOUNT_KEY='billsos-amount-adjust-v1',DATE_KEY='billsos-pay-adjust-v1',RULE_ID='__billsos_system_rules__';
  var homeState={data:null,upcoming:[],metrics:{start:0,income:0,outflow:0,end:0},bankBalance:null,savingsBalance:null,spendingBalance:null};
  function money(value){return Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}
  function bankMoney(value){return Number(value).toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function bankAsOf(value){try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value))}catch(_e){return 'timestamp unavailable'}}
  function applyBankBalance(stamp){if(!stamp)return;homeState.bankBalance=stamp;var card=document.querySelector('[data-bo-detail="cash"]'),value=card&&card.querySelector('.bo-kpi-value'),note=card&&card.querySelector('.bo-kpi-note');if(value&&note){value.textContent=bankMoney(stamp.balance.available);note.textContent='Bank balance as of '+bankAsOf(stamp.bankingAsOf)}}
  function loadBankBalance(){fetch('/bill-payments-balance.json?home='+Date.now(),{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('balance unavailable');return response.json()}).then(function(candidate){var stamp=normalizeBillPaymentsBalance(candidate);if(stamp)applyBankBalance(stamp)}).catch(function(){})}
  function applySavingsBalance(stamp){if(!stamp)return;homeState.savingsBalance=stamp;var card=document.querySelector('[data-bo-detail="savings"]'),value=card&&card.querySelector('.bo-kpi-value'),note=card&&card.querySelector('.bo-kpi-note');if(value&&note){value.textContent=bankMoney(stamp.balance.available);note.textContent='Bank balance as of '+bankAsOf(stamp.bankingAsOf)}}
  function loadSavingsBalance(){fetch('/savings-account-balance.json?home='+Date.now(),{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('savings balance unavailable');return response.json()}).then(function(candidate){var stamp=normalizeSavingsAccountBalance(candidate);if(stamp)applySavingsBalance(stamp)}).catch(function(){})}
  function applySpendingBalance(stamp){if(!stamp)return;homeState.spendingBalance=stamp;var card=document.querySelector('[data-bo-detail="spending-account"]'),value=card&&card.querySelector('.bo-kpi-value'),note=card&&card.querySelector('.bo-kpi-note');if(value&&note){value.textContent=bankMoney(stamp.available);note.textContent='Bank balance as of '+bankAsOf(stamp.bankingAsOf)}}
  function loadSpendingBalance(){fetch('/spending/current.json?home='+Date.now(),{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('spending balance unavailable');return response.json()}).then(function(candidate){var stamp=normalizeEverydaySpendingBalance(candidate);if(stamp)applySpendingBalance(stamp)}).catch(function(){})}
  function esc(value){return String(value==null?'':value).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function text(node){return String(node&&node.textContent||'').trim()}
  function num(node){var raw=text(node).replace(/[^0-9.-]/g,'');return Number(raw||0)}
  function greeting(){var h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
  function addFont(){if(document.getElementById('boFont'))return;var l=document.createElement('link');l.id='boFont';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap';document.head.appendChild(l)}

  function addStyles(){
    if(document.getElementById('boStyles'))return;
    var s=document.createElement('style');s.id='boStyles';s.textContent=[
      ':root{--bo-bg:#f6f7f4;--bo-bg-2:#eceee8;--bo-card:#fff;--bo-inset:#f2f4ef;--bo-ink:#1a2233;--bo-muted:#5f6673;--bo-faint:#878d97;--bo-line:#dde1dc;--bo-green:#24406b;--bo-green2:#7d9fd2;--bo-soft:#e6ecf5;--bo-red:#9c3d33;--bo-shadow:0 1px 2px rgba(26,34,51,.05)}',
      'html{background:var(--bo-bg)}body.bo-app{margin:0!important;background:var(--bo-bg)!important;color:var(--bo-ink)!important;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:-.008em}',
      '.bo-sidebar{position:fixed;inset:0 auto 0 0;width:224px;z-index:80;display:flex;flex-direction:column;padding:28px 14px 18px;background:var(--bo-bg-2);border-right:1px solid var(--bo-line)}',
      '.bo-brand{display:flex;align-items:center;gap:11px;padding:0 10px 26px}.bo-brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:var(--bo-green);color:#fff;font-size:15px;font-weight:600;letter-spacing:-.03em}.bo-brand strong{display:block;font-family:"Newsreader","Iowan Old Style",Georgia,serif;font-size:22px;font-weight:500;letter-spacing:-.02em}.bo-brand small{display:block;margin-top:1px;color:var(--bo-muted);font-size:11px}',
      '.bo-nav{display:grid;gap:2px}.bo-nav a{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:8px;color:var(--bo-ink);text-decoration:none;font-size:13.5px;font-weight:500;transition:background .15s ease}.bo-nav a:hover{background:rgba(26,34,51,.05)}.bo-nav a.is-active{background:#fff;color:var(--bo-ink);font-weight:600;box-shadow:0 1px 2px rgba(26,34,51,.06)}.bo-icon{width:22px;text-align:center;font-size:15px;color:var(--bo-muted)}.bo-nav a.is-active .bo-icon{color:var(--bo-green)}.bo-divider{height:1px;margin:13px 9px;background:var(--bo-line)}',
      '.bo-side-bottom{margin-top:auto}.bo-status{padding:13px;border:1px solid var(--bo-line);border-radius:12px;background:#fff;box-shadow:none;font-size:11px;color:var(--bo-muted);line-height:1.6}.bo-status strong{display:block;color:var(--bo-ink);font-size:12px;font-weight:600}.bo-dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#3d7a5a}.bo-copy{margin-top:20px;color:var(--bo-faint);font-size:11px}',
      'body.bo-app>.wrap{max-width:none!important;margin-left:224px!important;padding:24px 28px 44px!important}body.bo-home-active>.wrap{display:none!important}',
      '.bo-home{display:none;margin-left:224px;padding:28px 30px 44px;min-height:100vh}.bo-home.is-active{display:block}.bo-home-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}.bo-home-head h1{margin:0;font-family:"Newsreader","Iowan Old Style",Georgia,serif;font-size:36px;font-weight:500;letter-spacing:-.025em}.bo-home-head p{margin:7px 0 0;color:var(--bo-muted)}.bo-month{padding:10px 14px;border:1px solid var(--bo-line);border-radius:10px;background:#fff;font-size:13px;font-weight:600}',
      '.bo-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}.bo-kpi{position:relative;padding:19px;border:1px solid var(--bo-line);border-radius:14px;background:#fff;box-shadow:var(--bo-shadow)}.bo-kpi.is-clickable{cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease}.bo-kpi.is-clickable:hover{border-color:rgba(36,64,107,.36);box-shadow:0 2px 8px rgba(26,34,51,.07)}.bo-kpi:focus-visible{outline:2px solid rgba(36,64,107,.5);outline-offset:2px}.bo-kpi-label{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--bo-muted)}.bo-kpi-value{margin-top:13px;font-size:29px;line-height:1;font-weight:600;letter-spacing:-.035em;font-variant-numeric:tabular-nums}.bo-kpi-note{margin-top:11px;color:var(--bo-muted);font-size:12px;font-weight:500}.bo-kpi-icon{position:absolute;right:18px;top:45px;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:var(--bo-soft);color:var(--bo-green);font-size:18px}.bo-kpi-chevron{position:absolute;right:14px;top:13px;color:var(--bo-faint);font-size:14px}',
      '.bo-outlook-card{padding:17px 18px}.bo-outlook-values{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:12px}.bo-outlook-month{min-width:0;padding:8px 3px;border:1px solid var(--bo-line);border-radius:9px;background:var(--bo-inset);color:var(--bo-ink);font:inherit;text-align:center;cursor:pointer}.bo-outlook-month:hover{border-color:rgba(36,64,107,.36);background:var(--bo-soft)}.bo-outlook-month:focus-visible{outline:2px solid rgba(36,64,107,.5);outline-offset:1px}.bo-outlook-month span{display:block;color:var(--bo-muted);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.bo-outlook-month strong{display:block;margin-top:5px;overflow:visible;font-size:13px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;text-overflow:clip}.bo-outlook-month.is-low strong{color:#866524}.bo-outlook-month.is-negative strong{color:var(--bo-red)}',
      '.bo-home-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.7fr);gap:16px}.bo-panel{padding:20px;border:1px solid var(--bo-line);border-radius:14px;background:#fff;box-shadow:var(--bo-shadow)}.bo-panel h2{margin:0 0 16px;font-family:"Newsreader","Iowan Old Style",Georgia,serif;font-size:20px;font-weight:500;letter-spacing:-.015em}.bo-upcoming{display:grid;gap:7px}.bo-upcoming-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--bo-line);border-radius:10px}.bo-upcoming-row.is-complete{opacity:.7;background:var(--bo-inset)}.bo-upcoming-date{font-size:11px;font-weight:600;color:var(--bo-muted)}.bo-upcoming-main{min-width:0}.bo-upcoming-name{font-size:13px;font-weight:600}.bo-upcoming-row.is-complete .bo-upcoming-name{text-decoration:line-through}.bo-upcoming-status{display:inline-flex;margin-top:4px;padding:3px 7px;border:1px solid var(--bo-line);border-radius:6px;color:var(--bo-muted);font-size:9px;font-weight:600;letter-spacing:.04em;line-height:1}.bo-upcoming-status.is-complete{border-color:transparent;background:#e7f0ea;color:#3d7a5a}.bo-upcoming-amt{font-size:13px;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}.bo-empty{padding:18px;border:1px dashed var(--bo-line);border-radius:10px;color:var(--bo-muted);font-size:13px}',
      '.bo-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.bo-action{padding:14px;border:1px solid var(--bo-line);border-radius:10px;background:#fff;color:var(--bo-ink);text-decoration:none;font-size:13px;font-weight:600}.bo-action:hover{background:var(--bo-bg-2);border-color:rgba(26,34,51,.18)}.bo-attention{margin-top:18px}.bo-attention-item{padding:13px;border-radius:10px;background:#f6e9e6;border:1px solid rgba(156,61,51,.20);color:#8a3527;font-size:12px;font-weight:600}',
      '.bo-detail-scrim{position:fixed;inset:0;z-index:110;background:rgba(26,34,51,.26);opacity:0;pointer-events:none;transition:opacity .2s ease}.bo-detail-drawer{position:fixed;top:0;right:0;bottom:0;z-index:111;width:min(440px,92vw);padding:24px;background:var(--bo-bg);border-left:1px solid var(--bo-line);box-shadow:-8px 0 32px rgba(26,34,51,.10);transform:translateX(105%);transition:transform .24s ease;overflow:auto}.bo-detail-open .bo-detail-scrim{opacity:1;pointer-events:auto}.bo-detail-open .bo-detail-drawer{transform:translateX(0)}.bo-detail-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid var(--bo-line)}.bo-detail-head h2{margin:0;font-family:"Newsreader","Iowan Old Style",Georgia,serif;font-size:26px;font-weight:500;letter-spacing:-.02em}.bo-detail-head p{margin:6px 0 0;color:var(--bo-muted);font-size:13px}.bo-detail-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--bo-line);border-radius:9px;background:#fff;font-size:19px;cursor:pointer}.bo-detail-list{display:grid;gap:8px;margin-top:18px}.bo-detail-row{display:grid;grid-template-columns:74px minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px;border:1px solid var(--bo-line);border-radius:11px;background:#fff}.bo-detail-date{font-size:11px;font-weight:600;color:var(--bo-muted)}.bo-detail-name{font-size:13px;font-weight:600}.bo-detail-meta{margin-top:3px;color:var(--bo-faint);font-size:10px}.bo-detail-amount{font-size:13px;font-weight:650;font-variant-numeric:tabular-nums}.bo-detail-breakdown{display:grid;gap:10px;margin-top:18px}.bo-detail-breakdown-row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--bo-line);font-size:13px}.bo-detail-breakdown-row strong{font-size:14px;font-variant-numeric:tabular-nums}.bo-detail-action{display:block;margin-top:18px;padding:12px 15px;border-radius:10px;background:var(--bo-green);color:#fff;text-align:center;text-decoration:none;font-size:13px;font-weight:600}',
      'body.bo-app .top{display:none!important}body.bo-app>.wrap>.banner{display:none!important}body.bo-app .hero,body.bo-app .month-panel,body.bo-app .card{border-color:var(--bo-line)!important;background:#fff!important;box-shadow:var(--bo-shadow)!important}',
      'body.bo-app .btn.primary{background:var(--bo-green)!important;border-color:transparent!important;color:#fff!important}body.bo-app input,body.bo-app select,body.bo-app textarea{border-color:var(--bo-line)!important}',
      '#boMenu{display:none;position:fixed;left:12px;top:12px;z-index:100;width:40px;height:40px;border:1px solid var(--bo-line);border-radius:10px;background:#fff;box-shadow:var(--bo-shadow);font-size:18px}#boScrim{display:none}',
      'body.bo-calendar .billsos-app-shell{display:block!important}body.bo-calendar .billsos-sidebar,body.bo-calendar #billsosSidebarToggle,body.bo-calendar .billsos-sidebar-scrim{display:none!important}body.bo-calendar .billsos-main{padding:16px 0 42px!important}',
      '@media(min-width:761px){body.bo-calendar .bo-sidebar{width:min(84vw,290px);padding-top:72px;transform:translateX(-105%);transition:transform .2s ease;box-shadow:8px 0 32px rgba(26,34,51,.12)}body.bo-calendar.bo-open .bo-sidebar{transform:translateX(0)}body.bo-calendar #boMenu{display:grid;place-items:center}body.bo-calendar.bo-open #boScrim{display:block;position:fixed;inset:0;z-index:70;background:rgba(26,34,51,.28)}body.bo-calendar>.wrap,body.bo-calendar .billsos-main>.wrap{margin-left:0!important;max-width:none!important;padding:18px 20px 44px 64px!important}}',
      '@media(max-width:1050px){.bo-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.bo-home-grid{grid-template-columns:1fr}}',
      '@media(max-width:760px){body.bo-app>.wrap{margin-left:0!important;padding:68px 10px 30px!important}.bo-home{margin-left:0;padding:72px 12px 30px}.bo-sidebar{width:min(84vw,290px);padding-top:72px;transform:translateX(-105%);transition:transform .2s ease}.bo-open .bo-sidebar{transform:translateX(0)}#boMenu{display:grid;place-items:center}.bo-open #boScrim{display:block;position:fixed;inset:0;z-index:70;background:rgba(26,34,51,.28)}.bo-kpis{grid-template-columns:1fr}.bo-outlook-values{grid-template-columns:repeat(2,minmax(0,1fr))}.bo-home-head{display:block}.bo-month{display:inline-block;margin-top:14px}.bo-actions{grid-template-columns:1fr}.bo-upcoming-row{grid-template-columns:72px minmax(0,1fr) auto}.bo-detail-drawer{top:auto;height:min(78vh,680px);width:auto;left:0;border-left:0;border-top:1px solid var(--bo-line);border-radius:18px 18px 0 0;transform:translateY(105%)}.bo-detail-open .bo-detail-drawer{transform:translateY(0)}}'
    ].join('');document.head.appendChild(s)
  }

  function link(icon,label,href,active,section){return '<a href="'+href+'" target="_self"'+(active?' class="is-active"':'')+(section?' data-bo-section="'+section+'"':'')+'><span class="bo-icon">'+icon+'</span><span>'+label+'</span></a>'}
  function controlSection(){var section=location.hash.slice(1)||'bills';return section==='oneTime'?'bills':['bills','income','backup'].indexOf(section)>=0?section:'bills'}
  function syncSidebarActive(section){document.querySelectorAll('.bo-nav [data-bo-section]').forEach(function(item){item.classList.toggle('is-active',item.getAttribute('data-bo-section')===section)})}
  window.BillsOSSyncSidebarActive=syncSidebarActive;
  function installSidebar(){
    if(document.getElementById('boSidebar'))return;
    var path=location.pathname,view=new URLSearchParams(location.search).get('view')||'home',control=path.indexOf('/control')===0,legacy=path.indexOf('/legacy')===0,dashboard=!control&&!legacy;
    document.body.classList.toggle('bo-calendar', dashboard && view==='calendar');
    var section=controlSection();
    var a=document.createElement('aside');a.id='boSidebar';a.className='bo-sidebar';
    a.innerHTML='<div class="bo-brand"><div class="bo-brand-mark">B</div><div><strong>BillsOS</strong><small>Cash flow planner</small></div></div><nav class="bo-nav">'+link('⌂','Home','/',dashboard&&view!=='calendar')+link('▦','Calendar','/?view=calendar',dashboard&&view==='calendar')+link('▤','Bills','/control#bills',control&&section==='bills','bills')+link('♙','Income','/control#income',control&&section==='income','income')+link('▥','Backup','/control#backup',control&&section==='backup','backup')+'</nav><div class="bo-side-bottom"><div class="bo-status"><strong><span class="bo-dot"></span>BillsOS online</strong>All changes synced<br><span>'+new Date().toLocaleString([], {month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+'</span></div><div class="bo-copy">© 2026 BillsOS</div></div>';
    document.body.appendChild(a);
    var m=document.createElement('button');m.id='boMenu';m.type='button';m.setAttribute('aria-label','Open navigation');m.setAttribute('aria-expanded','false');m.setAttribute('aria-controls','boSidebar');m.textContent='☰';document.body.appendChild(m);var q=document.createElement('div');q.id='boScrim';document.body.appendChild(q);
    function setNavOpen(open){document.body.classList.toggle('bo-open',open);m.setAttribute('aria-expanded',open?'true':'false')}
    m.onclick=function(){setNavOpen(!document.body.classList.contains('bo-open'))};q.onclick=function(){setNavOpen(false)};document.addEventListener('keydown',function(e){if(e.key==='Escape')setNavOpen(false)})
  }

  function readStore(key){try{var raw=localStorage.getItem(key);if(raw===null)return null;var value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}}
  function readCalendarState(data){try{var row=(data.oneTimeEvents||[]).find(function(x){return x&&x.id===RULE_ID}),rules=JSON.parse(row&&row.notes||'{}')||{},state=rules.calendarState&&typeof rules.calendarState==='object'?rules.calendarState:rules;return{completed:state.completed||{},amountAdjustments:state.amountAdjustments||{},dateAdjustments:state.dateAdjustments||{}}}catch(e){return{completed:{},amountAdjustments:{},dateAdjustments:{}}}}
  function stateMap(data,key,name){var local=readStore(key);return local===null?(readCalendarState(data)[name]||{}):local}
  function rowKey(row){return String(row.iso||row.date||'')+'|'+row.name+'|'+row.amount}
  function isoDate(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}
  function upcomingBills(data){
    var now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),end=new Date(today);end.setDate(end.getDate()+14);var engine=window.BillsOSCashflow,rows=[],billsById={};
    (data.bills||[]).forEach(function(bill){if(bill&&bill.id)billsById[bill.id]=bill});
    if(engine&&typeof engine.rowsForMonth==='function'){
      var months=[[today.getFullYear(),today.getMonth()+1],[end.getFullYear(),end.getMonth()+1]];months.filter(function(value,index,all){return all.findIndex(function(other){return other[0]===value[0]&&other[1]===value[1]})===index}).forEach(function(value){if(value[0]===Number(engine.YEAR||value[0]))rows=rows.concat(engine.rowsForMonth(data,value[1],0)||[])})
    }else{
      (data.bills||[]).filter(function(b){return b&&b.active!==false&&Number(b.dueDay)>0}).forEach(function(b){var day=Math.min(Number(b.dueDay),new Date(today.getFullYear(),today.getMonth()+1,0).getDate()),date=new Date(today.getFullYear(),today.getMonth(),day);if(date<today)date=new Date(today.getFullYear(),today.getMonth()+1,Math.min(Number(b.dueDay),new Date(today.getFullYear(),today.getMonth()+2,0).getDate()));rows.push({iso:isoDate(date),name:b.name||'Bill',amount:-Math.abs(Number(b.amount||0)),sourceId:b.id||''})})
    }
    var completed=stateMap(data,DONE_KEY,'completed'),amounts=stateMap(data,AMOUNT_KEY,'amountAdjustments'),dates=stateMap(data,DATE_KEY,'dateAdjustments');
    return rows.filter(function(row){return row&&row.amount<0&&billsById[row.sourceId]}).map(function(row){var key=rowKey(row),amountEdit=amounts[key],dateEdit=dates[key],dateValue=dateEdit&&/^20\d{2}-\d{2}-\d{2}$/.test(String(dateEdit.date||''))?dateEdit.date:row.iso,date=new Date(dateValue+'T00:00:00'),bill=billsById[row.sourceId]||{},amount=amountEdit&&Number.isFinite(Number(amountEdit.amount))?Math.abs(Number(amountEdit.amount)):Math.abs(Number(row.amount||0));return{date:date,diff:Math.round((date-today)/86400000),name:row.name||bill.name||'Bill',amount:amount,auto:!!(bill.autoPay||bill.autopay||bill.payMethod==='auto'||bill.paymentMethod==='autopay'),completed:!!completed[key],key:key}}).filter(function(row){return row.diff>=0&&row.diff<=14}).sort(function(a,b){return a.date-b.date||Number(a.completed)-Number(b.completed)||a.name.localeCompare(b.name)}).slice(0,8)
  }
  function upcomingLabel(x){return x.diff===0?'Today':x.diff===1?'Tomorrow':x.date.toLocaleDateString([], {month:'short',day:'numeric'})}
  function upcomingRow(x,detail){var status=x.completed?'Completed':'Due',meta=status+' · '+(x.auto?'Autopay':'Manual');if(detail)return '<div class="bo-detail-row'+(x.completed?' is-complete':'')+'"><div class="bo-detail-date">'+upcomingLabel(x)+'</div><div><div class="bo-detail-name">'+esc(x.name)+'</div><div class="bo-detail-meta">'+meta+'</div></div><div class="bo-detail-amount">'+money(x.amount)+'</div></div>';return '<div class="bo-upcoming-row'+(x.completed?' is-complete':'')+'"><div class="bo-upcoming-date">'+upcomingLabel(x)+'</div><div class="bo-upcoming-main"><div class="bo-upcoming-name">'+esc(x.name)+'</div><span class="bo-upcoming-status'+(x.completed?' is-complete':'')+'">'+status+'</span></div><div class="bo-upcoming-amt">'+money(x.amount)+'</div></div>'}

  function calendarMonthEnd(year,month){var panel=document.querySelector('.month-panel[data-year="'+year+'"][data-month="'+month+'"]');if(!panel)return null;var stored=Number(panel.dataset.monthEnding);if(Number.isFinite(stored))return stored;var days=Array.from(panel.querySelectorAll('.calendar-day[data-day],.day[data-day]')).sort(function(a,b){return Number(a.dataset.day||0)-Number(b.dataset.day||0)});for(var i=days.length-1;i>=0;i--){var ending=days[i].querySelector('.calendar-day-ending b,.eod b,.endline b');if(ending){var value=num(ending);if(Number.isFinite(value))return value}}return null}
  function remainingMonthEnds(){var now=new Date(),year=now.getFullYear(),months=[];for(var month=now.getMonth()+1;month<=12;month++)months.push({year:year,month:month,label:new Date(year,month-1,1).toLocaleString([], {month:'long'}),shortLabel:new Date(year,month-1,1).toLocaleString([], {month:'short'}),end:calendarMonthEnd(year,month)});return months}
  function relatedMonthCalendarEnd(){var now=new Date();return calendarMonthEnd(now.getFullYear(),now.getMonth()+1)}
  function readCalendarMetrics(){var calendarEnd=relatedMonthCalendarEnd();return {start:num(document.querySelector('#kstart')),income:num(document.querySelector('#kin')),outflow:num(document.querySelector('#kout')),end:calendarEnd==null?num(document.querySelector('#kend')):calendarEnd}}

  function installDetailDrawer(){
    if(document.getElementById('boDetailDrawer'))return;
    var scrim=document.createElement('div');scrim.id='boDetailScrim';scrim.className='bo-detail-scrim';
    var drawer=document.createElement('aside');drawer.id='boDetailDrawer';drawer.className='bo-detail-drawer';drawer.setAttribute('aria-hidden','true');drawer.innerHTML='<div class="bo-detail-head"><div><h2 id="boDetailTitle">Details</h2><p id="boDetailSubtitle"></p></div><button class="bo-detail-close" id="boDetailClose" type="button" aria-label="Close details">×</button></div><div id="boDetailContent"></div>';
    document.body.appendChild(scrim);document.body.appendChild(drawer);
    function close(){document.body.classList.remove('bo-detail-open');drawer.setAttribute('aria-hidden','true')}
    scrim.onclick=close;document.getElementById('boDetailClose').onclick=close;document.addEventListener('keydown',function(e){if(e.key==='Escape')close()})
  }

  function openDetail(kind){
    var drawer=document.getElementById('boDetailDrawer'),title=document.getElementById('boDetailTitle'),sub=document.getElementById('boDetailSubtitle'),content=document.getElementById('boDetailContent');if(!drawer||!title||!content)return;
    var data=homeState.data||{},c=homeState.metrics||{},upcoming=homeState.upcoming||[],bank=homeState.bankBalance,savings=homeState.savingsBalance,spending=homeState.spendingBalance;
    if(kind==='upcoming'){
      title.textContent='Upcoming bills';sub.textContent='Bills and calendar status for the next 14 days';
      content.innerHTML='<div class="bo-detail-list">'+(upcoming.length?upcoming.map(function(x){return upcomingRow(x,true)}).join(''):'<div class="bo-empty">No bills are due in the next 14 days.</div>')+'</div><a class="bo-detail-action" href="/?view=calendar">Open calendar</a>';
    } else if(kind==='income'){
      var income=(data.income||[]).filter(function(x){return x&&x.active!==false});title.textContent='Income remaining';sub.textContent='Active income sources';content.innerHTML='<div class="bo-detail-list">'+(income.length?income.map(function(x){return '<div class="bo-detail-row"><div class="bo-detail-date">Income</div><div><div class="bo-detail-name">'+(x.name||'Income')+'</div><div class="bo-detail-meta">'+(x.frequency||'Scheduled')+'</div></div><div class="bo-detail-amount">'+money(Math.abs(Number(x.amount||0)))+'</div></div>'}).join(''):'<div class="bo-empty">No active income sources.</div>')+'</div><a class="bo-detail-action" href="/control#income">Manage income</a>';
    } else if(kind.indexOf('forecast-')===0){
      var parts=kind.split('-'),forecastYear=Number(parts[1]),forecastMonth=Number(parts[2]),forecastEnd=calendarMonthEnd(forecastYear,forecastMonth),forecastLabel=new Date(forecastYear,forecastMonth-1,1).toLocaleString([], {month:'long',year:'numeric'});title.textContent=forecastLabel+' ending balance';sub.textContent='Calendar projection';content.innerHTML=forecastEnd==null?'<div class="bo-empty">This calendar projection is still loading.</div>':'<div class="bo-detail-breakdown"><div class="bo-detail-breakdown-row"><span>Projected ending</span><strong>'+money(forecastEnd)+'</strong></div></div><a class="bo-detail-action" href="/?view=calendar">Review calendar</a>';
    } else if(kind==='savings'){
      title.textContent='Savings account';sub.textContent='TD Bank · Savings Account ••••2468';content.innerHTML=savings?'<div class="bo-detail-breakdown"><div class="bo-detail-breakdown-row"><span>Available balance</span><strong>'+bankMoney(savings.balance.available)+'</strong></div><div class="bo-detail-breakdown-row"><span>Bank balance as of</span><strong>'+bankAsOf(savings.bankingAsOf)+'</strong></div></div>':'<div class="bo-empty">Savings balance is temporarily unavailable.</div>';
    } else if(kind==='spending-account'){
      title.textContent='Everyday spending';sub.textContent='TD Bank · Everything Else';content.innerHTML=spending?'<div class="bo-detail-breakdown"><div class="bo-detail-breakdown-row"><span>Available balance</span><strong>'+bankMoney(spending.available)+'</strong></div><div class="bo-detail-breakdown-row"><span>Bank balance as of</span><strong>'+bankAsOf(spending.bankingAsOf)+'</strong></div></div><a class="bo-detail-action" href="/spending/">View everyday spending</a>':'<div class="bo-empty">Everyday Spending balance is temporarily unavailable.</div>';
    } else {
      if(bank){title.textContent='Bills account';sub.textContent='TD Bank · Bill Payments ••••6189';content.innerHTML='<div class="bo-detail-breakdown"><div class="bo-detail-breakdown-row"><span>Available balance</span><strong>'+bankMoney(bank.balance.available)+'</strong></div><div class="bo-detail-breakdown-row"><span>Bank balance as of</span><strong>'+bankAsOf(bank.bankingAsOf)+'</strong></div></div><a class="bo-detail-action" href="/?view=calendar">View cash-flow calendar</a>'}else{title.textContent='Bills account';sub.textContent='Current planning balance';content.innerHTML='<div class="bo-detail-breakdown"><div class="bo-detail-breakdown-row"><span>Current available</span><strong>'+money(c.start||c.end)+'</strong></div><div class="bo-detail-breakdown-row"><span>Projected month end</span><strong>'+money(c.end)+'</strong></div></div><a class="bo-detail-action" href="/?view=calendar">View cash-flow calendar</a>'}
    }
    document.body.classList.add('bo-detail-open');drawer.setAttribute('aria-hidden','false')
  }

  function buildHome(){
    if(location.pathname!=='/'||document.getElementById('boHome'))return;
    var view=new URLSearchParams(location.search).get('view')||'home';if(view==='calendar')return;
    document.body.classList.add('bo-home-active');installDetailDrawer();
    var home=document.createElement('main');home.id='boHome';home.className='bo-home is-active';home.innerHTML='<section class="bo-home-head"><div><h1>'+greeting()+', Ryan</h1><p>Here is what is happening with your cash flow.</p></div><div class="bo-month">'+new Date().toLocaleString([], {month:'long',year:'numeric'})+'</div></section><section class="bo-kpis" id="boHomeKpis"></section><section class="bo-home-grid"><article class="bo-panel"><h2>Upcoming bills</h2><div id="boUpcoming" class="bo-upcoming"><div class="bo-empty">Loading upcoming bills…</div></div></article><aside><article class="bo-panel"><h2>Quick actions</h2><div class="bo-actions"><a class="bo-action" href="/control#bills">＋ Add bill</a><a class="bo-action" href="/control#income">＋ Add income</a><a class="bo-action" href="/control#bills">＋ One-time item</a><a class="bo-action" href="/?view=calendar">Open calendar</a></div></article><article class="bo-panel bo-attention"><h2>Attention</h2><div id="boAttention" class="bo-empty">Checking your month…</div></article></aside></section>';
    document.body.appendChild(home);
    loadBankBalance();
    loadSavingsBalance();
    loadSpendingBalance();
    fetch('/api/bills?home='+Date.now(),{cache:'no-store'}).then(function(r){return r.json()}).then(function(data){
      var upcoming=upcomingBills(data),openUpcoming=upcoming.filter(function(x){return !x.completed}),total=openUpcoming.reduce(function(s,x){return s+x.amount},0),income=(data.income||[]).filter(function(x){return x&&x.active!==false}).reduce(function(s,x){return s+Math.abs(Number(x.amount||0))},0);homeState.data=data;homeState.upcoming=upcoming;
      function renderMetrics(){var c=readCalendarMetrics(),forecast=remainingMonthEnds();homeState.metrics=c;var cards=[['cash','Bills account',c.start||c.end||0,'Available balance','▣'],['savings','Savings account','—','Mortgage funding','◇'],['spending-account','Everyday spending','—','Available balance','◉'],['upcoming','Upcoming (14 days)',openUpcoming.length+' due',money(total)+' remaining','▦'],['income','Income remaining',income,money(income)+' scheduled','♙']],outlook='<article class="bo-kpi bo-outlook-card"><div class="bo-kpi-label">Month-end outlook</div><div class="bo-outlook-values">'+forecast.map(function(x){var ready=x.end!=null,state=!ready?'':x.end<0?' is-negative':x.end<300?' is-low':'',status=!ready?'Loading calendar':x.end<0?'Needs attention':x.end<300?'Low balance':'Projected ending',display=ready?money(x.end):'—';return '<button class="bo-outlook-month'+state+'" type="button" data-bo-detail="forecast-'+x.year+'-'+x.month+'" aria-label="'+x.label+' '+x.year+' ending balance '+display+'. '+status+'"><span>'+x.shortLabel+'</span><strong>'+display+'</strong></button>'}).join('')+'</div><div class="bo-kpi-note">Ending balances through December</div></article>';document.getElementById('boHomeKpis').innerHTML=cards.map(function(x){return '<article class="bo-kpi is-clickable" data-bo-detail="'+x[0]+'" role="button" tabindex="0"><span class="bo-kpi-chevron">›</span><div class="bo-kpi-label">'+x[1]+'</div><div class="bo-kpi-value">'+(typeof x[2]==='number'?money(x[2]):x[2])+'</div><div class="bo-kpi-note">'+x[3]+'</div><div class="bo-kpi-icon">'+x[4]+'</div></article>'}).join('')+outlook;applyBankBalance(homeState.bankBalance);applySavingsBalance(homeState.savingsBalance);applySpendingBalance(homeState.spendingBalance);document.querySelectorAll('[data-bo-detail]').forEach(function(card){card.onclick=function(){openDetail(this.dataset.boDetail)};if(card.tagName!=='BUTTON')card.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(this.dataset.boDetail)}}});var attention=document.getElementById('boAttention');attention.className=c.end<0?'bo-attention-item':'bo-empty';attention.textContent=c.end<0?'Projected month end is below zero. Review the calendar.':'No urgent cash-flow issues detected.'}
      renderMetrics();setTimeout(renderMetrics,1200);setTimeout(renderMetrics,2400);
      document.getElementById('boUpcoming').innerHTML=upcoming.length?upcoming.map(function(x){return upcomingRow(x,false)}).join(''):'<div class="bo-empty">No bills due in the next 14 days.</div>'
    }).catch(function(){document.getElementById('boUpcoming').innerHTML='<div class="bo-empty">Could not load upcoming bills.</div>'})
  }

  function selectControlTab(){if(location.pathname.indexOf('/control')!==0)return;var tab=controlSection();if(typeof window.showTab==='function')window.showTab(tab);syncSidebarActive(tab);document.body.classList.remove('bo-open')}
  window.addEventListener('hashchange',selectControlTab);
  function install(){addFont();addStyles();document.body.classList.add('bo-app');installSidebar();selectControlTab();buildHome()}
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
    html = upsertScript(html, '<script defer src="/amount-balance-hotfix.js?v=20260826fy2027a"></script>');
    html = upsertScript(html, '<script id="billsosCrossDeviceSyncV2" defer src="/billsos-cross-device-sync-v2.js?v=20260930datereset1"></script>');
    html = upsertScript(html, '<script defer src="/billsos-balance-editor.js?v=20260812balanceeditor1"></script>');
  }
  html = upsertScript(html, '<script defer src="/billsos-sidebar-calculator.js?v=20260828rowcollapse1"></script>');
  html = upsertScript(html, '<script defer src="/assistant-ai-bridge.js?v=20260820format1"></script>');
  if (!html.includes('id="billsosAppUi"')) html = html.replace('</body>', appUi + '\n</body>');
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};

module.exports.normalizeBillPaymentsBalance = normalizeBillPaymentsBalance;
module.exports.normalizeSavingsAccountBalance = normalizeSavingsAccountBalance;
module.exports.normalizeEverydaySpendingBalance = normalizeEverydaySpendingBalance;
