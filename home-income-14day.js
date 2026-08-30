(function(){
  'use strict';

  function money(value){
    return Number(value||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  }

  function isoDate(date){
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }

  function monthPairs(start,end){
    var out=[],cursor=new Date(start.getFullYear(),start.getMonth(),1),last=new Date(end.getFullYear(),end.getMonth(),1);
    while(cursor<=last){out.push([cursor.getFullYear(),cursor.getMonth()+1]);cursor.setMonth(cursor.getMonth()+1)}
    return out;
  }

  function scheduledIncome(data){
    var engine=window.BillsOSCashflow;
    if(!engine||typeof engine.rowsForMonth!=='function')return [];
    var now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),end=new Date(today);end.setDate(end.getDate()+14);
    var startIso=isoDate(today),endIso=isoDate(end),activeIds={};
    (data.income||[]).forEach(function(item){if(item&&item.active!==false&&item.id)activeIds[item.id]=true});
    var rows=[];
    monthPairs(today,end).forEach(function(pair){rows=rows.concat(engine.rowsForMonth(data,pair[1],0,pair[0])||[])});
    return rows.filter(function(row){
      return row&&row.amount>0&&row.type==='income'&&activeIds[row.sourceId]&&row.iso>=startIso&&row.iso<=endIso;
    }).sort(function(a,b){return a.iso.localeCompare(b.iso)||String(a.name||'').localeCompare(String(b.name||''))});
  }

  function label(row){
    var d=new Date(row.iso+'T00:00:00');
    return d.toLocaleDateString([], {month:'short',day:'numeric'});
  }

  function patchCard(rows){
    var card=document.querySelector('[data-bo-detail="income"]');
    if(!card)return false;
    var total=rows.reduce(function(sum,row){return sum+Math.abs(Number(row.amount||0))},0),value=card.querySelector('.bo-kpi-value'),note=card.querySelector('.bo-kpi-note');
    if(value)value.textContent=money(total);
    if(note)note.textContent=rows.length+' paycheck'+(rows.length===1?'':'s')+' · next 14 days';
    card.setAttribute('data-billsos-income-window','14-days');
    return true;
  }

  function patchDrawer(rows){
    if(!document.body.classList.contains('bo-detail-open'))return;
    var title=document.getElementById('boDetailTitle'),sub=document.getElementById('boDetailSubtitle'),content=document.getElementById('boDetailContent');
    if(!title||String(title.textContent||'').trim().toLowerCase()!=='income remaining'||!content)return;
    if(sub)sub.textContent='Paychecks scheduled in the next 14 days';
    content.innerHTML='<div class="bo-detail-list">'+(rows.length?rows.map(function(row){return '<div class="bo-detail-row"><div class="bo-detail-date">'+label(row)+'</div><div><div class="bo-detail-name">'+String(row.name||'Income').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})+'</div><div class="bo-detail-meta">Scheduled paycheck</div></div><div class="bo-detail-amount">'+money(Math.abs(Number(row.amount||0)))+'</div></div>'}).join(''):'<div class="bo-empty">No paychecks scheduled in the next 14 days.</div>')+'</div><a class="bo-detail-action" href="/control#income">Manage income</a>';
  }

  function install(){
    if(location.pathname!=='/'||new URLSearchParams(location.search).get('view')==='calendar')return;
    fetch('/api/bills?income14='+Date.now(),{cache:'no-store'}).then(function(response){if(!response.ok)throw new Error('income unavailable');return response.json()}).then(function(data){
      var rows=scheduledIncome(data);
      patchCard(rows);
      setTimeout(function(){patchCard(rows)},1300);
      setTimeout(function(){patchCard(rows)},2200);
      document.addEventListener('click',function(event){var card=event.target&&event.target.closest?event.target.closest('[data-bo-detail="income"]'):null;if(card)setTimeout(function(){patchDrawer(rows)},0)},true);
      document.addEventListener('keydown',function(event){if(event.key!=='Enter'&&event.key!==' ')return;var card=event.target&&event.target.closest?event.target.closest('[data-bo-detail="income"]'):null;if(card)setTimeout(function(){patchDrawer(rows)},0)},true);
    }).catch(function(){});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
