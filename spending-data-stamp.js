(function(){
  'use strict';
  var BALANCE_AS_OF='2026-09-19T01:48:26.518991Z';
  var TRANSACTION_FRESHNESS='unknown';
  var PUBLISH_RUN='2026-09-19T07:03:02-04:00';
  function formatAsOf(iso){try{return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(iso));}catch(_e){return iso;}}
  function install(){if(document.getElementById('spendingBankingStamp'))return;var anchor=document.querySelector('.muted,.subtle');if(!anchor)return;var stamp=document.createElement('div');stamp.id='spendingBankingStamp';stamp.className='spending-banking-stamp';stamp.innerHTML='<span class="spending-live-dot"></span><strong>Bank balance as of '+formatAsOf(BALANCE_AS_OF)+'</strong><span class="spending-freshness-note">'+(TRANSACTION_FRESHNESS==='unknown'?'Transaction banking freshness unknown':'Transactions freshness available')+'</span>';anchor.insertAdjacentElement('afterend',stamp);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();