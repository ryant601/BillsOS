'use strict';
const crypto = require('crypto');
const { projection } = require('./credit-card-manager');
const cents = n => Math.round(Number(n) * 100);
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
function paymentDate(first, index) {
  const [y,m,d] = first.split('-').map(Number), date = new Date(Date.UTC(y,m-1+index,1));
  const year = date.getUTCFullYear(), month = date.getUTCMonth()+1, day = Math.min(d,new Date(Date.UTC(year,month,0)).getUTCDate());
  return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function validate(input, old, date = today()) {
  const out = {...old, name:String(input.name || '').trim(), category:String(input.category || 'Other liability').trim().slice(0,80), archived:!!input.archived, linkedBillId:String(input.linkedBillId || '')};
  if (!out.name || out.name.length>100) throw new Error('Enter a liability name (100 characters or fewer)');
  for (const key of ['balance','payment','monthlyCharge','apr']) {
    if (key==='payment' && (input[key]==null || input[key]==='' || Number(input[key])===0)) {out.payment=null;continue;}
    const value = input[key] === '' || input[key] == null ? NaN : Number(input[key]);
    if (!Number.isFinite(value) || value<0 || value>(key==='apr'?100:10000000) || (key==='payment' && cents(value)<=0)) throw new Error('Enter a valid '+key);
    out[key] = key==='apr'?value:cents(value)/100;
  }
  out.balanceAsOf=String(input.balanceAsOf || date);out.firstDate=String(input.firstDate || '');
  if (!validDate(out.balanceAsOf) || out.balanceAsOf>date) throw new Error('Balance date must be today or earlier');
  if (out.payment && (!validDate(out.firstDate) || out.firstDate<out.balanceAsOf || out.firstDate<'2026-06-01' || out.firstDate>'2027-12-31')) throw new Error('First payment must be on or after the balance date and within the calendar through December 2027');
  if (!out.payment) out.firstDate='';
  out.history=(old.history || []).slice();
  if (old.balance!==out.balance || old.balanceAsOf!==out.balanceAsOf) out.history.push({date:out.balanceAsOf,balance:out.balance,recordedAt:new Date().toISOString()});
  out.history=out.history.slice(-250);return out;
}
function amortize(item) {
  if(item.balance==null||item.apr==null)return {rows:[],needsBalance:item.balance==null,needsApr:item.apr==null,needsSchedule:!item.payment,cleared:false,months:null,interest:null,totalPayments:0,totalCharges:0,remaining:item.balance,ongoing:!!item.monthlyCharge};
  if (!item.payment) return {rows:[],needsSchedule:true,cleared:false,months:null,interest:0,totalPayments:0,totalCharges:0,remaining:item.balance,ongoing:!!item.monthlyCharge};
  let balance=cents(item.balance), interestTotal=0, paidTotal=0, chargeTotal=0;
  const rows=[];let cleared=false, payoffMonth=null;
  for (let i=0;i<600;i++) {
    if (!balance && !cents(item.monthlyCharge)) {cleared=true;payoffMonth=0;break;}
    const opening=balance, charge=cents(item.monthlyCharge), interest=Math.round((opening+charge)*Number(item.apr)/1200), payment=Math.min(cents(item.payment),opening+charge+interest);
    balance=Math.max(0,opening+charge+interest-payment);paidTotal+=payment;interestTotal+=interest;chargeTotal+=charge;
    rows.push({date:paymentDate(item.firstDate,i),opening:opening/100,charge:charge/100,interest:interest/100,payment:payment/100,ending:balance/100});
    if (!balance) {cleared=true;if(payoffMonth==null)payoffMonth=i+1;if(!cents(item.monthlyCharge)||(rows.length>=24&&rows.at(-1).date.slice(0,7)>='2027-12'))break;}
    if (i>=119 && balance>=cents(item.balance)) break;
  }
  return {rows,cleared,months:payoffMonth,interest:interestTotal/100,totalPayments:paidTotal/100,totalCharges:chargeTotal/100,remaining:balance/100,ongoing:!!cents(item.monthlyCharge)};
}
function preview(data,item,input,date=today()) {
  if (!item || item.removed || item.archived) throw new Error('Choose an active liability');
  if(item.balance==null||item.apr==null)throw new Error('Enter the actual balance and APR (including 0% if applicable) before planning payments');
  if (input.mode==='calendar' || !item.payment) return suggest(data,item,input,date);
  const count=Number(input.months), buffer=Number(input.buffer);
  if (!Number.isInteger(count) || count<1 || count>24 || !Number.isFinite(buffer) || buffer<0 || buffer>1000000) throw new Error('Choose 1–24 payments and a valid cash buffer');
  if (item.linkedBillId) throw new Error('This liability is linked to an existing bill. Its payments are already managed in Bills.');
  if ((data.bills || []).some(b=>b.active!==false && String(b.name || '').trim().toLowerCase()===item.name.toLowerCase())) throw new Error('A recurring bill with this name already exists. Link it in the liability editor to avoid duplicate payments.');
  const plan=amortize(item), existing=(data.oneTimeEvents || []).filter(e=>e.liabilityId===item.id||(item.originCardId&&e.creditCardId===item.originCardId));
  const future=plan.rows.filter(r=>r.date>=date && r.date<='2027-12-31').slice(0,count);
  const payments=future.filter(r=>!existing.some(e=>(e.liabilityPeriod || String(e.date).slice(0,7))===r.date.slice(0,7))).map(r=>({date:r.date,amount:r.payment,period:r.date.slice(0,7)}));
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify(payments)).digest('hex');
  if (!payments.length) return {payments:[],alreadyPlanned:future.length,safe:true,buffer,fingerprint};
  const base=projection(data), next=structuredClone(data);next.oneTimeEvents=next.oneTimeEvents || [];
  payments.forEach((p,i)=>next.oneTimeEvents.push({id:'liability-preview-'+i,name:item.name,date:p.date,amount:-p.amount,type:'adjustment'}));
  const start=payments[0].date, before=base.filter(d=>d.date>=start), after=projection(next).filter(d=>d.date>=start);
  const low=after.reduce((a,b)=>b.ending<a.ending?b:a), oldLow=before.reduce((a,b)=>b.ending<a.ending?b:a);
  return {payments,alreadyPlanned:future.length-payments.length,buffer,fingerprint,safe:cents(low.ending)>=cents(buffer),lowest:Math.round(low.ending*100)/100,lowestDate:low.date,beforeLowest:Math.round(oldLow.ending*100)/100,through:after.at(-1).date,total:payments.reduce((sum,p)=>sum+cents(p.amount),0)/100};
}
function suggest(data,item,input,date=today()) {
  const start=String(input.start || date),end=String(input.end || date.slice(0,4)+'-12-31'),buffer=Number(input.buffer),strategy=input.strategy==='spread'?'spread':'early';
  if (!validDate(start)||!validDate(end)||start<date||end<start||end>'2027-12-31'||!Number.isFinite(buffer)||buffer<0||buffer>1000000) throw new Error('Choose future dates within the calendar and a valid cash buffer');
  if(item.linkedBillId)throw new Error('This liability is linked to a bill. Manage that schedule in Control Center, or unlink it to plan separate payments.');
  if((data.bills||[]).some(b=>b.active!==false&&(!b.endMonth||b.endMonth>=date.slice(0,7))&&String(b.name||'').trim().toLowerCase()===item.name.toLowerCase()))throw new Error('A recurring bill with this name already exists. Link it or use a separate name for arrears to avoid duplicates.');
  const base=projection(data),source=new Map((data.oneTimeEvents||[]).filter(e=>e.liabilityId===item.id||(item.originCardId&&e.creditCardId===item.originCardId)).map(e=>[e.id,e]));
  const reserved=base.flatMap(d=>d.items).filter(r=>source.has(r.sourceId)&&r.iso>=date&&r.amount<0);
  let remaining=Math.max(0,cents(item.balance)-reserved.reduce((n,r)=>n+cents(-r.amount),0));
  const pendingMonths=new Set([...reserved.map(r=>r.iso.slice(0,7)),...Array.from(source.values()).filter(e=>e.date>=date).map(e=>e.liabilityPeriod||e.date.slice(0,7))]);
  const months=Array.from(new Set(base.filter(d=>d.date>=start&&d.date<=end).map(d=>d.date.slice(0,7)))),next=structuredClone(data),payments=[];
  next.oneTimeEvents=next.oneTimeEvents||[];
  months.forEach((month,index)=>{
    if(!remaining||pendingMonths.has(month))return;
    const days=projection(next).filter(d=>d.date>=start),suffix=[];let low=Infinity;
    for(let i=days.length-1;i>=0;i--){low=Math.min(low,cents(days[i].ending));suffix[i]=low;}
    const choices=days.map((d,i)=>({date:d.date,capacity:Math.max(0,suffix[i]-cents(buffer))})).filter(d=>d.date.slice(0,7)===month&&d.date<=end&&d.capacity>=1);
    if(!choices.length)return;
    if(strategy==='spread')choices.sort((a,b)=>b.capacity-a.capacity||a.date.localeCompare(b.date));
    const choice=choices[0],slots=months.slice(index).filter(m=>!pendingMonths.has(m)).length;
    const amount=Math.min(remaining,choice.capacity,strategy==='spread'?Math.ceil(remaining/Math.max(1,slots)):remaining);
    if(amount<=0)return;
    const p={date:choice.date,amount:amount/100,period:month};payments.push(p);remaining-=amount;
    next.oneTimeEvents.push({id:'liability-suggest-'+index,name:item.name,date:p.date,amount:-p.amount,type:'adjustment'});
  });
  const after=projection(next).filter(d=>d.date>=start),before=base.filter(d=>d.date>=start),low=after.reduce((a,b)=>b.ending<a.ending?b:a),oldLow=before.reduce((a,b)=>b.ending<a.ending?b:a);
  const total=payments.reduce((n,p)=>n+cents(p.amount),0)/100;
  return {mode:'calendar',strategy,payments,total,remainingRecorded:remaining/100,reserved:reserved.reduce((n,r)=>n+cents(-r.amount),0)/100,alreadyPlanned:reserved.length,buffer,safe:!payments.length||cents(low.ending)>=cents(buffer),lowest:Math.round(low.ending*100)/100,lowestDate:low.date,beforeLowest:Math.round(oldLow.ending*100)/100,through:after.at(-1).date,start,end,fingerprint:crypto.createHash('sha256').update(JSON.stringify(payments)).digest('hex'),debtRows:calendarAmortization(item,[...reserved.map(r=>({date:r.iso,amount:-r.amount})),...payments],start,end)};
}
function calendarAmortization(item,payments,start,end) {
  let balance=cents(item.balance);const rows=[];
  for(let index=0;index<24;index++){
    const date=paymentDate(start.slice(0,7)+'-01',index),month=date.slice(0,7);if(month>end.slice(0,7))break;
    const opening=balance,charge=cents(item.monthlyCharge),interest=Math.round((opening+charge)*Number(item.apr)/1200),payment=payments.filter(p=>p.date>=start&&p.date<=end&&p.date.slice(0,7)===month).reduce((n,p)=>n+cents(p.amount),0);
    balance=Math.max(0,opening+charge+interest-payment);rows.push({date:month,opening:opening/100,charge:charge/100,interest:interest/100,payment:payment/100,ending:balance/100});
  }
  return rows;
}
function register(app,deps) {
  const {readStore,writeStore,readBills,writeBills}=deps;
  const currentDate=deps.currentDate||today;
  const get=()=>{const s=readStore();return {revision:s.revision || 0,items:s.items || []};};
  const present=s=>{const data=readBills(),visible=s.items.filter(i=>!i.removed);return {revision:s.revision,items:visible.map(item=>({...item,amortization:amortize(item)})),removed:s.items.filter(i=>i.removed).map(i=>({id:i.id,name:i.name})),bills:(data.bills||[]).filter(b=>b.active!==false).map(b=>({id:b.id,name:b.name,amount:b.amount,dueDay:b.dueDay})),planned:(data.oneTimeEvents||[]).filter(e=>e.liabilityId||visible.some(i=>i.originCardId&&i.originCardId===e.creditCardId)).map(e=>({id:e.id,liabilityId:e.liabilityId||visible.find(i=>i.originCardId===e.creditCardId)?.id,date:e.date,amount:e.amount}))};};
  app.get('/api/liabilities',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json(present(get()));});
  app.post('/api/liabilities',(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'Liabilities changed on another device. Reload before saving.'});
    const existing=s.items.find(i=>i.id===req.body.item?.id);
    if(existing?.removed)throw new Error('Restore this liability before updating it');
    if(req.body.item?.id&&!existing)throw new Error('Liability no longer exists');
    const item=validate(req.body.item || {},existing || {id:crypto.randomUUID(),history:[]},currentDate());
    if(item.linkedBillId&&!(readBills().bills || []).some(b=>b.id===item.linkedBillId&&b.active!==false))throw new Error('Choose an active bill to link');
    s.items=s.items.filter(i=>i.id!==item.id).concat(item);s.revision++;writeStore(s);res.json(present(s));
  }catch(e){res.status(400).json({error:e.message});}});
  for(const action of ['remove','restore'])app.post('/api/liabilities/'+action,(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'Liabilities changed on another device. Reload before continuing.'});
    const item=s.items.find(i=>i.id===req.body.id);if(!item)throw new Error('Liability no longer exists');item.removed=action==='remove';item.removedAt=item.removed?new Date().toISOString():null;s.revision++;writeStore(s);res.json(present(s));
  }catch(e){res.status(400).json({error:e.message});}});
  app.post('/api/liabilities/preview',(req,res)=>{try{const s=get();res.json(preview(readBills(),s.items.find(i=>i.id===req.body.itemId),req.body,currentDate()));}catch(e){res.status(400).json({error:e.message});}});
  app.post('/api/liabilities/payments',(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'The liability changed. Reload and review its payments again.'});
    const item=s.items.find(i=>i.id===req.body.itemId), data=readBills(), result=preview(data,item,req.body,currentDate());
    if(result.payments.length&&req.body.fingerprint!==result.fingerprint)return res.status(409).json({error:'The payment list changed. Preview again before adding it to the calendar.'});
    if(!result.safe)return res.status(409).json({error:'The latest calendar falls below your buffer. Reduce the payment or buffer, or schedule fewer months.'});
    data.oneTimeEvents=data.oneTimeEvents || [];
    result.payments.forEach(p=>data.oneTimeEvents.push({id:'liability-'+item.id+'-'+p.period,liabilityId:item.id,liabilityPeriod:p.period,name:item.name,date:p.date,amount:-p.amount,type:'adjustment',category:item.category,payMethod:'manual',notes:'Liability payment. Balance tracking is in Liabilities; update the actual balance after posting.'}));
    if(result.payments.length)writeBills(data);res.json({saved:result.payments.length,alreadyPlanned:result.alreadyPlanned});
  }catch(e){res.status(400).json({error:e.message});}});
}
module.exports={register,validate,amortize,paymentDate,preview,suggest,calendarAmortization};
