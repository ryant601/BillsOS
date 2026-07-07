(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BillsOSCashflow=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  var YEAR=2026,FLOOR=1000,FIRST_BEGIN=3671;
  var MONTHS=[['june',6,'June'],['july',7,'July'],['august',8,'August'],['september',9,'September'],['october',10,'October'],['november',11,'November'],['december',12,'December']];
  var SHORT={jun:'june',june:'june',jul:'july',july:'july',aug:'august',august:'august',sep:'september',sept:'september',september:'september',oct:'october',october:'october',nov:'november',november:'november',dec:'december',december:'december'};
  function norm(x){x=x&&typeof x==='object'?x:{};return{bills:Array.isArray(x.bills)?x.bills:[],income:Array.isArray(x.income)?x.income:[],oneTimeEvents:Array.isArray(x.oneTimeEvents)?x.oneTimeEvents:[],updatedAt:x.updatedAt||null};}
  function days(month){return new Date(YEAR,month,0).getDate();}
  function iso(month,day){return YEAR+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
  function today(){var d=new Date();d.setHours(0,0,0,0);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function addDays(value,count){var d=new Date(value+'T12:00:00');d.setDate(d.getDate()+count);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function dollars(n){return n==null||isNaN(n)?'—':'$'+Number(Math.max(0,n)).toLocaleString(undefined,{maximumFractionDigits:0});}
  function signed(n){return (n<0?'−':'')+'$'+Math.abs(Number(n||0)).toLocaleString(undefined,{maximumFractionDigits:0});}
  function fmt(value){return value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—';}
  function monthByName(name){name=SHORT[String(name||'').toLowerCase().replace(/[^a-z]/g,'')];return MONTHS.find(function(x){return x[0]===name;})||null;}
  function monthFromIso(value){var month=Number(String(value||'').slice(5,7));return MONTHS.find(function(x){return x[1]===month;})||null;}
  function scopeFromQuestion(question){
    var s=String(question||'').toLowerCase(),now=today(),token=(s.match(/\b(jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/)||[])[1],mm=monthByName(token);
    if(mm)return{start:iso(mm[1],1),end:iso(mm[1],days(mm[1])),label:mm[2],month:mm[0]};
    if(/next month/.test(s)){var d=new Date(now+'T12:00:00');d.setMonth(d.getMonth()+1);mm=MONTHS.find(function(x){return x[1]===d.getMonth()+1;});if(mm)return{start:iso(mm[1],1),end:iso(mm[1],days(mm[1])),label:mm[2],month:mm[0]};}
    if(/this month/.test(s)){mm=monthFromIso(now);if(mm)return{start:now,end:iso(mm[1],days(mm[1])),label:mm[2],month:mm[0]};}
    var m=s.match(/(?:next|within|in)\s+(\d+)\s*(day|days|week|weeks|month|months)/),n=21;
    if(m)n=Number(m[1])*(m[2].indexOf('week')===0?7:m[2].indexOf('month')===0?30:1);else if(/two weeks|2 weeks/.test(s))n=14;else if(/week/.test(s))n=7;else if(/month/.test(s))n=30;
    return{start:now,end:addDays(now,n),label:'next '+n+' days'};
  }
  function parseAmount(question){var s=String(question||''),m=s.match(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/)||s.match(/(?:pay|payment|spend|buy|afford|for)\s+([0-9][0-9,]*(?:\.\d{1,2})?)/i);return m?Number(m[1].replace(/,/g,'')):0;}
  function rules(){return{spendingFunding:{enabled:false,amount:0,count:0,timing:'disabled'},sweep:{enabled:false,targets:{}}};}
  function oneDates(item,monthValue){var out=[],matches=String(item.notes||'').match(/20\d{2}-\d{2}-\d{2}/g)||[];matches.forEach(function(d){if(d.slice(0,7)===monthValue&&!out.includes(d))out.push(d);});if(!out.length&&item.date&&String(item.date).slice(0,7)===monthValue)out.push(item.date);return out;}
  function safeAmount(rows,begin,day,requested,dim){var by={},bal=Number(begin||0),min=null;rows.forEach(function(x){by[x.day]=(by[x.day]||0)+Number(x.amount||0);});for(var d=1;d<=dim;d++){bal+=Number(by[d]||0);if(d>=day)min=min===null?bal:Math.min(min,bal);}return Math.max(0,Math.min(Math.abs(Number(requested||0)),Math.floor(Number(min||0)*100)/100));}
  function rowsForMonth(raw,month,begin){
    var data=norm(raw),monthValue=YEAR+'-'+String(month).padStart(2,'0'),dim=days(month),rows=[];
    function push(day,name,amount,cls,type){day=Number(day||0);if(day>=1&&day<=dim)rows.push({iso:iso(month,day),day:day,name:name||'Item',amount:Number(amount||0),cls:cls||'out',type:type||''});}
    data.bills.forEach(function(b){if(b.active===false)return;var frequency=b.frequency||'monthly';if(frequency!=='monthly'||b.startMonth&&b.startMonth>monthValue||b.endMonth&&b.endMonth<monthValue)return;push(Math.min(Number(b.dueDay||1),dim),b.name||'Bill',-Math.abs(Number(b.amount||0)),'out',b.payMethod||b.paymentMethod||b.type);});
    data.oneTimeEvents.forEach(function(o){if(!o||/^__billsos_/.test(String(o.id||'')))return;oneDates(o,monthValue).forEach(function(dt){var amount=Number(o.amount||0),income=o.type==='income';push(Number(dt.slice(8,10)),o.name||'One-time item',income?Math.abs(amount):-Math.abs(amount),income?'in':'out',o.type);});});
    data.income.forEach(function(i){if(i.active===false)return;var amount=Math.abs(Number(i.amount||0)),name=i.name||'Income',schedule=i.schedule||'manual';if(!amount)return;if(schedule==='semi-monthly-15-30'){push(15,name,amount,'in','income');push(Math.min(30,dim),name,amount,'in','income');}else if(schedule==='biweekly'){[1,15,29].forEach(function(day){if(day<=dim)push(day,name,amount,'in','income');});}else push(1,name,amount,'in','income');});
    var rr=rules(),sp=rr.spendingFunding;if(sp.enabled!==false&&Number(sp.amount)>0){var incDays=rows.filter(function(x){return x.amount>0&&/alissa|humc/i.test(x.name);}).map(function(x){return x.day;}).sort(function(a,b){return a-b;});if(!incDays.length)incDays=rows.filter(function(x){return x.amount>0;}).map(function(x){return x.day;}).sort(function(a,b){return a-b;});for(var i=0;i<Number(sp.count||0);i++){var base=sp.timing==='fixed-1-15'?(i?15:1):(incDays[i]||[1,15,29][i]||1),fund=safeAmount(rows,begin,base,sp.amount,dim);if(fund>0)push(base,'Spending account funding',-fund,'out system','rule');}}
    var sw=rr.sweep,target=sw.targets&&sw.targets[monthValue],existingSweep=rows.some(function(row){return row.amount<0&&/sweep/i.test(row.name);});if(sw.enabled!==false&&monthValue!=='2026-06'&&!existingSweep){var req=target?Number(target.amount||0):Number(begin||0)+rows.reduce(function(sum,row){return sum+Number(row.amount||0);},0)-Number(sw.preferredBuffer||0);if(req>0){var day=Math.min(dim,Number(target&&target.day||sw.day||28)),amt=safeAmount(rows,begin,day,req,dim);if(amt>0)push(day,target&&target.label||sw.label||'Sweep transfer',-amt,'out system','rule');}}
    return rows.sort(function(a,b){return a.iso.localeCompare(b.iso)||b.amount-a.amount;});
  }
  function build(raw,options){var data=norm(raw),opts=options||{},floorNegative=opts.floorNegative!==false,balances=[],events=[],months={},bal=Number(opts.firstBegin==null?FIRST_BEGIN:opts.firstBegin);MONTHS.forEach(function(mm){var begin=bal,rows=rowsForMonth(data,mm[1],begin),run=begin;rows.forEach(function(r){events.push({iso:r.iso,name:r.name,amount:r.amount,amountText:dollars(Math.abs(r.amount)),cls:r.cls,type:r.type,done:false});});for(var day=1;day<=days(mm[1]);day++){rows.filter(function(r){return r.day===day;}).forEach(function(r){run+=r.amount;});if(floorNegative&&run<0)run=0;balances.push({iso:iso(mm[1],day),balance:run});}months[mm[0]]={name:mm[2],number:mm[1],begin:begin,end:run,rows:rows};bal=run;});return{balances:balances,events:events,months:months,updatedAt:data.updatedAt||null};}
  function inScope(model,scope){return{balances:(model&&model.balances||[]).filter(function(x){return x.iso>=scope.start&&x.iso<=scope.end;}),events:(model&&model.events||[]).filter(function(x){return x.iso>=scope.start&&x.iso<=scope.end;})};}
  function isIncome(event){return event.amount>0||/\bin\b/.test(' '+(event.cls||'')+' ');}
  function openEvents(model,scope){return inScope(model,scope).events.filter(function(e){return !/\bnote\b/.test(' '+(e.cls||'')+' ')&&!e.done;});}
  function lowBalance(model,scope){return inScope(model,scope).balances.reduce(function(a,b){return !a||b.balance<a.balance?b:a;},null);}
  function bestPaymentDay(model,amount,scope,options){var floor=Number((options&&options.floor)||FLOOR),ev=openEvents(model,scope),ds=inScope(model,scope).balances;if(!ds.length)return null;return ds.map(function(d){var near=ev.filter(function(e){var diff=Math.round((new Date(e.iso+'T12:00:00')-new Date(d.iso+'T12:00:00'))/86400000);return !isIncome(e)&&Math.abs(e.amount)>=300&&Math.abs(diff)<=3;}),same=ev.filter(function(e){return e.iso===d.iso&&!isIncome(e);}),after=Math.max(0,d.balance-amount),buffer=after-floor,hasRecentIncome=ev.some(function(e){var diff=Math.round((new Date(d.iso+'T12:00:00')-new Date(e.iso+'T12:00:00'))/86400000);return isIncome(e)&&diff>=0&&diff<=3;}),wknd=[0,6].indexOf(new Date(d.iso+'T12:00:00').getDay())>-1,score=buffer+(hasRecentIncome?225:0)-near.length*175-same.length*90-(wknd?40:0);return{iso:d.iso,balance:d.balance,after:after,buffer:buffer,near:near,score:score};}).sort(function(a,b){return b.score-a.score;})[0];}
  return{BUILD:'cashflow-engine-20260707-no-hidden-rules',YEAR:YEAR,FLOOR:FLOOR,FIRST_BEGIN:FIRST_BEGIN,MONTHS:MONTHS,norm:norm,build:build,rowsForMonth:rowsForMonth,scopeFromQuestion:scopeFromQuestion,parseAmount:parseAmount,inScope:inScope,openEvents:openEvents,lowBalance:lowBalance,bestPaymentDay:bestPaymentDay,isIncome:isIncome,dollars:dollars,signed:signed,fmt:fmt,addDays:addDays,today:today};
});
