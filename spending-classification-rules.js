(function(root,factory){
'use strict';
var api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.BillsOSSpendingClassifications=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
var SCHEMA='billsos-vendor-category-rules';
function clean(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function valid(config){return !!(config&&config.schema===SCHEMA&&config.version===1&&Array.isArray(config.rules))}
function terms(values){return Array.isArray(values)?values.map(function(value){return clean(value).toLowerCase()}).filter(Boolean):[]}
function matches(row,rule){
  if(!rule||rule.enabled===false||!rule.match||!rule.classification)return false;
  var text=(clean(row.merchant||row.m)+' '+clean(row.note||row.n)).toLowerCase();
  var any=terms(rule.match.containsAny),all=terms(rule.match.containsAll),categories=terms(rule.match.categoryAny),subcategories=terms(rule.match.subcategoryAny),amount=Number(row.amount!=null?row.amount:row.a);
  var category=clean(row.category||row.c).toLowerCase(),subcategory=clean(row.subcategory||row.s).toLowerCase();
  if(rule.match.direction==='outflow'&&!(amount>0))return false;
  if(rule.match.direction==='inflow'&&!(amount<0))return false;
  return (!any.length||any.some(function(term){return text.indexOf(term)>=0}))&&
    all.every(function(term){return text.indexOf(term)>=0})&&
    (!categories.length||categories.indexOf(category)>=0)&&
    (!subcategories.length||subcategories.indexOf(subcategory)>=0);
}
function classify(row,config){
  if(!valid(config))return row;
  var rule=config.rules.find(function(candidate){return matches(row,candidate)});
  if(!rule)return row;
  var category=clean(rule.classification.category),subcategory=clean(rule.classification.subcategory);
  if(!category||!subcategory)return row;
  return Object.assign({},row,{category:category,subcategory:subcategory,classificationRuleId:clean(rule.id)});
}
function apply(rows,config){return (Array.isArray(rows)?rows:[]).map(function(row){return classify(row,config)})}
return {SCHEMA:SCHEMA,valid:valid,matches:matches,classify:classify,apply:apply};
});
