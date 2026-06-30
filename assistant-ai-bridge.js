(function(){
  'use strict';
  var BUILD='assistant-ai-bridge-20260629-1';
  var pending=false;

  window.BillsOSModules=window.BillsOSModules||{};

  function text(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function escapeHtml(value){return String(value||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function answerHtml(value){
    var safe=escapeHtml(value||'');
    return '<b>BillsOS</b><p>'+safe.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';
  }
  function lastUserMessage(beforeNode){
    var node=beforeNode&&beforeNode.previousElementSibling;
    while(node){
      if(node.classList&&node.classList.contains('user'))return text(node.textContent);
      node=node.previousElementSibling;
    }
    return '';
  }
  async function enhance(node){
    if(pending||!node||!node.classList||node.classList.contains('user')||node.dataset.aiBridge==='1')return;
    var local=text(node.textContent);
    if(!local||/checking/i.test(local)||/loading billsos data/i.test(local))return;
    var question=lastUserMessage(node);
    if(!question)return;
    pending=true;
    node.dataset.aiBridge='1';
    try{
      var response=await fetch('/api/assistant',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({question:question,deterministicAnswer:local})
      });
      if(!response.ok)return;
      var payload=await response.json();
      if(payload&&payload.answer)node.innerHTML=answerHtml(payload.answer);
    }catch(_err){
      // Keep the deterministic local answer.
    }finally{
      pending=false;
    }
  }
  function observe(){
    var log=document.getElementById('billsosAiLog');
    if(!log)return false;
    new MutationObserver(function(records){
      records.forEach(function(record){
        Array.prototype.forEach.call(record.addedNodes||[],function(node){
          if(node&&node.nodeType===1&&node.classList&&node.classList.contains('billsos-msg'))setTimeout(function(){enhance(node);},30);
        });
      });
    }).observe(log,{childList:true});
    window.BillsOSModules.assistantAiBridge={loaded:true,build:BUILD,at:new Date().toISOString()};
    return true;
  }
  function init(){
    if(observe())return;
    setTimeout(observe,500);
    setTimeout(observe,1500);
    setTimeout(observe,3000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
