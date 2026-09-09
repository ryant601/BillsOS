(function(){
  'use strict';

  var SETTLE_CLASS='billsos-income-settling';
  document.documentElement.classList.add(SETTLE_CLASS);
  (function installSettleStyle(){
    if(document.getElementById('billsosIncomeSettleStyle'))return;
    var style=document.createElement('style');style.id='billsosIncomeSettleStyle';
    style.textContent='html.'+SETTLE_CLASS+' [data-bo-detail="income"] .bo-kpi-value,html.'+SETTLE_CLASS+' [data-bo-detail="income"] .bo-kpi-note{visibility:hidden!important}';
    document.head.appendChild(style);
  })();

  function money(value){
    return Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  }

  function startOfToday(){
    var now=new Date();
    return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  }

  function isoDate(date){
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }

  function scheduledIncome(data){
    var engine=window.BillsOSCashflow;
    if(!engine||typeof engine.rowsForMonth!=='function')return [];
    var today=startOfToday(),end=new Date(today);end.setDate(end.getDate()+14);
    var incomeIds={};
    (data.income||[]).forEach(function(item){if(item&&item.active!==false&&item.id)incomeIds[item.id]=true});
    var months=[[today.getFullYear(),today.getMonth()+1],[end.getFullYear(),end.getMonth()+1]];
    var rows=[];
    months.filter(function(value,index,all){return all.findIndex(function(other){return other[0]===value[0]&&other[1]===value[1]})===index}).forEach(function(value){
      rows=rows.concat(engine.rowsForMonth(data,value[1],0,value[0])||[]);
    });
    var startIso=isoDate(today),endIso=isoDate(end);
    return rows.filter(function(row){
      return row&&row.type==='income'&&row.amount>0&&incomeIds[row.sourceId]&&row.iso>=startIso&&row.iso<=endIso;
    }).sort(function(a,b){return a.iso.localeCompare(b.iso)||a.name.localeCompare(b.name)});
  }

  function patchCard(rows){
    var card=document.querySelector('[data-bo-detail="income"]');
    if(!card)return false;
    var value=card.querySelector('.bo-kpi-value'),note=card.querySelector('.bo-kpi-note');
    var total=rows.reduce(function(sum,row){return sum+Math.abs(Number(row.amount||0))},0);
    if(value)value.textContent=money(total);
    if(note)note.textContent=rows.length+' paycheck'+(rows.length===1?'':'s')+' · next 14 days';
    card.setAttribute('data-billsos-income-window','14-days');
    card.setAttribute('data-billsos-income-source','calendar');
    card.classList.add('billsos-income-ready');
    return true;
  }

  function patchDrawer(rows){
    var title=document.getElementById('boDetailTitle');
    if(!title||String(title.textContent||'').trim().toLowerCase()!=='income remaining')return;
    var sub=document.getElementById('boDetailSubtitle'),content=document.getElementById('boDetailContent');
    if(sub)sub.textContent='Scheduled paychecks in the next 14 days';
    if(!content)return;
    content.innerHTML='<div class="bo-detail-list">'+(rows.length?rows.map(function(row){
      var date=new Date(row.iso+'T00:00:00');
      var label=date.toLocaleDateString([], {month:'short',day:'numeric'});
      return '<div class="bo-detail-row"><div class="bo-detail-date">'+label+'</div><div><div class="bo-detail-name">'+String(row.name||'Paycheck').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})+'</div><div class="bo-detail-meta">Scheduled paycheck · calendar</div></div><div class="bo-detail-amount">'+money(Math.abs(Number(row.amount||0)))+'</div></div>';
    }).join(''):'<div class="bo-empty">No paychecks are scheduled in the next 14 days.</div>')+'</div><a class="bo-detail-action" href="/control#income">Manage income</a>';
  }

  function revealFallback(){document.documentElement.classList.remove(SETTLE_CLASS)}

  function install(){
    if(location.pathname!=='/'||new URLSearchParams(location.search).get('view')==='calendar'){revealFallback();return}
    fetch('/api/bills?income14='+Date.now(),{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('income unavailable');return response.json()}).then(function(data){
      var rows=scheduledIncome(data),observer=null,settleTimer=0;

      function finalize(){
        if(settleTimer){clearTimeout(settleTimer);settleTimer=0}
        if(observer){observer.disconnect();observer=null}
        patchCard(rows);
        revealFallback();
      }

      function armOnce(){
        if(settleTimer||!document.querySelector('[data-bo-detail="income"]'))return;
        /* html-hotfix-loader owns the Home KPI markup and deliberately refreshes
           it at 1.2s and 2.4s while calendar metrics settle. Keep the value hidden
           through those shell renders, then write the calendar-backed 14-day value
           once. This prevents the two renderers from ever becoming visible in turn. */
        settleTimer=setTimeout(finalize,2600);
        if(observer){observer.disconnect();observer=null}
      }

      if(document.querySelector('[data-bo-detail="income"]'))armOnce();
      else{
        observer=new MutationObserver(function(){armOnce()});
        observer.observe(document.body,{childList:true,subtree:true});
      }

      document.addEventListener('click',function(event){
        var card=event.target&&event.target.closest?event.target.closest('[data-bo-detail="income"]'):null;
        if(card)setTimeout(function(){patchDrawer(rows)},0);
      },true);
      document.addEventListener('keydown',function(event){
        if(event.key!=='Enter'&&event.key!==' ')return;
        var card=event.target&&event.target.closest?event.target.closest('[data-bo-detail="income"]'):null;
        if(card)setTimeout(function(){patchDrawer(rows)},0);
      },true);
    }).catch(function(){revealFallback()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
