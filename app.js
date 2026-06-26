(function(){
  var KEYS={june:'june2026-bridge-paid-v5',july:'july2026-bills-paid',aug:'aug2026-bills-paid',sep:'sep2026-bills-paid',oct:'oct2026-bills-paid',nov:'nov2026-bills-paid',dec:'dec2026-bills-paid'};
  var months=['june', 'july', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var inited={june:false,july:false,aug:false,sep:false,oct:false,nov:false,dec:false};
  async function loadMonthPanels(){
    var mount=document.getElementById('month-panels');
    if(!mount || mount.dataset.loaded==='1') return;
    var files=['june','july','aug','sep','oct','nov','dec'];
    var html=await Promise.all(files.map(function(m){return fetch('months/'+m+'.html',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Missing month '+m);return r.text();});}));
    mount.innerHTML=html.join('\n');
    mount.dataset.loaded='1';
  }

  var ACTION_ITEMS = window.BILLSOS_ACTION_ITEMS || [];
  function moneyNumber(s){return Number(String(s||'').replace(/[^0-9.\-]/g,''))||0;}
  function localToday(){var d=new Date();d.setHours(0,0,0,0);return d;}
  function isoLocal(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;}
  function fmtShort(iso){var d=new Date(iso+'T12:00:00');return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});}
  function nextActions(days){
    var start=localToday();
    var end=new Date(start); end.setDate(end.getDate()+days);
    return ACTION_ITEMS.filter(function(a){var d=new Date(a.date+'T12:00:00');return d>=start&&d<=end;});
  }
  function exportPayload(){
    var items=nextActions(45);
    return {
      generatedAt:new Date().toISOString(),
      source:'Bills Account HTML Calendar',
      reminderList:'Bills',
      defaultAlerts:{nightBefore:'19:00',morningOf:'08:00'},
      notes:'V2 reminder model: manual bills, autopays, paycheck verification, living/spending funding, and sweep reviews all receive night-before and morning-of reminders. Autopays are worded as verification tasks, not manual payment tasks.',
      items:items
    };
  }
  function downloadJSON(){
    var payload=JSON.stringify(exportPayload(),null,2);
    var blob=new Blob([payload],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='bills-action-items-v2-2-next45.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},500);
    var st=document.getElementById('shortcutStatus'); if(st)st.textContent='Downloaded bills-action-items-v2-2-next45.json. Save it to iCloud Drive for the Shortcut.';
  }
  async function copyJSON(){
    var payload=JSON.stringify(exportPayload(),null,2);
    var st=document.getElementById('shortcutStatus');
    try{await navigator.clipboard.writeText(payload); if(st)st.textContent='Copied JSON to clipboard.';}
    catch(e){if(st)st.textContent='Copy blocked by browser. Use Download action JSON instead.';}
  }
  function previewJSON(){
    var box=document.getElementById('shortcutPreview'),st=document.getElementById('shortcutStatus');
    if(!box)return;
    var payload=exportPayload();
    box.style.display=box.style.display==='block'?'none':'block';
    box.textContent=JSON.stringify({count:payload.items.length,firstFive:payload.items.slice(0,5)},null,2);
    if(st)st.textContent='Previewing '+payload.items.length+' action items for the next 45 days.';
  }

  function csvEscape(v){v=String(v==null?'':v);return '"'+v.replace(/"/g,'""')+'"';}
  function reminderRows(days){
    var rows=[];
    nextActions(days).forEach(function(a){
      var baseDate=new Date(a.date+'T12:00:00');
      if((a.reminders||[]).indexOf('night_before_7pm')>-1){
        var d=new Date(baseDate); d.setDate(d.getDate()-1);
        rows.push({title:a.nightBeforeTitle||('🌙 Tomorrow: '+a.title),due_date:d.toISOString().slice(0,10),due_time:'19:00',list:'Bills',priority:a.priority||'medium',source_date:a.date,amount:a.amount,type:a.type,method:a.method,notes:a.reminderNote||''});
      }
      if((a.reminders||[]).indexOf('morning_of_8am')>-1){
        rows.push({title:a.morningTitle||('☀️ Today: '+a.title),due_date:a.date,due_time:'08:00',list:'Bills',priority:a.priority||'medium',source_date:a.date,amount:a.amount,type:a.type,method:a.method,notes:a.reminderNote||''});
      }
    });
    return rows;
  }
  function downloadCSV(){
    var headers=['title','due_date','due_time','list','priority','source_date','amount','type','method','notes'];
    var rows=reminderRows(45);
    var csv=[headers.join(',')].concat(rows.map(function(r){return headers.map(function(h){return csvEscape(r[h]);}).join(',');})).join('\n');
    var blob=new Blob([csv],{type:'text/csv'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='bills-reminders-v2-2-next45.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},500);
    var st=document.getElementById('shortcutStatus'); if(st)st.textContent='Downloaded bills-reminders-next45.csv with '+rows.length+' Reminder rows.';
  }

  function amountText(a){return a.amount?'$'+a.amount:'';}
  function actionLabel(a){return (a.reminderTitle||a.title||'Action').replace(/^[^A-Za-z0-9]+\s*/, '');}

  var COMPLETION_KEY='bills-action-completions-v1';
  var completedActions=new Set();
  var completionStorageReady=false;
  var completionSaveTimer=null;

  function escAttr(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function normText(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function normAmount(v){return moneyNumber(v).toFixed(2);}
  function actionIdFromParts(date, name, amount){return [date,normText(name),normAmount(amount)].join('|');}
  function actionId(a){return actionIdFromParts(a.date,(a.source||a.title||''),a.amount);}
  function setDoneClass(root,done){if(!root)return;root.classList.toggle('done',!!done);var cb=root.querySelector('input[type=checkbox][data-action-id]');if(cb)cb.checked=!!done;}

  async function loadCompletions(){
    var ok=await waitForStorage(); completionStorageReady=ok;
    if(ok){try{var r=await window.storage.get(COMPLETION_KEY);if(r&&r.value)completedActions=new Set(JSON.parse(r.value));return;}catch(e){}}
    try{var raw=localStorage.getItem(COMPLETION_KEY);if(raw)completedActions=new Set(JSON.parse(raw));}catch(e){}
  }
  function saveCompletions(){
    var payload=JSON.stringify([...completedActions]);
    try{localStorage.setItem(COMPLETION_KEY,payload);}catch(e){}
    if(!completionStorageReady)return;
    clearTimeout(completionSaveTimer);
    completionSaveTimer=setTimeout(async function(){try{await window.storage.set(COMPLETION_KEY,payload);}catch(e){}},200);
  }
  function updateCompletion(id,done){
    if(!id)return;
    done?completedActions.add(id):completedActions.delete(id);
    saveCompletions();
    refreshCompletionViews();
  }
  function refreshPanelProgress(panel){
    if(!panel)return;
    var boxes=[...panel.querySelectorAll('.ev input[type=checkbox][data-action-id]')];
    var count=panel.querySelector('.paidCount'),total=panel.querySelector('.paidTotal'),bar=panel.querySelector('.paidBar');
    if(total)total.textContent=boxes.length;
    if(count)count.textContent=boxes.filter(function(cb){return cb.checked;}).length;
    if(bar)bar.style.width=(boxes.length?boxes.filter(function(cb){return cb.checked;}).length/boxes.length*100:0)+'%';
  }
  function refreshCompletionViews(){
    document.querySelectorAll('[data-action-id]').forEach(function(el){
      var id=el.getAttribute('data-action-id');
      setDoneClass(el,completedActions.has(id));
    });
    months.forEach(function(m){refreshPanelProgress(document.getElementById('panel-'+m));});
  }
  function bindActionCheckbox(root,id){
    if(!root||!id)return;
    root.setAttribute('data-action-id',id);
    var cb=root.querySelector('input[type=checkbox][data-action-id]');
    if(!cb){cb=root.querySelector('input[type=checkbox]');}
    if(cb){
      cb.setAttribute('data-action-id',id);
      cb.checked=completedActions.has(id);
      cb.addEventListener('change',function(){updateCompletion(id,cb.checked);});
    }
    setDoneClass(root,completedActions.has(id));
  }
  function monthNumFromPanel(panel){var map={june:5,july:6,aug:7,sep:8,oct:9,nov:10,dec:11};var id=(panel&&panel.id||'').replace('panel-','');return map[id];}
  function eventDateIso(ev,panel){var day=ev.closest('.day[data-day]');var m=monthNumFromPanel(panel);if(!day||m==null)return '';return isoLocal(new Date(2026,m,parseInt(day.getAttribute('data-day'),10)));}
  function matchActionForEvent(ev,panel){
    var date=eventDateIso(ev,panel);
    var name=(ev.querySelector('.nm')||{}).textContent||'';
    var amt=(ev.querySelector('.amt')||{}).textContent||'';
    var val=Math.abs(moneyNumber(amt));
    var candidates=ACTION_ITEMS.filter(function(a){return a.date===date && Math.abs(moneyNumber(a.amount)-val)<0.01;});
    var n=normText(name);
    candidates.sort(function(a,b){
      function score(x){var s=normText(x.source||x.title);return n===s?4:(n.indexOf(s)>-1||s.indexOf(n)>-1?3:(normText(x.title).indexOf(n)>-1?2:1));}
      return score(b)-score(a);
    });
    if(candidates.length)return actionId(candidates[0]);
    return actionIdFromParts(date,name,val);
  }

  function itemsOn(iso){return ACTION_ITEMS.filter(function(a){return a.date===iso;});}
  function renderActionList(el, items, emptyText){
    if(!el)return;
    if(!items.length){el.innerHTML='<div class="action done"><span class="box"></span><span>'+emptyText+'</span></div>';return;}
    el.innerHTML=items.map(function(a){var id=actionId(a);return '<label class="action" data-action-id="'+escAttr(id)+'"><input type="checkbox" data-action-id="'+escAttr(id)+'" title="Mark complete"><span class="box" aria-hidden="true"></span><span>'+ (a.reminderTitle||a.title) +'</span></label>';}).join('');
    el.querySelectorAll('.action[data-action-id]').forEach(function(row){
      var id=row.getAttribute('data-action-id');
      bindActionCheckbox(row,id);
    });
  }

  function daysBetween(a,b){var A=new Date(a);A.setHours(0,0,0,0);var B=new Date(b);B.setHours(0,0,0,0);return Math.round((B-A)/86400000);}
  function relativeDayText(dateIso){var d=daysBetween(localToday(), new Date(dateIso+'T12:00:00')); if(d===0)return 'Today'; if(d===1)return 'Tomorrow'; if(d<0)return Math.abs(d)+' day(s) ago'; return d+' day(s)';}
  function actionKindText(a){if(a.type==='paycheck')return 'Paycheck'; if(a.type==='spending_funding')return 'Spending funding'; if(a.type==='sweep')return 'Sweep'; if(a.method==='autopay_verify')return 'Autopay check'; if(a.method==='manual')return 'Manual payment'; if(a.method==='transfer')return 'Transfer'; return a.type||'Action';}
  function parseMoneyText(t){if(!t)return null; var n=String(t).replace(/[^0-9.\-]/g,''); if(!n)return null; return Number(n);}
  function allProjectedBalances(){var rows=[]; var months={june:5,july:6,aug:7,sep:8,oct:9,nov:10,dec:11}; Object.keys(months).forEach(function(m){var panel=document.getElementById('panel-'+m); if(!panel)return; panel.querySelectorAll('.day[data-day]').forEach(function(day){var e=day.querySelector('.eod b'); if(!e)return; var d=parseInt(day.getAttribute('data-day'),10); var bal=parseMoneyText(e.textContent); if(isNaN(bal))return; var dt=new Date(2026,months[m],d); rows.push({date:isoLocal(dt),balance:bal});});}); rows.sort(function(a,b){return a.date.localeCompare(b.date);}); return rows;}
  function renderStatusFirst(){
    var today=localToday(), todayIso=isoLocal(today);
    var future=ACTION_ITEMS.filter(function(a){return new Date(a.date+'T12:00:00')>=today;}).sort(function(a,b){return a.date.localeCompare(b.date);});
    var todayItems=itemsOn(todayIso), tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1); var tomorrowItems=itemsOn(isoLocal(tomorrow));
    var nextPay=future.find(function(a){return a.type==='paycheck';});
    var nextSpend=future.find(function(a){return a.type==='spending_funding';});
    var nextSweep=future.find(function(a){return a.type==='sweep';});
    var nextActions=future.filter(function(a){return a.type!=='paycheck' || a.method==='verify';}).slice(0,8);
    var balances=allProjectedBalances().filter(function(r){return new Date(r.date+'T12:00:00')>=today;});
    var firstBad=balances.find(function(r){return r.balance<0;});
    var covered=firstBad?new Date(new Date(firstBad.date+'T12:00:00').getTime()-86400000): (balances.length?new Date(balances[balances.length-1].date+'T12:00:00'):null);
    var low=balances.reduce(function(m,r){return m===null||r.balance<m?r.balance:m;},null);
    var highPrioritySoon=future.filter(function(a){return a.priority==='high' && daysBetween(today,a.date)<=7;}).length;
    var score=95; if(firstBad)score=62; else if(low!==null&&low<500)score=82; else if(low!==null&&low<1000)score=88; if(highPrioritySoon>5)score-=3; if(todayItems.length>4)score-=2; score=Math.max(60,Math.min(98,score));
    var onTrack=!firstBad;
    var pill=document.getElementById('overallStatusPill'); if(pill)pill.textContent=(onTrack?'🟢 Status: On Track':'🟠 Status: Review Needed');
    var title=document.getElementById('statusHeroTitle'); if(title)title.textContent=onTrack?'Bills account is on track':'Review upcoming bills account coverage';
    var sub=document.getElementById('statusHeroSub'); if(sub){var parts=[]; parts.push(todayItems.length?todayItems.length+' action(s) today':'No required action today'); if(tomorrowItems.length)parts.push(tomorrowItems.length+' action(s) tomorrow'); if(nextPay)parts.push('next paycheck '+relativeDayText(nextPay.date).toLowerCase()); if(nextSpend)parts.push('spending account funding '+relativeDayText(nextSpend.date).toLowerCase()); sub.textContent=parts.join(' · ')+'.';}
    var cs=document.getElementById('confidenceScore'); if(cs)cs.textContent=score+'%'; var cb=document.getElementById('confidenceBar'); if(cb)cb.style.width=score+'%'; var cn=document.getElementById('confidenceNote'); if(cn)cn.textContent=onTrack?'No projected negative balance in the visible calendar window.':'A projected negative balance appears in the visible calendar window.';
    var ct=document.getElementById('coveredThroughMetric'); if(ct)ct.textContent=covered?covered.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—';
    var ctn=document.getElementById('coveredThroughNote'); if(ctn)ctn.textContent=firstBad?'Coverage turns negative after this date.':'No negative projected balance in visible months.';
    var hp=document.getElementById('heroNextPaycheck'); if(hp&&nextPay)hp.textContent=relativeDayText(nextPay.date); var hpn=document.getElementById('heroNextPaycheckNote'); if(hpn&&nextPay)hpn.textContent=fmtShort(nextPay.date)+' · '+amountText(nextPay);
    var hs=document.getElementById('heroSpendingFunded'); if(hs&&nextSpend)hs.textContent=relativeDayText(nextSpend.date); var hsn=document.getElementById('heroSpendingFundedNote'); if(hsn&&nextSpend)hsn.textContent=fmtShort(nextSpend.date)+' · '+amountText(nextSpend);
    var sw=document.getElementById('heroNextSweep'); if(sw)sw.textContent=nextSweep?relativeDayText(nextSweep.date):'None';
    var na=document.getElementById('heroNextActions'); if(na)na.textContent=(todayItems.length?todayItems.length+' today':(tomorrowItems.length?tomorrowItems.length+' tomorrow':'0 today'));
    var nan=document.getElementById('heroNextActionsNote'); if(nan)nan.textContent=nextActions.length?('Next: '+(nextActions[0].reminderTitle||nextActions[0].title)):'No upcoming reminder actions.';
    var tl=document.getElementById('nextTimelineList'); if(tl){var grouped=[], seen={}; future.forEach(function(a){if(grouped.length>=4)return; if(!seen[a.date]){seen[a.date]=[]; grouped.push({date:a.date,items:seen[a.date]});} seen[a.date].push(a);}); tl.innerHTML=grouped.map(function(g){var first=g.items[0]; var label=relativeDayText(g.date); var extra=g.items.length>1?' + '+(g.items.length-1)+' more':''; return '<div class="timeline-node"><div class="when">'+label+' · '+fmtShort(g.date)+'</div><div class="what">'+(first.reminderTitle||first.title)+extra+'</div><div class="meta">'+actionKindText(first)+' · '+amountText(first)+'</div></div>';}).join('') || '<div class="timeline-node"><div class="when">No upcoming</div><div class="what">No scheduled activity found.</div></div>';}
  }

  function renderV2Briefing(){
    var today=localToday();
    var tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    var todayIso=isoLocal(today), tomorrowIso=isoLocal(tomorrow);
    var todayItems=itemsOn(todayIso), tomorrowItems=itemsOn(tomorrowIso);
    var h=new Date().getHours();
    var greeting=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    var title=document.getElementById('dailyBriefingTitle');
    if(title)title.textContent=greeting+', Ryan';
    var sub=document.getElementById('dailyBriefingSub');
    if(sub)sub.textContent='Today is '+today.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})+'. The dashboard and export use this device-local date.';
    var csub=document.getElementById('todayChecklistSub');
    if(csub)csub.textContent=fmtShort(todayIso)+' checklist · '+(todayItems.length?todayItems.length+' item(s) to check':'nothing requiring action today');
    renderActionList(document.getElementById('todayChecklistList'),todayItems,'Nothing requiring action today.');
    var ttitle=document.getElementById('tomorrowActionsTitle');
    if(ttitle)ttitle.textContent='Tomorrow · '+fmtShort(tomorrowIso);
    var tl=document.getElementById('tomorrowActionsList');
    if(tl){
      if(!tomorrowItems.length)tl.innerHTML='<div class="v2-item"><span>No expected actions</span><span>'+fmtShort(tomorrowIso)+'</span></div>';
      else tl.innerHTML=tomorrowItems.map(function(a){return '<div class="v2-item"><span>'+ (a.reminderTitle||a.title) +'</span><span>'+fmtShort(a.date)+' · '+amountText(a)+'</span></div>';}).join('');
    }
    var np=ACTION_ITEMS.find(function(a){return a.type==='paycheck'&&new Date(a.date+'T12:00:00')>=today;});
    var sf=ACTION_ITEMS.find(function(a){return a.type==='spending_funding'&&new Date(a.date+'T12:00:00')>=today;});
    var npm=document.getElementById('nextPaycheckMetric'); if(npm&&np)npm.textContent=fmtShort(np.date);
    var sfm=document.getElementById('spendingFundedMetric'); if(sfm&&sf)sfm.textContent=fmtShort(sf.date);
    renderStatusFirst();
  }

  function waitForStorage(){return new Promise(function(res){var i=0;(function chk(){if(window.storage&&typeof window.storage.set==='function')res(true);else if(++i<30)setTimeout(chk,100);else res(false);})();});}
  async function initPanel(which){
    if(inited[which])return; inited[which]=true;
    var panel=document.getElementById('panel-'+which),KEY=KEYS[which];
    var calendarEvents=[...panel.querySelectorAll('.ev')].filter(function(e){return!e.classList.contains('note');});
    var status=panel.querySelector('.saveStatus');
    function setStatus(t,c){if(status){status.textContent=t;status.className='saveStatus savestatus '+c;}}

    calendarEvents.forEach(function(ev){
      if(ev.querySelector('input[type=checkbox][data-action-id]'))return;
      var id=matchActionForEvent(ev,panel);
      var cb=document.createElement('input');
      cb.type='checkbox';
      cb.title='Mark complete';
      cb.setAttribute('data-action-id',id);
      ev.prepend(cb);
      bindActionCheckbox(ev,id);
    });

    // One-time migration from the older per-month index-based checkbox storage into the shared action-completion model.
    if(completionStorageReady){
      try{
        var r=await window.storage.get(KEY);
        if(r&&r.value){
          var oldPaid=new Set(JSON.parse(r.value));
          var oldBillEvents=[...panel.querySelectorAll('.ev')].filter(function(e){return!e.classList.contains('in')&&!e.classList.contains('note');});
          oldBillEvents.forEach(function(ev,i){var id=ev.getAttribute('data-action-id');if(oldPaid.has(i)&&id)completedActions.add(id);});
          saveCompletions();
        }
      }catch(e){}
    }

    setStatus(completionStorageReady?'Synced':'Offline','ok');
    refreshCompletionViews();
  }
  function show(w){
    months.forEach(function(m){
      document.getElementById('panel-'+m).classList.toggle('show',m===w);
      document.getElementById('btn-'+m).classList.toggle('active',m===w);
    });
    initPanel(w);
    try{window.storage&&window.storage.set('bills-last-view',w);}catch(e){}
  }
  function markToday(){
    var now=new Date();if(now.getFullYear()!==2026)return;
    var map={5:'june',6:'july',7:'aug',8:'sep',9:'oct',10:'nov',11:'dec'};
    var pid=map[now.getMonth()];if(!pid)return;
    var panel=document.getElementById('panel-'+pid);if(!panel)return;
    var cell=panel.querySelector('.day[data-day="'+now.getDate()+'"]');if(!cell)return;
    cell.classList.add('is-today');
    var dtop=cell.querySelector('.dtop');
    if(dtop&&!dtop.querySelector('.badge.today')){var b=document.createElement('span');b.className='badge today';b.textContent='Today';dtop.appendChild(b);}
  }
  document.addEventListener('DOMContentLoaded',async function(){
    await loadMonthPanels();
    months.forEach(function(m){document.getElementById('btn-'+m).addEventListener('click',function(){show(m);});});
    var dl=document.getElementById('downloadActionsBtn'), cp=document.getElementById('copyActionsBtn'), pv=document.getElementById('previewActionsBtn'), csv=document.getElementById('downloadCsvBtn');
    if(dl)dl.addEventListener('click',downloadJSON);
    if(csv)csv.addEventListener('click',downloadCSV);
    if(cp)cp.addEventListener('click',copyJSON);
    if(pv)pv.addEventListener('click',previewJSON);
    await loadCompletions();
    renderV2Briefing();
    var monthMap={5:'june',6:'july',7:'aug',8:'sep',9:'oct',10:'nov',11:'dec'};
    var start=monthMap[new Date().getMonth()]||'june';
    if(await waitForStorage()){try{var r=await window.storage.get('bills-last-view');if(r&&r.value&&months.indexOf(r.value)>-1)start=r.value;}catch(e){}}
    show(start);markToday();
  });
})();
