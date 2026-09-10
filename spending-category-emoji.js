(function(){
'use strict';
if(window.__billsosSpendingCategoryEmoji)return;window.__billsosSpendingCategoryEmoji=true;
var DEFAULTS={
  'Groceries':'🛒','Dining':'🍴','Household / Shopping':'🛍️','Kids':'🧒','Gas / Transportation':'⛽',
  'Personal Care':'💅','Entertainment':'🎬','Financial / Fees':'🏦','Services':'🧰','Gifts':'🎁','Other':'•'
};
var OPTIONS=['🛒','🍴','🛍️','🧒','⛽','💅','🎬','🏦','🧰','🎁','🐾','✈️','🏠','🛠️','🩺','💊','👕','📚','☕','🍕','🚗','🚌','📱','💻','🎮','🎵','🏋️','💇','🧼','🧾','💳','💰','🎉','❤️','📦','•'];
var state={categories:[]};
function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function suggest(name){var s=clean(name).toLowerCase(),rules=[
  [/pet|vet|animal|dog|cat/,'🐾'],[/travel|flight|airline|hotel|vacation/,'✈️'],[/home|house|rent|mortgage/,'🏠'],[/repair|improvement|hardware|tool/,'🛠️'],[/health|medical|doctor|clinic|dental/,'🩺'],[/pharmacy|medicine|medication/,'💊'],[/grocery|food market|supermarket/,'🛒'],[/restaurant|dining|takeout|fast food/,'🍴'],[/coffee|cafe/,'☕'],[/gas|fuel|transport|auto|car/,'⛽'],[/kid|child|school|daycare/,'🧒'],[/gift|present/,'🎁'],[/entertainment|movie|cinema|streaming/,'🎬'],[/game|gaming/,'🎮'],[/music|concert/,'🎵'],[/personal care|beauty|salon|spa/,'💅'],[/hair|barber/,'💇'],[/gym|fitness|workout/,'🏋️'],[/bank|fee|finance|interest/,'🏦'],[/service|contractor/,'🧰'],[/phone|mobile/,'📱'],[/computer|software|tech/,'💻'],[/clothes|clothing|apparel/,'👕'],[/book|education|learning/,'📚'],[/subscription|recurring/,'🔁'],[/party|celebration/,'🎉'],[/shopping|retail|store/,'🛍️']
];for(var i=0;i<rules.length;i++)if(rules[i][0].test(s))return rules[i][1];return '📦'}
function categoryEmoji(name){var custom=(state.categories||[]).find(function(x){return clean(x.category)===clean(name)&&clean(x.emoji)});return custom?clean(custom.emoji):(DEFAULTS[name]||suggest(name))}
function categoryName(details){var n=details.querySelector(':scope>summary .name');if(!n)return '';var copy=n.cloneNode(true),small=copy.querySelector('small');if(small)small.remove();return clean(copy.textContent)}
function applyIcons(){document.querySelectorAll('#cats .cat').forEach(function(cat){var name=categoryName(cat),ico=cat.querySelector(':scope>summary .ico'),next=name?categoryEmoji(name):'';if(name&&ico&&ico.textContent!==next)ico.textContent=next})}
function loadState(){return fetch('/api/spending/category-overrides',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(data){state=data||{categories:[]};applyIcons()}).catch(function(){applyIcons()})}
function pickerOptions(selected){return OPTIONS.map(function(e){return '<option value="'+e+'"'+(e===selected?' selected':'')+'>'+e+'</option>'}).join('')}
function enhanceModal(){var box=document.querySelector('.billsos-txcat-new.on');if(!box||box.dataset.emojiReady==='1')return;box.dataset.emojiReady='1';var category=box.querySelector('[data-role="new-category"]');if(!category)return;var emoji=suggest(category.value),label=document.createElement('label');label.textContent='Emoji';var select=document.createElement('select');select.setAttribute('data-role','new-emoji');select.setAttribute('aria-label','Category emoji');select.innerHTML=pickerOptions(emoji);category.insertAdjacentElement('afterend',select);select.insertAdjacentElement('beforebegin',label);var manual=false;select.addEventListener('change',function(){manual=true});category.addEventListener('input',function(){if(manual)return;var next=suggest(category.value);if(!OPTIONS.includes(next)){var opt=document.createElement('option');opt.value=next;opt.textContent=next;select.appendChild(opt)}select.value=next})}
function observe(){var observer=new MutationObserver(function(mutations){var modalChanged=mutations.some(function(m){var t=m.target&&m.target.nodeType===1?m.target:m.target&&m.target.parentElement;return t&&(t.closest&&t.closest('.billsos-txcat-backdrop')||t.id==='cats'||t.closest&&t.closest('#cats'))});if(!modalChanged)return;enhanceModal();applyIcons()});observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('change',function(e){if(e.target&&e.target.getAttribute('data-role')==='pair')setTimeout(enhanceModal,0)},true)}
window.BillsOSSpendingCategoryEmoji={suggest:suggest,emojiFor:categoryEmoji,enhanceModal:enhanceModal};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){loadState();observe()},{once:true});else{loadState();observe()}
})();
