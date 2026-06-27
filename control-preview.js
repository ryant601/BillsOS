(function(){
  var previewData=null;
  var RULE_ID='__billsos_system_rules__';
  function money(v){var n=Number(v||0);return n?n.toLocaleString(undefined,{style:'currency',currency:'USD'}):'$0.00'}
  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function localData(){try{return typeof state!=='undefined'&&state?state:{bills:[],oneTimeEvents:[],income:[]};}catch(e){return {bills:[],oneTimeEvents:[],income:[]};}}
  async function getData(){
    try{
      var r=await fetch('/api/bills?preview='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json();
      previewData={bills:Array.isArray(data.bills)?data.bills:[],oneTimeEvents:Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[],income:Array.isArray(data.income)?data.income:[],updatedAt:data.updatedAt||null};
      return previewData;
    }catch(e){
      return previewData||localData();
    }
  }
  function defaultRules(){return {spendingFunding:{enabled:true,amount:1500,count:2,timing:'after-income'},sweep:{enabled:true,preferredBuffer:1250,hardBuffer:1000,day:28,label:'Sweep transfer',startingBalance:0}};}
  function mergeRules(r){var d=defaultRules();r=r&&typeof r==='object'?r:{};d.spendingFunding=Object.assign(d.spendingFunding,r.spendingFunding||{});d.sweep=Object.assign(d.sweep,r.sweep||{});return d;}
  function rulesFromData(data){try{var row=(data.oneTimeEvents||[]).find(function(x){return x.id===RULE_ID;});return mergeRules(row&&row.notes?JSON.parse(row.notes):null);}catch(e){return mergeRules(null);}}
  function css(){
    if(document.getElementById('previewCss'))return;
    var s=document.createElement('style');
    s.id='previewCss';
    s.textContent=' .preview-controls{display:grid;grid-template-columns:220px auto;gap:10px;align-items:end}.preview-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.preview-kpi{background:#f8fafc;border:1px solid rgba(20,35,55,.12);border-radius:14px;padding:11px}.preview-kpi span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#556372;font-weight:850}.preview-kpi b{display:block;margin-top:3px;font-size:20px}.preview-list{display:grid;gap:8px}.preview-day{border:1px solid rgba(20,35,55,.12);border-radius:14px;background:#fff;padding:10px}.preview-day h3{margin:0 0 7px;font-size:14px}.preview-item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-top:1px solid rgba(20,35,55,.08)}.preview-item:first-of-type{border-top:0}.preview-item .name{font-weight:750}.preview-item .meta{font-size:12px;color:#556372}.preview-item.income .amt{color:#0a7d44}.preview-item.out .amt{color:#b8362c}.preview-item.system .name:after{content:" · generated";font-size:11px;color:#556372;font-weight:700}.preview-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.preview-cell{min-height:90px;border:1px solid rgba(20,35,55,.1);border-radius:12px;background:#fff;padding:7px;overflow:hidden}.preview-cell.blank{background:transparent;border:0}.preview-cell .num{font-size:11px;font-weight:850;color:#556372;margin-bottom:4px}.preview-chip{font-size:11px;line-height:1.2;margin:3px 0;padding:4px 5px;border-radius:7px;background:#eef2f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-chip.income{background:#e7f7ee;color:#0a7d44}.preview-chip.out{background:#feecec;color:#8a1f18}.preview-chip.system{outline:1px dashed rgba(20,35,55,.25)}.preview-note{margin:10px 0 0;color:#556372;font-size:12px}@media(max-width:850px){.preview-controls,.preview-summary{grid-template-columns:1fr}.preview-calendar{display:none}}';
    document.head.appendChild(s);
  }
  function addTab(){
    if(document.querySelector('[data-tab="preview"]'))return;
    css();
    var tabs=document.querySelector('.tabs');
    var backup=document.querySelector('[data-tab="backup"]');
    var btn=document.createElement('button');
    btn.className='tab';
    btn.dataset.tab='preview';
    btn.textContent='Preview Calendar';
    btn.onclick=function(){showTab('preview');renderPreview();};
    tabs.insertBefore(btn,backup);
    var panel=document.createElement('section');
    panel.id='panel-preview';
    panel.className='panel';
    panel.innerHTML='<div class="card"><div class="cardhead"><div><h2>Generated preview</h2><p class="mut" style="margin:4px 0 0">This uses saved control data and generated rules. It does not change the live dashboard.</p></div><button class="btn small" onclick="renderPreview()">Refresh preview</button></div><div class="preview-controls"><div><label>Preview month</label><input id="previewMonth" type="month"></div><div class="mut">Recurring bills, income, one-time items, spending fundings, and sweep rules appear here.</div></div><div id="previewOutput"></div></div>';
    tabs.parentNode.insertBefore(panel,document.getElementById('panel-backup'));
    var pm=panel.querySelector('#previewMonth');
    var d=new Date();
    pm.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    pm.addEventListener('change',renderPreview);
    loadRulesScript();
  }
  function loadRulesScript(){if(document.getElementById('rulesScript'))return;var s=document.createElement('script');s.id='rulesScript';s.defer=true;s.src='/control-rules.js?v=20260626rules1';document.body.appendChild(s);}
  function dateKey(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
  function daysInMonth(y,m){return new Date(y,m,0).getDate()}
  function itemTypeLabel(t){return ({'credit-card':'Credit card',bill:'Bill',loan:'Loan',utility:'Utility',subscription:'Subscription',transfer:'Transfer',income:'Income',spending:'Spending'}[t]||t||'Item')}
  function addIncomePreview(i,dim,push){
    if(i.active===false)return;
    var amt=Math.abs(Number(i.amount||0));
    var name=i.name||'Income';
    var schedule=i.schedule||'manual';
    if(schedule==='semi-monthly-15-30'){
      push(Math.min(15,dim),{name:name,amount:amt,kind:'income',type:'Income · 15th',source:'income'});
      push(Math.min(30,dim),{name:name,amount:amt,kind:'income',type:'Income · 30th',source:'income'});
    }else if(schedule==='monthly'){
      push(1,{name:name,amount:amt,kind:'income',type:'Income · monthly placeholder',source:'income'});
    }else if(schedule==='biweekly'){
      push(1,{name:name,amount:amt,kind:'income',type:'Income · biweekly placeholder 1',source:'income'});
      push(Math.min(15,dim),{name:name,amount:amt,kind:'income',type:'Income · biweekly placeholder 2',source:'income'});
      if(dim>=29)push(29,{name:name,amount:amt,kind:'income',type:'Income · possible third biweekly check',source:'income'});
    }else{
      push(1,{name:name,amount:amt,kind:'income',type:'Income · manual placeholder',source:'income'});
    }
  }
  function addGeneratedRules(rules,dim,all,push){
    var spend=rules.spendingFunding||{};
    if(spend.enabled!==false&&Number(spend.amount||0)>0&&Number(spend.count||0)>0){
      var incomeDays=all.filter(function(x){return x.amount>0}).map(function(x){return x.day;}).sort(function(a,b){return a-b;});
      for(var i=0;i<Number(spend.count||0);i++){
        var base=spend.timing==='fixed-1-15'?(i===0?1:15):(incomeDays[i]||[1,15,29][i]||1);
        var day=Math.min(dim,Math.max(1,base+(spend.timing==='after-income'?1:0)));
        push(day,{name:'Spending account funding',amount:-Math.abs(Number(spend.amount||0)),kind:'out system',type:'Generated · spending funding',source:'rule'});
      }
    }
    var sweep=rules.sweep||{};
    if(sweep.enabled!==false){
      var income=all.filter(function(x){return x.amount>0}).reduce(function(s,x){return s+x.amount},0);
      var outgo=all.filter(function(x){return x.amount<0}).reduce(function(s,x){return s+Math.abs(x.amount)},0);
      var available=Number(sweep.startingBalance||0)+income-outgo-Number(sweep.preferredBuffer||0);
      if(available>0){push(Math.min(dim,Math.max(1,Number(sweep.day||28))),{name:sweep.label||'Sweep transfer',amount:-Math.round(available*100)/100,kind:'out system',type:'Generated · sweep above buffer',source:'rule'});}
    }
  }
  window.renderPreview=async function(){
    var out=document.getElementById('previewOutput');
    if(!out)return;
    out.innerHTML='<div class="empty">Loading preview data…</div>';
    var data=await getData();
    var rules=rulesFromData(data);
    var val=(document.getElementById('previewMonth')||{}).value;
    if(!val){out.innerHTML='<div class="empty">Choose a month.</div>';return;}
    var parts=val.split('-');var y=Number(parts[0]);var m=Number(parts[1]);var dim=daysInMonth(y,m);var byDay={};var all=[];
    function push(day,obj){if(day<1||day>dim)return;var key=dateKey(y,m,day);(byDay[key]||(byDay[key]=[])).push(obj);all.push(Object.assign({date:key,day:day},obj));}
    (data.bills||[]).forEach(function(b){
      if(b.active===false)return;
      if(b.frequency&&b.frequency!=='monthly')return;
      if(b.startMonth&&b.startMonth>val)return;
      if(b.endMonth&&b.endMonth<val)return;
      var day=Math.min(Number(b.dueDay||1),dim);
      push(day,{name:b.name||'Bill',amount:-Math.abs(Number(b.amount||0)),kind:'out',type:itemTypeLabel(b.type),source:'bill'});
    });
    (data.oneTimeEvents||[]).forEach(function(o){
      if(o.id===RULE_ID)return;
      if(!o.date||o.date.slice(0,7)!==val)return;
      var d=Number(o.date.slice(8,10));
      var amt=Number(o.amount||0);var kind=o.type==='income'?'income':'out';
      push(d,{name:o.name||'One-time item',amount:kind==='income'?Math.abs(amt):-Math.abs(amt),kind:kind,type:itemTypeLabel(o.type),source:'one'});
    });
    (data.income||[]).forEach(function(i){addIncomePreview(i,dim,push);});
    addGeneratedRules(rules,dim,all,push);
    all.sort(function(a,b){return a.date.localeCompare(b.date)||b.amount-a.amount});
    var income=all.filter(function(x){return x.amount>0}).reduce(function(s,x){return s+x.amount},0);var outgo=all.filter(function(x){return x.amount<0}).reduce(function(s,x){return s+Math.abs(x.amount)},0);var net=income-outgo;
    var dataCount=(data.bills||[]).length+(data.oneTimeEvents||[]).filter(function(x){return x.id!==RULE_ID}).length+(data.income||[]).length;
    var html='<div class="preview-note">Loaded '+dataCount+' saved control rows · Rules: spending funding '+(rules.spendingFunding.enabled!==false?'on':'off')+', sweep '+(rules.sweep.enabled!==false?'on':'off')+(data.updatedAt?' · saved '+new Date(data.updatedAt).toLocaleString():'')+'</div>';
    html+='<div class="preview-summary"><div class="preview-kpi"><span>Money in</span><b>'+money(income)+'</b></div><div class="preview-kpi"><span>Money out</span><b>'+money(outgo)+'</b></div><div class="preview-kpi"><span>Net</span><b>'+money(net)+'</b></div><div class="preview-kpi"><span>Items</span><b>'+all.length+'</b></div></div>';
    var first=new Date(y,m-1,1).getDay();html+='<div class="preview-calendar">';for(var b=0;b<first;b++)html+='<div class="preview-cell blank"></div>';for(var d=1;d<=dim;d++){var key=dateKey(y,m,d);html+='<div class="preview-cell"><div class="num">'+d+'</div>'+((byDay[key]||[]).slice(0,4).map(function(x){return '<div class="preview-chip '+x.kind+'">'+esc(x.name)+' · '+money(Math.abs(x.amount))+'</div>'}).join(''))+'</div>';}html+='</div>';
    html+='<div class="card" style="box-shadow:none;margin-top:12px"><div class="cardhead"><h2>Preview item list</h2><span class="mut">'+all.length+' generated items</span></div>';
    if(!all.length)html+='<div class="empty">No generated items for this month. Saved rows loaded: '+dataCount+'. Check active status, frequency, date/month, and due day.</div>';else html+='<div class="preview-list">'+all.map(function(x){return '<div class="preview-day preview-item '+x.kind+'"><div><div class="name">'+esc(x.name)+'</div><div class="meta">'+esc(x.date)+' · '+esc(x.type)+'</div></div><div class="amt"><b>'+money(Math.abs(x.amount))+'</b></div></div>'}).join('')+'</div>';
    html+='</div>';out.innerHTML=html;
  };
  var oldShow=window.showTab;
  window.showTab=function(id){oldShow(id);if(id==='preview')setTimeout(renderPreview,0);};
  var oldRender=window.renderAll;
  if(typeof oldRender==='function')window.renderAll=function(){oldRender();setTimeout(function(){var active=document.querySelector('[data-tab="preview"].active');if(active)renderPreview();},0);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addTab);else addTab();
})();
