'use strict';
const crypto = require('crypto');
const { projection } = require('./credit-card-manager');
const suggestions = require('./negative-balance-recommendations');
const { applyCalendarStatePatch } = require('./bills-data-integrity');
const RULE_ID = '__billsos_system_rules__';
const cents = n => Math.round(Number(n) * 100);
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
function identity(c) {
  return JSON.stringify([c.kind,c.name,c.from,c.to||'',c.amount||0,c.originalAmount||0,
    c.firstDate||'',c.secondDate||'',c.firstAmount||0,c.secondAmount||0]);
}
function accept(data, request, date = today(), completed = {}) {
  const choice = request.choice || {}, floor = Number(choice.targetFloor);
  if (!Number.isFinite(floor) || floor < 0 || floor > 2000) throw Error('Reload and review this suggestion again.');
  const rules = JSON.parse((data.oneTimeEvents||[]).find(e=>e.id===RULE_ID)?.notes || '{}');
  const state = rules.calendarState || rules, days = projection(data), rows = days.flatMap(d=>d.items);
  const monthDays = days.filter(d=>d.date.slice(0,7)===String(choice.from||'').slice(0,7));
  const choices = [
    ...suggestions.recommend(rows,{days:monthDays},date,floor,state.recommendationPreferences),
    ...suggestions.recommendAhead(rows,days,date,120,floor,state.recommendationPreferences)
  ];
  const fresh = choices.find(c=>identity(c)===identity(choice));
  if (!fresh) throw Error('The calendar or suggestion changed. Refresh and review the latest suggestion.');
  const matches = rows.filter(r=>r.name===fresh.name && r.iso===fresh.from && cents(r.amount)===-cents(fresh.originalAmount));
  if (matches.length!==1) throw Error('The payment could not be identified uniquely. Review it in the calendar.');
  const row=matches[0], key=row.originalKey;
  if (completed[key] || state.completed?.[key]) throw Error('This payment is marked paid. Review it in the calendar.');
  const now=new Date().toISOString();
  let parts;
  if (fresh.firstDate) parts=[{date:fresh.firstDate,amount:fresh.firstAmount},{date:fresh.secondDate,amount:fresh.secondAmount}];
  else if (fresh.kind==='split') parts=[{date:fresh.from,amount:(cents(fresh.originalAmount)-cents(fresh.amount))/100},{date:fresh.to,amount:fresh.amount}];
  else parts=[{date:fresh.to,amount:fresh.amount}];
  if (parts.reduce((n,p)=>n+cents(p.amount),0)!==cents(fresh.originalAmount)) throw Error('The suggested amounts no longer match the payment.');
  const first=parts[0], patch={dateAdjustments:{[key]:{date:first.date,originalDate:key.slice(0,10),status:'moved',updatedAt:now}},amountAdjustments:{[key]:{amount:first.amount,updatedAt:now}}};
  const next=applyCalendarStatePatch(data,{baseRevision:-1,calendarState:patch});
  if (parts.length>1) {
    const source=(data.oneTimeEvents||[]).find(e=>e.id===row.sourceId)||(data.bills||[]).find(b=>b.id===row.sourceId)||{};
    next.oneTimeEvents.push({id:'accepted-suggestion-'+crypto.randomUUID(),name:fresh.name,date:parts[1].date,amount:-parts[1].amount,type:'adjustment',category:source.category||row.category||'',payMethod:source.payMethod||row.payMethod||'manual',notes:'Remaining payment from accepted split of '+fresh.from,suggestionSourceKey:key,...(source.liabilityId?{liabilityId:source.liabilityId,liabilityPeriod:source.liabilityPeriod}:{}),...(source.creditCardId?{creditCardId:source.creditCardId}:{})});
  }
  return {data:next,parts,name:fresh.name};
}
function register(app,{readBills,writeBills,readCompleted=()=>({}),currentDate=today}) {
  app.post('/api/bills/accept-suggestion',(req,res)=>{
    try {
      const result=accept(readBills(),req.body||{},currentDate(),readCompleted());
      writeBills(result.data);
      res.json({saved:true,name:result.name,parts:result.parts});
    } catch(e) {res.status(409).json({error:e.message});}
  });
}
module.exports={accept,register,identity};
