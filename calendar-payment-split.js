(function(root,factory){
if(typeof module==='object'&&module.exports)module.exports=factory();else root.BillsOSCalendarSplit=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

function clone(value){return JSON.parse(JSON.stringify(value||{}));}
function validDate(value){return /^20\d{2}-\d{2}-\d{2}$/.test(String(value||''));}
function cents(value){return Math.round(Math.abs(Number(value||0))*100);}
function eventDates(item){return [item&&item.date,item&&item.iso,item&&item.startDate,item&&item.effectiveDate].filter(validDate);}
function normalizedOneAmount(item){var raw=Number(item&&((item.amount!=null)?item.amount:item.value)||0),type=String(item&&item.type||'').toLowerCase(),name=String(item&&item.name||''),correction=/correction|adjustment/.test(type)||/correction|adjustment/i.test(name);return correction?raw:(type==='income'?Math.abs(raw):-Math.abs(raw));}
function note(row,message){var current=String(row.notes||'').trim();if(current.indexOf(message)<0)row.notes=current?(current+' · '+message):message;}
function uid(){return 'calendar-split-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}

function applySplit(raw,request){
  var input=request||{},name=String(input.name||'').trim(),originalDate=String(input.originalDate||''),originalCents=cents(input.originalAmount),parts=Array.isArray(input.parts)?input.parts:[];
  if(!name||!validDate(originalDate)||!originalCents)return{ok:false,error:'The original payment could not be identified.'};
  if(parts.length<2)return{ok:false,error:'Add at least two split payments.'};
  var cleaned=parts.map(function(part){return{date:String(part&&part.date||''),amountCents:cents(part&&part.amount)};});
  if(cleaned.some(function(part){return!validDate(part.date)||part.date<'2026-06-01'||part.date>'2027-12-31'||!part.amountCents;}))return{ok:false,error:'Each split needs a date and an amount inside the visible calendar.'};
  var splitTotal=cleaned.reduce(function(sum,part){return sum+part.amountCents;},0),expected=cents(input.totalAmount);
  if(splitTotal!==expected)return{ok:false,error:'Split payments must add up to the original total.'};

  var data=clone(raw),one=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[],bills=Array.isArray(data.bills)?data.bills:[],source=null,sourceKind='',index=-1;
  index=one.findIndex(function(item){return String(item&&item.name||item&&item.label||item&&item.title||'One-time item')===name&&eventDates(item).indexOf(originalDate)>=0&&cents(normalizedOneAmount(item))===originalCents;});
  if(index>=0){source=one[index];one.splice(index,1);sourceKind='one-time item';}
  if(!source){
    index=bills.findIndex(function(item){var month=originalDate.slice(0,7),day=Number(originalDate.slice(8,10)),dim=new Date(Number(originalDate.slice(0,4)),Number(originalDate.slice(5,7)),0).getDate();return item&&item.active!==false&&String(item.name||'Bill')===name&&cents(item.amount)===originalCents&&Math.min(Number(item.dueDay||1),dim)===day&&(!item.startMonth||item.startMonth<=month)&&(!item.endMonth||item.endMonth>=month);});
    if(index>=0){source=bills[index];source.excludedDates=Array.from(new Set((Array.isArray(source.excludedDates)?source.excludedDates:[]).concat(originalDate))).sort();note(source,'Split '+originalDate+' into '+cleaned.length+' visible payments');sourceKind='recurring bill';}
  }
  if(!source)return{ok:false,error:'The matching Control Center payment could not be found. Refresh the calendar and try again.'};

  var batchId=String(input.batchId||uid()),category=source.category||(/mortgage/i.test(name)?'Housing':''),sourceNotes='Split from '+name+' scheduled '+originalDate;
  var rows=cleaned.map(function(part,partIndex){return{id:batchId+'-'+(partIndex+1),name:name+' · '+(partIndex+1)+'/'+cleaned.length,date:part.date,amount:-(part.amountCents/100),type:'adjustment',category:category,notes:sourceNotes,batchId:batchId,paymentPart:partIndex+1,paymentParts:cleaned.length};});
  data.bills=bills;data.oneTimeEvents=one.concat(rows);data.income=Array.isArray(data.income)?data.income:[];
  return{ok:true,data:data,rows:rows,sourceKind:sourceKind,total:splitTotal/100};
}

return{applySplit:applySplit,validDate:validDate};
});
