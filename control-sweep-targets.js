(function(){
  var RULE_ID='__billsos_system_rules__';
  var MONTHS=['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
  var DEFAULT_LABEL='Sweep to savings / debt';
  var DEFAULT_SWEEP_TARGETS={
    '2026-07':{day:31,amount:705.05,label:DEFAULT_LABEL}
  };

  function money(v){var n=Number(v||0);return n?n.toLocaleString(undefined,{style:'currency',currency:'USD'}):'$0.00'}
  function esc(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
  function monthLabel(value){var d=new Date(value+'-01T12:00:00');return d.toLocaleDateString(undefined,{month:'long',year:'numeric'})}
  function setLocalStatus(text,kind){if(typeof setStatus==='function')setStatus(text,kind||'warn')}
  function stateReady(){return typeof state==='object'&&state&&Array.isArray(state.oneTimeEvents)}

  function normalizeData(data){
    data=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    return {bills:Array.isArray(data.bills)?data.bills:[],oneTimeEvents:Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[],income:Array.isArray(data.income)?data.income:[],updatedAt:data.updatedAt||null};
  }
  function mergeTargets(existing){
    var out=Object.assign({},DEFAULT_SWEEP_TARGETS);
    existing=existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{};
    Object.keys(existing).forEach(function(k){out[k]=existing[k];});
    return out;
  }
  function rulesFromData(data){
    data=normalizeData(data);
    var row=data.oneTimeEvents.find(function(x){return x&&x.id===RULE_ID;});
    var rules={};
    if(row&&row.notes){try{rules=JSON.parse(row.notes)||{};}catch(e){rules={};}}
    rules.sweep=rules.sweep&&typeof rules.sweep==='object'?rules.sweep:{};
    rules.sweep.enabled=rules.sweep.enabled!==false;
    rules.sweep.targets=mergeTargets(rules.sweep.targets);
    return rules;
  }
  function ensureRulesRowIn(data,rules){
    data=normalizeData(data);
    var row=data.oneTimeEvents.find(function(x){return x&&x.id===RULE_ID;});
    if(!row){row={id:RULE_ID,name:'BillsOS system rules',date:'2099-12-31',amount:0,type:'transfer',notes:'{}'};data.oneTimeEvents.push(row);}
    row.name='BillsOS system rules';
    row.date='2099-12-31';
    row.amount=0;
    row.type='transfer';
    row.notes=JSON.stringify(rules);
    return data;
  }
  function currentData(){
    if(stateReady())return {bills:state.bills,oneTimeEvents:state.oneTimeEvents,income:state.income,updatedAt:state.updatedAt||null};
    return {bills:[],oneTimeEvents:[],income:[],updatedAt:null};
  }
  function getRules(){return rulesFromData(currentData())}
  function setRules(rules){
    if(!stateReady())return;
    var data=ensureRulesRowIn(currentData(),rules);
    state.bills=data.bills;
    state.oneTimeEvents=data.oneTimeEvents;
    state.income=data.income;
  }
  async function fetchServerData(){
    var r=await fetch('/api/bills?sweepRead='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return normalizeData(await r.json());
  }
  async function persistRules(rules){
    var data=stateReady()?currentData():await fetchServerData();
    data=ensureRulesRowIn(data,rules);
    if(stateReady()){
      state.bills=data.bills;
      state.oneTimeEvents=data.oneTimeEvents;
      state.income=data.income;
    }
    var r=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var saved=normalizeData(await r.json());
    if(stateReady()){
      state.bills=saved.bills;
      state.oneTimeEvents=saved.oneTimeEvents;
      state.income=saved.income;
      state.updatedAt=saved.updatedAt||new Date().toISOString();
    }
    return saved;
  }
  async function ensureSweepTargets(){
    try{
      var data=await fetchServerData();
      var rules=rulesFromData(data),targets=mergeTargets(rules.sweep.targets);
      if(JSON.stringify(rules.sweep.targets||{})===JSON.stringify(targets))return;
      rules.sweep.targets=targets;
      rules.sweep.enabled=rules.sweep.enabled!==false;
      await persistRules(rules);
    }catch(e){}
  }

  function addStyles(){
    if(document.getElementById('sweepControlStyles'))return;
    var s=document.createElement('style');
    s.id='sweepControlStyles';
    s.textContent='.sweep-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sweep-table input{min-width:90px}.sweep-table input[data-field="label"]{min-width:220px}.sweep-bulk{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:120px}.pill.sweep{background:#f1e8ff;color:#5b21b6}.sweep-note{margin:9px 0 0;color:var(--mut);font-size:13px}.sweep-total{font-weight:850;color:#5b21b6}';
    document.head.appendChild(s);
  }
  function addTab(){
    if(document.querySelector('[data-tab="sweeps"]'))return;
    addStyles();
    var tabs=document.querySelector('.tabs'),backup=document.querySelector('[data-tab="backup"]');
    if(!tabs)return;
    var b=document.createElement('button');
    b.className='tab';
    b.dataset.tab='sweeps';
    b.textContent='Sweeps';
    b.onclick=function(){showTab('sweeps');renderSweepEditor();};
    tabs.insertBefore(b,backup||null);
    var p=document.createElement('section');
    p.id='panel-sweeps';
    p.className='panel';
    p.innerHTML='<div class="card"><div class="cardhead"><div><h2>Sweep plan</h2><p class="mut" style="margin:4px 0 0">Create or edit projected sweep transfers by month. These flow into the calendar math.</p></div><span class="pill sweep">Purple in calendar</span></div><div class="sweep-toolbar"><button class="btn primary" type="button" id="addSweepRow">Add sweep</button><button class="btn" type="button" id="saveSweepRows">Save sweep plan</button><button class="btn" type="button" id="refreshSweepRows">Refresh</button></div><div id="sweepRows" style="margin-top:12px"></div><p class="sweep-note">Use one row per month. Saving here writes directly to the calendar data source.</p></div><div class="card"><div class="cardhead"><h2>Bulk edit</h2><button class="btn small" type="button" id="applySweepBulk">Apply bulk rows</button></div><p class="mut" style="margin:0 0 8px">Paste rows as <b>month, day, amount, label</b>. Example: <code>2026-08, 30, 500, Sweep to savings / debt</code></p><textarea id="sweepBulk" class="sweep-bulk" placeholder="2026-07, 31, 705.05, Sweep to savings / debt&#10;2026-08, 30, 500, Sweep to savings / debt"></textarea></div>';
    tabs.parentNode.insertBefore(p,document.getElementById('panel-backup'));
    p.querySelector('#addSweepRow').onclick=function(){addSweepInputRow();};
    p.querySelector('#saveSweepRows').onclick=function(){saveSweepRows(true);};
    p.querySelector('#refreshSweepRows').onclick=renderSweepEditor;
    p.querySelector('#applySweepBulk').onclick=applyBulkRows;
  }
  function sweepRowsFromRules(){
    var rules=getRules(),targets=rules.sweep.targets||{};
    return Object.keys(targets).sort().map(function(month){var t=targets[month]||{};return {month:month,day:Number(t.day||28),amount:Number(t.amount||0),label:t.label||DEFAULT_LABEL};});
  }
  function renderSweepEditor(){
    var host=document.getElementById('sweepRows');
    if(!host||!stateReady())return;
    var rows=sweepRowsFromRules();
    if(!rows.length)rows=[{month:MONTHS[1],day:31,amount:0,label:DEFAULT_LABEL}];
    var total=rows.reduce(function(s,r){return s+Math.abs(Number(r.amount||0));},0);
    host.innerHTML='<div class="tablewrap"><table class="sweep-table"><thead><tr><th>Month</th><th>Day</th><th>Amount</th><th>Label</th><th>Actions</th></tr></thead><tbody>'+rows.map(rowHtml).join('')+'</tbody></table></div><div class="sweep-note">Planned sweeps: <span class="sweep-total">'+money(total)+'</span></div>';
    host.querySelectorAll('[data-delete-sweep]').forEach(function(btn){btn.onclick=function(){btn.closest('tr').remove();saveSweepRows(false);};});
  }
  function rowHtml(row){
    var monthOptions=MONTHS.map(function(m){return '<option value="'+esc(m)+'" '+(m===row.month?'selected':'')+'>'+esc(monthLabel(m))+'</option>';}).join('');
    return '<tr><td><select data-field="month">'+monthOptions+'</select></td><td><input data-field="day" type="number" min="1" max="31" value="'+esc(row.day||28)+'"></td><td><input data-field="amount" type="number" step="0.01" value="'+esc(row.amount||0)+'"></td><td><input data-field="label" value="'+esc(row.label||DEFAULT_LABEL)+'"></td><td><button class="btn small danger" type="button" data-delete-sweep>Delete</button></td></tr>';
  }
  function addSweepInputRow(){
    var body=document.querySelector('#sweepRows tbody');
    if(!body){renderSweepEditor();body=document.querySelector('#sweepRows tbody');}
    var used={};
    document.querySelectorAll('#sweepRows [data-field="month"]').forEach(function(el){used[el.value]=1;});
    var month=MONTHS.find(function(m){return !used[m];})||MONTHS[MONTHS.length-1];
    body.insertAdjacentHTML('beforeend',rowHtml({month:month,day:28,amount:0,label:DEFAULT_LABEL}));
    body.querySelectorAll('[data-delete-sweep]').forEach(function(btn){btn.onclick=function(){btn.closest('tr').remove();saveSweepRows(false);};});
  }
  function collectTableRows(){
    return Array.from(document.querySelectorAll('#sweepRows tbody tr')).map(function(tr){
      return {month:(tr.querySelector('[data-field="month"]')||{}).value,day:Number((tr.querySelector('[data-field="day"]')||{}).value||0),amount:Number((tr.querySelector('[data-field="amount"]')||{}).value||0),label:((tr.querySelector('[data-field="label"]')||{}).value||DEFAULT_LABEL).trim()};
    }).filter(function(r){return /^20\d{2}-\d{2}$/.test(r.month)&&r.day>=1&&r.day<=31&&Number.isFinite(r.amount)&&r.amount>0;});
  }
  async function saveSweepRows(persist){
    var rows=collectTableRows(),targets={};
    rows.forEach(function(r){targets[r.month]={day:Math.round(r.day),amount:Math.abs(Number(r.amount)),label:r.label||DEFAULT_LABEL};});
    var rules=getRules();
    rules.sweep=rules.sweep&&typeof rules.sweep==='object'?rules.sweep:{};
    rules.sweep.enabled=true;
    rules.sweep.targets=targets;
    setRules(rules);
    if(typeof renderAll==='function')renderAll();
    renderSweepEditor();
    if(!persist){setLocalStatus('Sweep plan updated on screen. Save sweep plan to store it.','warn');return;}
    try{
      setLocalStatus('Saving sweep plan to calendar data…','warn');
      await persistRules(rules);
      if(typeof renderAll==='function')renderAll();
      renderSweepEditor();
      setLocalStatus('Sweep plan saved. Reload the dashboard calendar to see updated purple sweep rows.','ok');
    }catch(e){setLocalStatus('Sweep save failed. Calendar data was not changed.','warn');}
  }
  function parseBulkLine(line){
    var parts=line.split(',');
    if(parts.length<3)parts=line.split(/\t+/);
    if(parts.length<3)parts=line.trim().split(/\s+/);
    var month=(parts.shift()||'').trim(),day=Number((parts.shift()||'').trim()),amount=Number(String(parts.shift()||'').replace(/[$,]/g,'').trim()),label=(parts.join(',').trim()||DEFAULT_LABEL);
    if(!/^20\d{2}-\d{2}$/.test(month)||!day||!amount)return null;
    return {month:month,day:Math.max(1,Math.min(31,Math.round(day))),amount:Math.abs(amount),label:label};
  }
  function applyBulkRows(){
    var box=document.getElementById('sweepBulk'),lines=(box&&box.value||'').split(/\n+/),rows=[];
    lines.forEach(function(line){line=line.trim();if(!line)return;var parsed=parseBulkLine(line);if(parsed)rows.push(parsed);});
    if(!rows.length){setLocalStatus('No valid sweep rows found. Use month, day, amount, label.','warn');return;}
    var targets={};
    rows.forEach(function(r){targets[r.month]={day:r.day,amount:r.amount,label:r.label};});
    var rules=getRules();
    rules.sweep=rules.sweep&&typeof rules.sweep==='object'?rules.sweep:{};
    rules.sweep.enabled=true;
    rules.sweep.targets=targets;
    setRules(rules);
    if(typeof renderAll==='function')renderAll();
    renderSweepEditor();
    setLocalStatus(rows.length+' sweep row(s) applied. Click Save sweep plan to store them in calendar data.','warn');
  }

  function boot(){addTab();ensureSweepTargets().then(function(){setTimeout(function(){if(document.querySelector('[data-tab="sweeps"].active'))renderSweepEditor();},400);});}
  var oldShow=window.showTab;
  if(typeof oldShow==='function')window.showTab=function(id){oldShow(id);if(id==='sweeps')setTimeout(renderSweepEditor,0)};
  var oldRender=window.renderAll;
  if(typeof oldRender==='function')window.renderAll=function(){oldRender();setTimeout(function(){if(document.querySelector('[data-tab="sweeps"].active'))renderSweepEditor();},0)};
  window.BillsOSSweepEditor={render:renderSweepEditor,save:function(){return saveSweepRows(true)}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();