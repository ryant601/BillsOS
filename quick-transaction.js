(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  function openQuickTransaction(){
    if(root.BillsOSSession&&root.BillsOSSession.role==='viewer')return;
    var panel=document.querySelector('.month-panel.show');
    if(!panel)return;
    var now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var month=panel.dataset.year+'-'+String(panel.dataset.month).padStart(2,'0'),date=month===today.slice(0,7)?today:month+'-01';
    var panels=Array.from(document.querySelectorAll('.month-panel[data-year][data-month]'));
    var monthKeys=panels.map(function(p){return p.dataset.year+'-'+String(p.dataset.month).padStart(2,'0')}).sort();
    var min=monthKeys[0]+'-01',last=monthKeys[monthKeys.length-1],end=new Date(Number(last.slice(0,4)),Number(last.slice(5)),0).getDate(),max=last+'-'+String(end).padStart(2,'0');
    var dialog=document.createElement('dialog');dialog.className='planner-dialog quick-transaction-dialog';
    dialog.innerHTML='<form class="planner-form"><div class="planner-head"><div><h2>Quick transaction</h2><p>Add a one-time expense or income.</p></div><button type="button" class="planner-close" aria-label="Close">×</button></div><div class="planner-fields"><label>Name<input name="name" required maxlength="80" placeholder="Car repair or refund"></label><label>Type<select name="kind"><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Amount<input name="amount" required type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></label><label>Date<input name="date" required type="date"></label><label class="quick-note">Note (optional)<input name="notes" maxlength="500"></label></div><button class="planner-calculate" type="submit">Add transaction</button><div class="planner-status" role="status" aria-live="polite"></div></form>';
    document.body.appendChild(dialog);
    var form=dialog.querySelector('form'),dateField=form.elements.date,status=dialog.querySelector('.planner-status'),submit=dialog.querySelector('[type="submit"]'),pending=false;
    dateField.min=min;dateField.max=max;dateField.value=date;
    var id='quick-'+(root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    dialog.querySelector('.planner-close').onclick=function(){if(!pending)dialog.close()};
    dialog.addEventListener('cancel',function(event){if(pending)event.preventDefault()});
    dialog.addEventListener('close',function(){dialog.remove()},{once:true});
    form.onsubmit=async function(event){
      event.preventDefault();if(pending||!form.reportValidity())return;
      try{
        var row=api.makeRow({name:form.elements.name.value,kind:form.elements.kind.value,amount:form.elements.amount.value,date:dateField.value,notes:form.elements.notes.value},id,min,max);
        pending=true;submit.disabled=true;status.className='planner-status';status.textContent='Adding transaction…';
        await api.save(root.fetch.bind(root),row);
        status.textContent='Added. Updating the calendar…';
        root.location.assign('/?view=calendar&focus='+encodeURIComponent(row.date));
      }catch(error){pending=false;submit.disabled=false;status.className='planner-status is-error';status.textContent=error.message||'Could not save. Please try again.'}
    };
    dialog.showModal();form.elements.name.focus();
  }
  function start(){var button=document.getElementById('openQuickTransaction');if(button)button.onclick=openQuickTransaction}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function makeRow(input,id,min,max){
    var name=String(input.name||'').trim(),amount=Number(input.amount),date=String(input.date||''),kind=input.kind;
    if(!name||name.length>80)throw new Error('Enter a name up to 80 characters.');
    if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)<1||Math.abs(amount*100-Math.round(amount*100))>0.000001)throw new Error('Enter a positive amount with no more than two decimals.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<min||date>max)throw new Error('Choose a date within the calendar.');
    if(kind!=='income'&&kind!=='expense')throw new Error('Choose expense or income.');
    return{id:id,name:name,date:date,amount:(kind==='income'?1:-1)*Math.round(amount*100)/100,type:kind==='income'?'income':'adjustment',category:kind==='income'?'One-time income':'One-time expense',notes:String(input.notes||'').trim().slice(0,500)};
  }
  async function save(fetcher,row){
    var response=await fetcher('/api/bills?quick='+Date.now(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error('Could not load the latest calendar. Please try again.');
    var current=await response.json();
    for(var attempt=0;attempt<2;attempt++){
      var existing=Array.isArray(current.oneTimeEvents)?current.oneTimeEvents:[];
      if(existing.some(function(item){return item.id===row.id}))return current;
      var payload=Object.assign({},current,{oneTimeEvents:existing.concat([row])});
      response=await fetcher('/api/bills',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      var data=await response.json().catch(function(){return{}});
      if(response.ok)return data;
      if(response.status===409&&data.current&&attempt===0){current=data.current;continue}
      throw new Error(data.error||'Could not save the transaction. Please try again.');
    }
  }
  return{makeRow:makeRow,save:save};
});
