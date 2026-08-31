(function(){
  'use strict';
  var BALANCE_AS_OF='2026-08-31T10:45:26.525184Z';
  var TRANSACTIONS_QUERIED_AT='2026-08-31T10:58:22Z';
  var TRANSACTION_FRESHNESS='unknown';

  function formatAsOf(iso){
    try{
      return new Intl.DateTimeFormat('en-US',{
        timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',
        hour:'numeric',minute:'2-digit',timeZoneName:'short'
      }).format(new Date(iso));
    }catch(_e){return iso;}
  }

  function install(){
    if(document.getElementById('spendingBankingStamp'))return;
    var anchor=document.querySelector('.muted,.subtle');
    if(!anchor)return;
    var stamp=document.createElement('div');
    stamp.id='spendingBankingStamp';
    stamp.className='spending-banking-stamp';
    stamp.innerHTML='<span class="spending-live-dot"></span><strong>Bank balance as of '+formatAsOf(BALANCE_AS_OF)+'</strong>'+ 
      '<span class="spending-freshness-note">Transactions queried '+formatAsOf(TRANSACTIONS_QUERIED_AT)+(TRANSACTION_FRESHNESS==='unknown'?' · banking transaction freshness unavailable':'')+'</span>';
    anchor.insertAdjacentElement('afterend',stamp);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
