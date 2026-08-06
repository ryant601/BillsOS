(function(){
  'use strict';
  if(window.__billsosAssistantReview)return;
  window.__billsosAssistantReview=true;

  var suggestion=null;
  var parsedEmail=null;
  var today=new Date();
  var todayIso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
  var currentMonth=todayIso.slice(0,7);

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'})}
  function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
  function monthAdd(ym,n){var p=ym.split('-'),d=new Date(Number(p[0]),Number(p[1])-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function previousMonth(ym){return monthAdd(ym,-1)}
  function normalize(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function words(s){return normalize(s).split(/\s+/).filter(function(x){return x.length>1})}
  function overlap(a,b){var aw=words(a),bw=words(b);if(!aw.length||!bw.length)return 0;var hits=aw.filter(function(x){return bw.indexOf(x)>=0}).length;return hits/Math.max(aw.length,bw.length)}
  function extractAmounts(text){var out=[],re=/\$\s*([0-9][0-9,]*(?:\.\d{2})?)/g,m;while((m=re.exec(text)))out.push(Number(m[1].replace(/,/g,'')));return out.filter(function(n){return isFinite(n)&&n>0})}
  function extractDates(text){var out=[],m;var iso=/\b(20\d{2}-\d{2}-\d{2})\b/g;while((m=iso.exec(text)))out.push(m[1]);var us=/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g;while((m=us.exec(text)))out.push(m[3]+'-'+String(m[1]).padStart(2,'0')+'-'+String(m[2]).padStart(2,'0'));return out}
  function merchantFrom(text){
    var patterns=[/final payment received for\s+([^\n.!]+)/i,/purchase at\s+([^\n.!]+)/i,/payment plan (?:at|for)\s+([^\n.!]+)/i,/for your purchase at\s+([^\n.!]+)/i,/merchant\s*[:\-]\s*([^\n]+)/i];
    for(var i=0;i<patterns.length;i++){var m=text.match(patterns[i]);if(m)return m[1].trim()}
    var subject=(text.split(/\n/)[0]||'').replace(/^(subject\s*:\s*)/i,'').trim();
    return subject.replace(/^(final payment received for|payment completed for|payment plan completed for)\s+/i,'').trim();
  }
  function parseEmail(text){
    var clean=String(text||'').trim(),lower=clean.toLowerCase(),status='unknown',action='review',skipCount=0;
    if(/plan is now complete|payment plan is completed|final payment received|plan (?:has been )?completed|paid in full/.test(lower)){status='completed';action='removeFuture'}
    var paidAhead=lower.match(/paid\s+(?:ahead|in advance)(?:\s+by)?\s*(\d+)\s*(?:months?|payments?)/)||lower.match(/(\d+)\s*(?:months?|payments?)\s*(?:ahead|in advance)/);
    if(paidAhead){status='paid-ahead';action='skipN';skipCount=Math.max(1,Number(paidAhead[1]||1))}
    var amounts=extractAmounts(clean),dates=extractDates(clean),merchant=merchantFrom(clean);
    return {merchant:merchant||'',status:status,action:action,skipCount:skipCount,amount:amounts.length?amounts[0]:null,amounts:amounts,dates:dates,raw:clean};
  }
  function billCandidates(parsed){
    var bills=(window.state&&Array.isArray(state.bills)?state.bills:[]).filter(function(b){return b&&b.active!==false});
    return bills.map(function(b){
      var nameScore=Math.max(overlap(parsed.merchant,b.name),overlap(parsed.raw,b.name));
      var amount=Number(b.amount||0),amountScore=parsed.amount&&amount?Math.max(0,1-Math.abs(Math.abs(amount)-parsed.amount)/Math.max(parsed.amount,Math.abs(amount),1)):0;
      var score=nameScore*.72+amountScore*.28;
      return {bill:b,score:score,nameScore:nameScore,amountScore:amountScore};
    }).filter(function(x){return x.score>=.38||x.nameScore>=.5}).sort(function(a,b){return b.score-a.score})
  }
  function futureEntries(bill,count){
    var rows=[],month=currentMonth,limit=count||12;
    for(var i=0;i<18&&rows.length<limit;i++){
      var ym=monthAdd(month,i);
      if(bill.startMonth&&ym<bill.startMonth)continue;
      if(bill.endMonth&&ym>bill.endMonth)break;
      var day=Math.max(1,Math.min(31,Number(bill.dueDay||1)));
      var dt=new Date(Number(ym.slice(0,4)),Number(ym.slice(5,7)),0).getDate();
      var date=ym+'-'+String(Math.min(day,dt)).padStart(2,'0');
      if(date>=todayIso)rows.push({date:date,name:bill.name,amount:Math.abs(Number(bill.amount||0))})
    }
    return rows;
  }
  function buildSuggestion(parsed){
    var candidates=billCandidates(parsed),best=candidates[0];
    if(!best)return {parsed:parsed,match:null,entries:[],action:parsed.action,impact:0,confidence:'No confident match'};
    var count=parsed.action==='skipN'?parsed.skipCount:12,entries=futureEntries(best.bill,count),impact=entries.reduce(function(s,x){return s+x.amount},0);
    return {parsed:parsed,match:best.bill,score:best.score,entries:entries,action:parsed.action,impact:impact,confidence:best.score>=.75?'High':best.score>=.55?'Medium':'Low'};
  }
  function addCss(){
    if(document.getElementById('assistantReviewCss'))return;
    var s=document.createElement('style');s.id='assistantReviewCss';s.textContent='\
      .ar-intro{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.ar-safe{font-size:12px;color:var(--mut);max-width:62ch}.ar-input{min-height:190px!important}.ar-result{display:grid;gap:12px}.ar-suggestion{border:1px solid rgba(47,112,72,.2);border-radius:16px;padding:16px;background:linear-gradient(135deg,#fbfdf9,#f1f7ef)}.ar-head{display:flex;justify-content:space-between;gap:14px}.ar-badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:#e7f1e7;color:#2f7048;font-size:11px;font-weight:800}.ar-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.ar-stat{padding:11px;border:1px solid var(--line);border-radius:12px;background:#fff}.ar-stat span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);font-weight:800}.ar-stat b{display:block;margin-top:4px}.ar-entries{display:grid;gap:7px}.ar-entry{display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:10px;padding:10px;border:1px solid var(--line);border-radius:11px;background:#fff}.ar-impact{font-weight:800;color:#2f7048}.ar-warning{padding:11px;border-radius:11px;background:#fff7e7;color:#795100;font-size:12px}.ar-audit{display:grid;gap:7px}.ar-audit-row{padding:10px;border:1px solid var(--line);border-radius:11px;background:#fff;font-size:12px}.ar-approved{color:#2f7048;font-weight:800}.ar-dismissed{color:var(--mut);font-weight:800}@media(max-width:760px){.ar-grid{grid-template-columns:1fr 1fr}.ar-entry{grid-template-columns:80px minmax(0,1fr) auto}.ar-head{display:block}}';document.head.appendChild(s)
  }
  function auditRows(){return (state.oneTimeEvents||[]).filter(function(x){return x&&String(x.id||'').indexOf('__billsos_assistant_audit__')===0}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))})}
  function renderAudit(){var host=document.getElementById('arAudit');if(!host)return;var rows=auditRows();host.innerHTML=rows.length?rows.map(function(x){return '<div class="ar-audit-row"><span class="ar-approved">Approved</span> · '+esc(x.date||'')+' · '+esc(x.name||'Assistant action')+'<div class="mut">'+esc(x.notes||'')+'</div></div>'}).join(''):'<div class="empty">No Assistant Review actions have been approved yet.</div>'}
  function renderSuggestion(){
    var host=document.getElementById('arResult');if(!host)return;
    if(!suggestion){host.innerHTML='<div class="empty">Paste an email and choose Review email. Nothing changes until you approve a suggestion.</div>';return}
    var p=suggestion.parsed,m=suggestion.match,action=suggestion.action==='removeFuture'?'Remove future calendar entries':suggestion.action==='skipN'?'Skip next '+p.skipCount+' payment'+(p.skipCount===1?'':'s'):'No action identified';
    if(!m){host.innerHTML='<div class="ar-suggestion"><div class="ar-head"><div><span class="ar-badge">Pending review</span><h3>No confident calendar match</h3></div></div><p class="mut">Parsed merchant: <b>'+esc(p.merchant||'Unknown')+'</b> · Status: <b>'+esc(p.status)+'</b> · Amount: <b>'+(p.amount?money(p.amount):'Not found')+'</b></p><div class="ar-warning">No changes can be approved until BillsOS finds a matching active bill.</div><div class="actions"><button class="btn" id="arDismiss">Dismiss</button></div></div>';document.getElementById('arDismiss').onclick=dismiss;return}
    host.innerHTML='<div class="ar-suggestion"><div class="ar-head"><div><span class="ar-badge">Pending suggestion</span><h3 style="margin:8px 0 2px">'+esc(action)+'</h3><div class="mut">Matched to <b>'+esc(m.name)+'</b> with '+esc(suggestion.confidence.toLowerCase())+' confidence.</div></div><div class="ar-impact">+'+money(suggestion.impact)+' projected cash</div></div><div class="ar-grid"><div class="ar-stat"><span>Merchant</span><b>'+esc(p.merchant||'Unknown')+'</b></div><div class="ar-stat"><span>Email status</span><b>'+esc(p.status)+'</b></div><div class="ar-stat"><span>Email amount</span><b>'+(p.amount?money(p.amount):'Not found')+'</b></div><div class="ar-stat"><span>Matched bill</span><b>'+esc(m.name)+' · '+money(Math.abs(Number(m.amount||0)))+'</b></div></div><h4>Matched future entries</h4><div class="ar-entries">'+(suggestion.entries.length?suggestion.entries.map(function(x){return '<div class="ar-entry"><b>'+esc(x.date)+'</b><span>'+esc(x.name)+'</span><b>'+money(x.amount)+'</b></div>'}).join(''):'<div class="empty">No future entries were found.</div>')+'</div><div class="ar-warning" style="margin-top:12px">Safety check: past months will not be changed. This suggestion is pending and requires explicit approval.</div><div class="actions"><button class="btn primary" id="arApprove" '+(!suggestion.entries.length?'disabled':'')+'>Approve suggestion</button><button class="btn" id="arDismiss">Dismiss</button></div></div>';
    var approve=document.getElementById('arApprove');if(approve)approve.onclick=approveSuggestion;document.getElementById('arDismiss').onclick=dismiss
  }
  function dismiss(){suggestion=null;parsedEmail=null;renderSuggestion();var status=document.getElementById('arStatus');if(status)status.textContent='Suggestion dismissed. No calendar data changed.'}
  async function approveSuggestion(){
    if(!suggestion||!suggestion.match||!suggestion.entries.length)return;
    if(!confirm('Approve this Assistant Review suggestion? Past months will remain unchanged.'))return;
    var bill=state.bills.find(function(b){return String(b.id)===String(suggestion.match.id)});if(!bill)return;
    var notes=[];
    if(suggestion.action==='removeFuture'){
      bill.endMonth=previousMonth(currentMonth);
      bill.active=false;
      notes.push('Removed future entries for '+bill.name+' beginning '+currentMonth+'.');
    }else if(suggestion.action==='skipN'){
      suggestion.entries.slice(0,suggestion.parsed.skipCount).forEach(function(entry){state.oneTimeEvents.push({id:uid('assistant-skip'),name:'Payment-plan skip credit · '+bill.name,date:entry.date,amount:entry.amount,type:'adjustment',notes:'Assistant-approved offset for paid-ahead payment. Original bill remains visible for auditability.'})});
      notes.push('Created '+suggestion.parsed.skipCount+' explicit payment-skip offset(s) for '+bill.name+'.');
    }
    state.oneTimeEvents.push({id:'__billsos_assistant_audit__'+Date.now(),name:'Assistant Review · '+bill.name,date:todayIso,amount:0,type:'audit',notes:notes.join(' ')+' Source parsed as '+suggestion.parsed.status+'; merchant '+(suggestion.parsed.merchant||'unknown')+'; email amount '+(suggestion.parsed.amount?money(suggestion.parsed.amount):'not found')+'. Explicitly approved by user.'});
    if(typeof renderAll==='function')renderAll();
    var r=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
    if(!r.ok){alert('The suggestion could not be saved. No server confirmation was received.');return}
    var data=await r.json();state.updatedAt=data.updatedAt||new Date().toISOString();
    var status=document.getElementById('arStatus');if(status)status.textContent='Approved and saved. Projections will recalculate from the updated calendar data.';
    suggestion=null;renderSuggestion();renderAudit();
  }
  function review(){
    var input=document.getElementById('arEmail'),status=document.getElementById('arStatus');
    if(!input||!input.value.trim()){status.textContent='Paste a payment-plan email first.';return}
    parsedEmail=parseEmail(input.value);suggestion=buildSuggestion(parsedEmail);status.textContent='Email reviewed. Check the pending suggestion below; nothing has been applied.';renderSuggestion()
  }
  function install(){
    if(location.pathname.indexOf('/control')!==0||document.getElementById('panel-assistantReview'))return;
    addCss();var tabs=document.querySelector('.tabs'),backup=document.querySelector('[data-tab="backup"]');if(!tabs)return;
    var tab=document.createElement('button');tab.className='tab';tab.dataset.tab='assistantReview';tab.textContent='Assistant Review';tab.onclick=function(){showTab('assistantReview');renderAudit()};tabs.insertBefore(tab,backup);
    var panel=document.createElement('section');panel.id='panel-assistantReview';panel.className='panel';panel.innerHTML='<div class="card"><div class="ar-intro"><div><h2>Assistant Review</h2><p class="ar-safe">Paste a payment-plan email. BillsOS will parse it, compare it with future calendar items, and prepare a pending suggestion. It will never apply changes automatically and will never modify past months.</p></div><span class="ar-badge">Human approval required</span></div><label style="margin-top:16px">Paste payment-plan email</label><textarea id="arEmail" class="ar-input" placeholder="Paste the email subject and body here…"></textarea><div class="actions"><button class="btn primary" id="arReview">Review email</button><button class="btn" id="arClear">Clear</button></div><div id="arStatus" class="status">No email reviewed yet.</div></div><div class="card"><div class="cardhead"><h2>Pending suggestion</h2></div><div id="arResult" class="ar-result"></div></div><div class="card"><div class="cardhead"><h2>Audit log</h2></div><div id="arAudit" class="ar-audit"></div></div>';
    tabs.parentNode.insertBefore(panel,document.getElementById('panel-backup'));
    document.getElementById('arReview').onclick=review;document.getElementById('arClear').onclick=function(){document.getElementById('arEmail').value='';dismiss()};renderSuggestion();renderAudit();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,100)});else setTimeout(install,100);
})();
