(function(){
  'use strict';
  function easternDay(date){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    var values={};parts.forEach(function(part){values[part.type]=part.value});
    return values.year+'-'+values.month+'-'+values.day;
  }
  function install(){
    var anchor=document.getElementById('fresh');
    if(!anchor||document.getElementById('spendingRefreshNotice'))return;
    fetch('/spending/current.json?freshness='+Date.now(),{cache:'no-store'}).then(function(response){
      if(!response.ok)throw new Error('snapshot unavailable');
      return response.json();
    }).then(function(snapshot){
      var asOf=snapshot&&snapshot.freshness&&snapshot.freshness.balanceAsOf;
      var next=snapshot&&snapshot.cycle&&snapshot.cycle.nextTransfer;
      var asOfTime=Date.parse(asOf);
      var today=easternDay(new Date());
      var overdue=typeof next==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(next)&&today>=next;
      var old=!Number.isFinite(asOfTime)||Date.now()-asOfTime>36*60*60*1000;
      if(!overdue&&!old)return;
      var notice=document.createElement('div');notice.id='spendingRefreshNotice';notice.className='spending-refresh-notice';
      notice.textContent=overdue?'The next transfer date has passed. This is the last verified spending cycle; a new cycle has not been confirmed yet.':'Banking data is over 36 hours old. This is the last published spending report.';
      anchor.insertAdjacentElement('afterend',notice);
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
