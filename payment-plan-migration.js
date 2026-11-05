'use strict';
const {discover}=require('./credit-card-manager');
const {paymentDate}=require('./liability-manager');
function migratePaymentPlans(deps,date=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'})){
  const cards=deps.readCards(),liabilities=deps.readLiabilities();
  const discovered=discover(deps.readBills(),cards,date,{legacyPaymentPlans:!cards.paymentPlansSeparated});
  const items=(liabilities.items||[]).slice();let added=0,changed=!cards.paymentPlansSeparated;
  const nextCards=discovered.map(card=>{
    if(!card.paymentPlan)return card;
    const id='payment-plan-'+card.id;
    const existing=items.find(i=>i.originCardId===card.id||i.id===id);
    if(!existing){
      const due=Math.max(1,Math.min(31,Number(card.dueDay)||Number(date.slice(8))));
      let first=paymentDate(date.slice(0,7)+'-'+String(due).padStart(2,'0'),0);if(first<date)first=paymentDate(date.slice(0,7)+'-'+String(due).padStart(2,'0'),1);
      items.push({id,originCardId:card.id,fixedPaymentPlan:true,name:card.name,category:'Fixed payment plan',balance:card.balance??null,apr:card.apr??null,payment:card.payment>0?card.payment:null,monthlyCharge:0,balanceAsOf:card.balanceAsOf||date,firstDate:first,linkedBillId:card.sourceBillId||'',archived:!!card.archived,removed:!!card.removed,removedAt:card.removedAt||null,history:structuredClone(card.history||[])});added++;
    }
    if(card.movedToLiabilityId!==(existing?.id||id))changed=true;
    return {...card,movedToLiabilityId:existing?.id||id};
  });
  // Write the destination first. A retry finds originCardId and never overwrites edits.
  if(added)deps.writeLiabilities({...liabilities,items,revision:Number(liabilities.revision||0)+1});
  if(changed)deps.writeCards({...cards,cards:nextCards,paymentPlansSeparated:true,revision:Number(cards.revision||0)+1});
  return {added};
}
module.exports={migratePaymentPlans};
