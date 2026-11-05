(function(root,factory){
'use strict';
const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
if(!root.document)return;root.BillsOSControlWorkspace=api;
function install(){
 if(!document.body.classList.contains('billsos-control')||document.getElementById('cwToolbar'))return;
 const bills=document.getElementById('panel-bills'),income=document.getElementById('panel-income'),tabs=document.querySelector('.tabs');if(!bills||!income||!tabs)return;
 document.body.classList.add('cw-ready');
 const one=document.createElement('section');one.id='panel-oneTime';one.className='panel';
 const marker=document.getElementById('oneTimeItems');let node=marker;while(node){const next=node.nextElementSibling;one.appendChild(node);node=next;}bills.after(one);
 const extra=Array.from(tabs.children).filter(b=>!['bills','income'].includes(b.dataset.tab));
 tabs.innerHTML='<button type="button" class="tab active" data-tab="bills">Recurring bills</button><button type="button" class="tab" data-tab="oneTime">One-time items</button><button type="button" class="tab" data-tab="income">Income</button>';
 tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>window.showTab(b.dataset.tab));
 if(extra.length){const tools=document.createElement('details');tools.className='cw-tools';tools.innerHTML='<summary>Advanced tools</summary><div class="cw-tool-buttons"></div>';extra.forEach(b=>tools.querySelector('div').appendChild(b));tabs.after(tools);}
 const toolbar=document.createElement('div');toolbar.id='cwToolbar';toolbar.className='cw-toolbar';toolbar.innerHTML='<label class="cw-search">Search this view<input id="cwSearch" type="search" placeholder="Name, category, or notes…"></label><label data-cw-bills>Payment<select id="cwPayment"><option value="">All payment methods</option><option value="auto">Autopay</option><option value="manual">Manual</option></select></label><label data-cw-bills>Status<select id="cwStatus"><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option></select></label><label>Sort by<select id="cwSort"><option value="name">Name</option><option value="date">Due day / date</option><option value="amount">Amount · highest first</option></select></label><span id="cwFilterCount" role="status"></span>';tabs.after(toolbar);
 const editors={};
 function editor(inputId,tableId,label,clearName,view){
  const card=document.getElementById(inputId).closest('.card'),list=document.getElementById(tableId).closest('.card');
  const details=document.createElement('details');details.className='cw-editor';details.id='cw-'+inputId;const summary=document.createElement('summary');summary.textContent=label;details.appendChild(summary);card.replaceWith(details);details.appendChild(card);details.before(list);editors[inputId]=details;
  const button=document.createElement('button');button.type='button';button.className='btn primary small';button.textContent=label;button.onclick=()=>{window[clearName]();window.showTab(view);details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById(inputId).focus({preventScroll:true});};list.querySelector('.cardhead').appendChild(button);
 }
 editor('billName','billsTable','＋ Add bill','clearBillForm','bills');editor('oneName','oneTable','＋ Add one-time item','clearOneTimeForm','oneTime');editor('incomeName','incomeTable','＋ Add income source','clearIncomeForm','income');editor('oneIncomeName','oneIncomeTable','＋ Add one-time income','clearOneTimeIncomeForm','income');
 const advanced=document.createElement('details');advanced.className='cw-advanced';advanced.innerHTML='<summary>Schedule, dates &amp; notes</summary><div class="grid"></div>';const grid=editors.billName.querySelector('.grid');grid.after(advanced);['billType','billCategory','billFrequency','billStart','billEnd','billActive','billNotes'].forEach(id=>{const field=document.getElementById(id)?.closest('.field');if(field)advanced.querySelector('.grid').appendChild(field);});
 const banner=document.querySelector('.wrap > .banner');if(banner){const help=document.createElement('details');help.className='cw-help';help.innerHTML='<summary>Help with paycheck schedules</summary>';help.appendChild(banner);income.appendChild(help);}
 const views={bills:['billsTable'],oneTime:['oneTable'],income:['incomeTable','oneIncomeTable']};let current='bills';const remembered={};
 function apply(){
  const options={search:document.getElementById('cwSearch').value,payment:current==='bills'?document.getElementById('cwPayment').value:'',status:current==='bills'?document.getElementById('cwStatus').value:''},sort=document.getElementById('cwSort').value;
  let shown=0,total=0;
  (views[current]||[]).forEach(id=>{const tbody=document.querySelector('#'+id+' tbody');if(!tbody)return;const records=Array.from(tbody.rows).map(row=>{const c=Array.from(row.cells).map(c=>c.textContent.trim()),amountIndex=id==='billsTable'?2:id==='incomeTable'?1:3,dateIndex=id==='billsTable'?3:id==='incomeTable'?3:2;return{row,text:c.slice(0,-1).join(' '),name:row.cells[0].querySelector('b')?.textContent||c[0],amount:Math.abs(Number((c[amountIndex]||'').replace(/[^0-9.-]/g,''))),date:id==='billsTable'?Number((c[dateIndex]||'').replace(/\D/g,''))||999:c[dateIndex]||'9999',payment:id==='billsTable'&&/autopay/i.test(c[4])?'auto':'manual',status:id==='billsTable'?(row.cells[5].querySelector('.pill')?.textContent||'').trim().toLowerCase():''};});
   api.sortRecords(records,sort).forEach(record=>{const visible=api.matches(record,options);record.row.hidden=!visible;total++;if(visible)shown++;tbody.appendChild(record.row);});
  });
  document.getElementById('cwFilterCount').textContent=shown+' of '+total+' records';
  document.getElementById('cwNoResults').hidden=total===0||shown>0;
 }
 const empty=document.createElement('p');empty.id='cwNoResults';empty.className='cw-no-results';empty.hidden=true;empty.textContent='No matching records. Clear the search or adjust the filters.';toolbar.after(empty);
 const oldShow=window.showTab;window.showTab=function(id){if(current in views)remembered[current]={search:document.getElementById('cwSearch').value,payment:document.getElementById('cwPayment').value,status:document.getElementById('cwStatus').value,sort:document.getElementById('cwSort').value};oldShow(id);current=id;const saved=remembered[id]||{};document.getElementById('cwSearch').value=saved.search||'';document.getElementById('cwPayment').value=saved.payment||'';document.getElementById('cwStatus').value=saved.status||'';document.getElementById('cwSort').value=saved.sort||'name';toolbar.hidden=!(id in views);toolbar.querySelectorAll('[data-cw-bills]').forEach(e=>e.hidden=id!=='bills');empty.hidden=true;apply();};
 for(const [name,input] of [['editBill','billName'],['editOne','oneName'],['editIncome','incomeName'],['editOneTimeIncome','oneIncomeName']]){const original=window[name];window[name]=function(){editors[input].open=true;const result=original.apply(this,arguments);const target=name==='editOne'&&document.getElementById('oneIncomeId').value===arguments[0]?editors.oneIncomeName:editors[input];target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});return result;};}
 for(const name of ['renderBills','renderOne','renderIncome','renderOneTimeIncome']){const original=window[name];window[name]=function(){const result=original.apply(this,arguments);apply();return result;};}
 toolbar.addEventListener('input',apply);toolbar.addEventListener('change',apply);
 window.showTab(['bills','oneTime','income'].includes(location.hash.slice(1))?location.hash.slice(1):'bills');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function matches(record,options){options=options||{};const words=String(options.search||'').toLowerCase().trim().split(/\s+/).filter(Boolean),text=String(record.text||'').toLowerCase();return words.every(w=>text.includes(w))&&(!options.payment||record.payment===options.payment)&&(!options.status||record.status===options.status);}
function sortRecords(records,sort){return records.slice().sort((a,b)=>{if(sort==='amount')return Number(b.amount)-Number(a.amount)||String(a.name).localeCompare(String(b.name));if(sort==='date'){const cmp=typeof a.date==='number'&&typeof b.date==='number'?a.date-b.date:String(a.date).localeCompare(String(b.date));return cmp||String(a.name).localeCompare(String(b.name));}return String(a.name).localeCompare(String(b.name));});}
return{matches,sortRecords};
});
