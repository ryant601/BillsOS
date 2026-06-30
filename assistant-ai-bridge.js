(function(){
  'use strict';
  var BUILD='assistant-ai-bridge-20260630-3';
  var pending=false;

  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.assistantAiBridge={loaded:false,build:BUILD,at:new Date().toISOString(),observing:false,requests:0,successes:0,failures:0,lastStatus:null,lastError:null};

  function status(update){
    window.BillsOSModules.assistantAiBridge=Object.assign(window.BillsOSModules.assistantAiBridge||{},update||{}, {build:BUILD,at:new Date().toISOString()});
  }
  function text(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function escapeHtml(value){return String(value||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function answerHtml(value){
    var safe=escapeHtml(value||'');
    return '<b>BillsOS AI</b><p>'+safe.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>')+'</p><p style="margin-top:8px;color:#64748b;font-size:11px">AI explanation · BillsOS math</p>';
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
    status({requests:(window.BillsOSModules.assistantAiBridge.requests||0)+1,lastQuestion:question,lastLocal:local.slice(0,300),lastError:null});
    try{
      var response=await fetch('/api/assistant',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({question:question,deterministicAnswer:local})
      });
      status({lastStatus:response.status});
      var payload=await response.json().catch(function(){return {};});
      if(!response.ok){
        status({failures:(window.BillsOSModules.assistantAiBridge.failures||0)+1,lastError:(payload&&payload.error)||('HTTP '+response.status)});
        return;
      }
      if(payload&&payload.answer){
        node.innerHTML=answerHtml(payload.answer);
        status({successes:(window.BillsOSModules.assistantAiBridge.successes||0)+1,lastMode:payload.mode||'openai',lastModel:payload.model||null,lastAnswer:String(payload.answer).slice(0,300)});
      }else{
        status({failures:(window.BillsOSModules.assistantAiBridge.failures||0)+1,lastError:'No answer returned'});
      }
    }catch(err){
      status({failures:(window.BillsOSModules.assistantAiBridge.failures||0)+1,lastError:String(err&&err.message||err)});
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
          if(node&&node.nodeType===1&&node.classList&&node.classList.contains('billsos-msg'))setTimeout(function(){enhance(node);},80);
        });
      });
    }).observe(log,{childList:true});
    status({loaded:true,observing:true});
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
