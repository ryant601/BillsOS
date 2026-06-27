(function(){
  var RULE_ID='__billsos_system_rules__';
  var DEFAULT_SWEEP_TARGETS={
    '2026-07':{day:31,amount:705.05,label:'Sweep to savings / debt'}
  };
  function mergeTargets(existing){
    var out=Object.assign({}, DEFAULT_SWEEP_TARGETS);
    existing=existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{};
    Object.keys(existing).forEach(function(k){out[k]=existing[k];});
    return out;
  }
  async function ensureSweepTargets(){
    try{
      var r=await fetch('/api/bills?sweepTargets='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      var data=await r.json();
      data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];
      var row=data.oneTimeEvents.find(function(x){return x&&x.id===RULE_ID;});
      var rules={};
      if(row&&row.notes){try{rules=JSON.parse(row.notes)||{};}catch(e){rules={};}}
      rules.sweep=rules.sweep&&typeof rules.sweep==='object'?rules.sweep:{};
      var targets=mergeTargets(rules.sweep.targets);
      if(JSON.stringify(rules.sweep.targets||{})===JSON.stringify(targets))return;
      rules.sweep.targets=targets;
      if(row){row.notes=JSON.stringify(rules);}else{data.oneTimeEvents.push({id:RULE_ID,name:'BillsOS system rules',date:'2099-12-31',amount:0,type:'transfer',notes:JSON.stringify({sweep:{targets:targets}})});}
      await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    }catch(e){}
  }
  ensureSweepTargets();
})();
