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
    const value = input[key] === '' || input[key] == null ? NaN : Number(input[key]);
    if (!Number.isFinite(value) || value<0 || value>(key==='apr'?100:10000000) || (key==='payment' && cents(value)<=0)) throw new Error('Enter a valid '+key);
    out[key] = key==='apr'?value:cents(value)/100;
  }
  out.balanceAsOf=String(input.balanceAsOf || date);out.firstDate=String(input.firstDate || '');
  if (!validDate(out.balanceAsOf) || out.balanceAsOf>date) throw new Error('Balance date must be today or earlier');
  if (!validDate(out.firstDate) || out.firstDate<out.balanceAsOf || out.firstDate<'2026-06-01' || out.firstDate>'2027-12-31') throw new Error('First payment must be on or after the balance date and within the calendar through December 2027');
  out.history=(old.history || []).slice();
  if (old.balance!==out.balance || old.balanceAsOf!==out.balanceAsOf) out.history.push({date:out.balanceAsOf,balance:out.balance,recordedAt:new Date().toISOString()});
  out.history=out.history.slice(-250);return out;
}
function amortize(item) {
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
  if (!item || item.archived) throw new Error('Choose an active liability');
  const count=Number(input.months), buffer=Number(input.buffer);
  if (!Number.isInteger(count) || count<1 || count>24 || !Number.isFinite(buffer) || buffer<0 || buffer>1000000) throw new Error('Choose 1–24 payments and a valid cash buffer');
  if (item.linkedBillId) throw new Error('This liability is linked to an existing bill. Its payments are already managed in Bills.');
  if ((data.bills || []).some(b=>b.active!==false && String(b.name || '').trim().toLowerCase()===item.name.toLowerCase())) throw new Error('A recurring bill with this name already exists. Link it in the liability editor to avoid duplicate payments.');
  const plan=amortize(item), existing=(data.oneTimeEvents || []).filter(e=>e.liabilityId===item.id);
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
function register(app,deps) {
  const {readStore,writeStore,readBills,writeBills}=deps;
  const get=()=>{const s=readStore();return {revision:s.revision || 0,items:s.items || []};};
  const present=s=>({...s,items:s.items.map(item=>({...item,amortization:amortize(item)})),bills:(readBills().bills || []).filter(b=>b.active!==false).map(b=>({id:b.id,name:b.name,amount:b.amount,dueDay:b.dueDay})),planned:(readBills().oneTimeEvents || []).filter(e=>e.liabilityId).map(e=>({id:e.id,liabilityId:e.liabilityId,date:e.date,amount:e.amount}))});
  app.get('/api/liabilities',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.json(present(get()));});
  app.post('/api/liabilities',(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'Liabilities changed on another device. Reload before saving.'});
    const existing=s.items.find(i=>i.id===req.body.item?.id);
    if(req.body.item?.id&&!existing)throw new Error('Liability no longer exists');
    const item=validate(req.body.item || {},existing || {id:crypto.randomUUID(),history:[]});
    if(item.linkedBillId&&!(readBills().bills || []).some(b=>b.id===item.linkedBillId&&b.active!==false))throw new Error('Choose an active bill to link');
    s.items=s.items.filter(i=>i.id!==item.id).concat(item);s.revision++;writeStore(s);res.json(present(s));
  }catch(e){res.status(400).json({error:e.message});}});
  app.post('/api/liabilities/preview',(req,res)=>{try{const s=get();res.json(preview(readBills(),s.items.find(i=>i.id===req.body.itemId),req.body));}catch(e){res.status(400).json({error:e.message});}});
  app.post('/api/liabilities/payments',(req,res)=>{try{
    const s=get();if(req.body.revision!==s.revision)return res.status(409).json({error:'The liability changed. Reload and review its payments again.'});
    const item=s.items.find(i=>i.id===req.body.itemId), data=readBills(), result=preview(data,item,req.body);
    if(result.payments.length&&req.body.fingerprint!==result.fingerprint)return res.status(409).json({error:'The payment list changed. Preview again before adding it to the calendar.'});
    if(!result.safe)return res.status(409).json({error:'The latest calendar falls below your buffer. Reduce the payment or buffer, or schedule fewer months.'});
    data.oneTimeEvents=data.oneTimeEvents || [];
    result.payments.forEach(p=>data.oneTimeEvents.push({id:'liability-'+item.id+'-'+p.period,liabilityId:item.id,liabilityPeriod:p.period,name:item.name,date:p.date,amount:-p.amount,type:'adjustment',category:item.category,payMethod:'manual',notes:'Liability payment. Balance tracking is in Liabilities; update the actual balance after posting.'}));
    if(result.payments.length)writeBills(data);res.json({saved:result.payments.length,alreadyPlanned:result.alreadyPlanned});
  }catch(e){res.status(400).json({error:e.message});}});
}
module.exports={register,validate,amortize,paymentDate,preview};
