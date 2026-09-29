(function(){
'use strict';
if(window.__billsosTransactionRecategorize)return;window.__billsosTransactionRecategorize=true;
var session=null,modal=null,sourceRows=[],classificationRules=null,categoryState=null,rowsPromise=null,saving=false;
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function cents(v){return Math.round(Number(v||0)*100)}
function money(v){return (Number(v)<0?'−':'')+'$'+Math.abs(Number(v)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(v){return String(v||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
function embeddedRows(){try{return typeof T!=='undefined'&&Array.isArray(T)?T:[]}catch(_err){return []}}
function rawRows(){var embedded=embeddedRows();return embedded.length?embedded:sourceRows}
function loadRows(){if(embeddedRows().length)return Promise.resolve();return fetch('/spending/current.json?txcat='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('The current spending report could not be loaded.');return r.json()}).then(function(data){sourceRows=Array.isArray(data&&data.transactions)?data.transactions:[];if(!sourceRows.length)throw new Error('The current spending report has no transactions.')})}
function loadClassificationRules(){return fetch('/spending/vendor-category-rules.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(data){classificationRules=data}).catch(function(){classificationRules=null})}
function loadCategoryState(){return fetch('/api/spending/category-overrides?txcat='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Categories could not be loaded.');return r.json()}).then(function(data){categoryState=data||{categories:[],overrides:[]};return categoryState})}
function overrideKey(item){var m=item&&item.match||{};return clean(m.date)+'|'+clean(m.merchant)+'|'+cents(m.amount)+'|'+Number(m.occurrence||1)}
function rows(){try{var seen={},result=rawRows().map(function(x){var row={date:clean(x.date),merchant:clean(x.m),amount:Number(x.a),pending:x.p===true,category:clean(x.c),subcategory:clean(x.s),note:clean(x.n)},key=row.date+'|'+row.merchant+'|'+cents(row.amount);row.occurrence=(seen[key]||0)+1;seen[key]=row.occurrence;row.stableKey=key+'|'+row.occurrence;return row}),classifier=window.BillsOSSpendingClassifications;if(classifier)result=classifier.apply(result,classificationRules);var map={};((categoryState&&categoryState.overrides)||[]).forEach(function(item){map[overrideKey(item)]=item});return result.map(function(row){var saved=map[row.stableKey];return saved?Object.assign({},row,{category:clean(saved.category),subcategory:clean(saved.subcategory),overrideId:saved.id}):row})}catch(_err){return []}}
function dateLabel(date){try{return new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch(_err){return date}}
function dateMatches(first,text,date){return first===date||first===date.slice(5)||first===dateLabel(date)||text.indexOf(date)>=0}
function rowAmount(node){var el=node.querySelector('.amt');if(!el)return null;var text=clean(el.textContent).replace(/,/g,'').replace(/−/g,'-'),m=text.match(/-?\$?([0-9]+(?:\.[0-9]+)?)/);return m?Number((/^\s*-/.test(text)?'-':'')+m[1]):null}
function findTransaction(node){var all=rows(),first=clean((node.children[0]||{}).textContent),text=clean(node.textContent),amount=rowAmount(node);if(amount===null)return {error:'Could not read this transaction amount.'};var matches=all.filter(function(t){return cents(t.amount)===cents(amount)&&text.indexOf(t.merchant)>=0&&dateMatches(first,text,t.date)});if(matches.length===1)return {transaction:matches[0]};if(!matches.length)return {error:'This transaction could not be matched to the current spending report.'};var occurrence=Number(node.dataset&&node.dataset.txOccurrence);if(Number.isInteger(occurrence)&&occurrence>0){var marked=matches.find(function(t){return t.occurrence===occurrence});if(marked)return {transaction:marked}}var siblings=[].slice.call(node.parentElement&&node.parentElement.querySelectorAll?node.parentElement.querySelectorAll(':scope > .row'):[]).filter(function(row){var rowText=clean(row.textContent),rowFirst=clean((row.children[0]||{}).textContent),rowValue=rowAmount(row);return rowValue!==null&&cents(rowValue)===cents(amount)&&rowText.indexOf(matches[0].merchant)>=0&&dateMatches(rowFirst,rowText,matches[0].date)}),index=siblings.indexOf(node);if(index>=0&&siblings.length===matches.length)return {transaction:matches[index]};return {error:'More than one transaction matches this row, so BillsOS will not guess.'}}
function pairs(){var seen={},out=[];function add(category,subcategory){category=clean(category);subcategory=clean(subcategory);if(!category||!subcategory)return;var key=category+'|'+subcategory;if(!seen[key]){seen[key]=1;out.push({category:category,subcategory:subcategory})}}rows().forEach(function(t){add(t.category,t.subcategory)});((categoryState&&categoryState.categories)||[]).forEach(function(item){add(item.category,item.subcategory)});((categoryState&&categoryState.overrides)||[]).forEach(function(item){add(item.category,item.subcategory)});return out.sort(function(a,b){return (a.category+' '+a.subcategory).localeCompare(b.category+' '+b.subcategory)})}
function close(){if(saving)return;if(modal){modal.remove();modal=null}}
function verifySaved(saved,category,subcategory){return loadCategoryState().then(function(data){var list=Array.isArray(data&&data.overrides)?data.overrides:[],found=list.find(function(item){return item&&item.id===saved.id});if(!found||clean(found.category)!==clean(category)||clean(found.subcategory)!==clean(subcategory))throw new Error('The category selection was not confirmed after saving.');return found})}
function installStyle(){if(document.getElementById('billsosTxRecategorizeStyle'))return;var s=document.createElement('style');s.id='billsosTxRecategorizeStyle';s.textContent='.tx .row{cursor:pointer}.tx .row:hover{background:rgba(31,91,72,.045)}.billsos-txcat-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(15,24,28,.32);display:grid;place-items:center;padding:18px}.billsos-txcat-modal{width:min(430px,100%);background:var(--p,#fffdf9);color:var(--i,#17372f);border:1px solid var(--l,#ddd5c9);border-radius:18px;padding:16px;box-shadow:0 24px 70px rgba(0,0,0,.24)}.billsos-txcat-modal h3{margin:0 0 4px;font-size:18px}.billsos-txcat-meta{font-size:12px;color:var(--m,#77736d);margin-bottom:14px}.billsos-txcat-modal label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin:10px 0 5px}.billsos-txcat-modal select,.billsos-txcat-modal input{width:100%;padding:10px;border:1px solid var(--l,#ddd5c9);border-radius:10px;background:var(--p2,#f8f4ed);color:inherit;font:inherit}.billsos-txcat-new{display:none;margin-top:10px;padding:10px;border:1px dashed var(--l,#ddd5c9);border-radius:12px}.billsos-txcat-new.on{display:block}.billsos-txcat-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:15px}.billsos-txcat-actions button{border:1px solid var(--l,#ddd5c9);border-radius:999px;background:var(--p,#fffdf9);color:inherit;padding:8px 12px;font-weight:800;cursor:pointer}.billsos-txcat-actions .primary{background:var(--g,#0f513e);color:#fff;border-color:transparent}.billsos-txcat-msg{font-size:11px;color:var(--m,#77736d);margin-top:10px;min-height:16px}html[data-billsos-theme="dark"] .billsos-txcat-modal{background:#1B2025;color:#F2F4F3;border-color:#30383D}html[data-billsos-theme="dark"] .billsos-txcat-modal select,html[data-billsos-theme="dark"] .billsos-txcat-modal input,html[data-billsos-theme="dark"] .billsos-txcat-actions button{background:#22282D;color:#F2F4F3;border-color:#30383D}';document.head.appendChild(s)}
function saveSelection(t,category,subcategory,creating,emoji,msg,pairSelect,btn){
  if(saving)return Promise.resolve();
  category=clean(category);subcategory=clean(subcategory);
  if(!category||!subcategory){msg.textContent='Enter both a category and subcategory.';return Promise.resolve()}
  if(!creating&&category===t.category&&subcategory===t.subcategory){msg.textContent='That transaction is already in this category.';return Promise.resolve()}
  saving=true;if(btn){btn.disabled=true;btn.textContent='Applying…'}if(pairSelect)pairSelect.disabled=true;
  msg.textContent=creating?'Creating category…':'Applying category…';
  var payload={transaction:{date:t.date,merchant:t.merchant,amount:t.amount,pending:t.pending,note:t.note,occurrence:t.occurrence},category:category,subcategory:subcategory,createCategory:!!creating};
  if(creating&&emoji)payload.emoji=emoji;
  return fetch('/api/spending/category-overrides',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(data){if(!r.ok)throw new Error(data.error||'The category change could not be saved.');return data})})
    .then(function(saved){return verifySaved(saved,category,subcategory)})
    .then(function(found){
      var key=t.stableKey;
      if(!categoryState)categoryState={categories:[],overrides:[]};
      categoryState.overrides=(categoryState.overrides||[]).filter(function(item){return overrideKey(item)!==key}).concat(found);
      t.category=category;t.subcategory=subcategory;t.overrideId=found.id;
      msg.textContent='Saved ✓';
      if(btn){btn.textContent='Saved ✓'}
      document.dispatchEvent(new CustomEvent('billsos:spending-category-changed',{detail:categoryState}));
      setTimeout(function(){location.href='/spending/?category='+Date.now()},650);
      return found;
    })
    .catch(function(err){
      saving=false;
      if(btn){btn.disabled=false;btn.textContent=creating?'Create and apply':'Apply category'}
      if(pairSelect)pairSelect.disabled=false;
      msg.textContent=(err&&err.message)||'The category change could not be saved.';
      throw err;
    })
}
function openFor(node){
  var found=findTransaction(node);
  if(found.error){alert(found.error);return}
  if(!session||session.role!=='owner'){alert('Recategorization requires an Owner sign-in.');return}
  var t=found.transaction,options=pairs(),current=t.category+'|'+t.subcategory;
  close();
  modal=document.createElement('div');
  modal.className='billsos-txcat-backdrop';
  modal.innerHTML='<div class="billsos-txcat-modal" role="dialog" aria-modal="true" aria-label="Recategorize transaction"><h3>Recategorize transaction</h3><div class="billsos-txcat-meta">'+esc(t.merchant)+' · '+money(t.amount)+' · '+esc(dateLabel(t.date))+' · '+(t.pending?'Pending':'Posted')+'</div><label>Category</label><select data-role="pair">'+options.map(function(p){var v=p.category+'|'+p.subcategory;return '<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(p.category)+' — '+esc(p.subcategory)+'</option>'}).join('')+'<option value="__new__">+ Create new category…</option></select><div class="billsos-txcat-new" data-role="new-fields"><label>New category</label><input data-role="new-category" maxlength="60" placeholder="e.g. Pets"><label>Subcategory</label><input data-role="new-subcategory" maxlength="60" placeholder="e.g. Veterinary"></div><div class="billsos-txcat-msg" role="status" aria-live="polite">Choose a category, then select Apply category.</div><div class="billsos-txcat-actions"><button type="button" data-action="cancel">Cancel</button><button type="button" class="primary" data-action="save">Apply category</button></div></div>';
  document.body.appendChild(modal);
  var pairSelect=modal.querySelector('[data-role="pair"]'),newFields=modal.querySelector('[data-role="new-fields"]'),msg=modal.querySelector('.billsos-txcat-msg'),saveBtn=modal.querySelector('[data-action="save"]');
  pairSelect.addEventListener('change',function(){
    var selected=String(this.value||''),creating=selected==='__new__';
    newFields.classList.toggle('on',creating);
    saveBtn.textContent=creating?'Create and apply':'Apply category';
    if(creating){
      var emojiApi=window.BillsOSSpendingCategoryEmoji;
      if(emojiApi&&typeof emojiApi.enhanceModal==='function')emojiApi.enhanceModal();
      msg.textContent='Enter the new category details, then select Create and apply.';
      setTimeout(function(){var input=modal&&modal.querySelector('[data-role="new-category"]');if(input)input.focus()},0);
      return;
    }
    var parts=selected.split('|');
    msg.textContent='Ready to move this transaction to '+clean(parts[0])+' — '+clean(parts.slice(1).join('|'))+'.';
  });
  modal.addEventListener('click',function(e){
    var action=e.target&&e.target.dataset&&e.target.dataset.action;
    if(e.target===modal||action==='cancel'){close();return}
    if(action!=='save')return;
    var selected=String(pairSelect.value||''),creating=selected==='__new__',category='',subcategory='',emoji=null;
    if(creating){
      category=clean(modal.querySelector('[data-role="new-category"]').value);
      subcategory=clean(modal.querySelector('[data-role="new-subcategory"]').value);
      var emojiField=modal.querySelector('[data-role="new-emoji"]'),emojiApi=window.BillsOSSpendingCategoryEmoji;
      emoji=clean(emojiField&&emojiField.value)||(emojiApi&&typeof emojiApi.suggest==='function'?emojiApi.suggest(category):null);
    }else{
      var parts=selected.split('|');
      category=clean(parts[0]);
      subcategory=clean(parts.slice(1).join('|'));
    }
    saveSelection(t,category,subcategory,creating,emoji,msg,pairSelect,saveBtn).catch(function(){});
  });
}
function boot(){installStyle();rowsPromise=Promise.all([loadRows(),loadClassificationRules(),loadCategoryState()]);fetch('/api/session',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(v){session=v}).catch(function(){});document.addEventListener('click',function(e){var row=e.target.closest&&e.target.closest('.tx .row');if(row)Promise.resolve(rowsPromise).then(function(){openFor(row)}).catch(function(err){alert((err&&err.message)||'The current spending report could not be loaded.')})},false);document.addEventListener('keydown',function(e){if(e.key==='Escape')close()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();