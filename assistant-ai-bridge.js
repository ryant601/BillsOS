(function(){
  'use strict';
  var BUILD='assistant-ai-bridge-20260630-7';
  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.assistantAiBridge={loaded:true,build:BUILD,at:new Date().toISOString(),observing:false,requests:0,successes:0,failures:0,lastStatus:'disabled-for-calculated-answers',lastError:null};
  function mark(node){
    if(!node||!node.classList||node.classList.contains('user')||node.dataset.aiBridge==='1')return;
    var text=String(node.textContent||'').replace(/\s+/g,' ').trim();
    if(!text||/checking billsos/i.test(text)||/ask:\s*“?lowest balance/i.test(text))return;
    node.dataset.aiBridge='1';
    if(!node.querySelector('.billsos-ai-source')){
      var p=document.createElement('p');
      p.className='billsos-ai-source';
      p.style.cssText='margin-top:8px;color:#64748b;font-size:11px';
      p.textContent='AI parsed question · BillsOS math';
      node.appendChild(p);
    }
  }
  function scan(){document.querySelectorAll('#billsosAiLog .billsos-msg:not(.user)').forEach(mark);}
  function observe(){
    var log=document.getElementById('billsosAiLog');
    if(!log)return false;
    new MutationObserver(function(records){records.forEach(function(record){Array.prototype.forEach.call(record.addedNodes||[],function(node){if(node&&node.nodeType===1&&node.classList&&node.classList.contains('billsos-msg'))setTimeout(function(){mark(node);},50);});});}).observe(log,{childList:true,subtree:false});
    window.BillsOSModules.assistantAiBridge={loaded:true,build:BUILD,at:new Date().toISOString(),observing:true,requests:0,successes:0,failures:0,lastStatus:'calculated-answers-not-rewritten',lastError:null};
    scan();
    return true;
  }
  function init(){if(observe())return;setTimeout(observe,500);setTimeout(observe,1500);setTimeout(observe,3000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
