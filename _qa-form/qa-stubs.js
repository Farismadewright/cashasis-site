(function(){
'use strict';
var scenario=new URL(location.href).searchParams.get('scenario')||'normal';
var counts={requests:0,leadCreates:0,detailsWrites:0,generateLead:0,formStart:0,metaLead:0,pending:0};
var receipts=new Map(),attempts=new Map(),pending=[];
function report(){parent.postMessage({type:'cashasis-qa',scenario:scenario,counts:counts},'*');}
try{Object.keys(sessionStorage).filter(k=>k.indexOf('cashasis.offer.v1.')===0).forEach(k=>sessionStorage.removeItem(k));}catch(e){}
window.gtag=function(type,event){if(type==='event'&&event==='generate_lead')counts.generateLead++;if(type==='event'&&event==='form_start')counts.formStart++;report();};
window.fbq=function(type,event){if(type==='track'&&event==='Lead')counts.metaLead++;report();};
window.cashasisAttribution={enrich:function(d){var at=new Date().toISOString();d.attribution={version:1,first:{url:'https://www.cashasis.com/',at:at,referrer:''},latest:{url:'https://www.cashasis.com/',at:at,referrer:''}};return d;}};
window.cashasisDni={phone:function(){return '(346) 584-6365';}};
window.google={maps:{importLibrary:async function(){return {AutocompleteSessionToken:class{},AutocompleteSuggestion:{fetchAutocompleteSuggestions:async function(){return {suggestions:[{placePrediction:{text:{text:'123 FORMTEST QA ONLY Street, Houston, TX 77002'},toPlace:function(){return {formattedAddress:'123 FORMTEST QA ONLY Street, Houston, TX 77002',fetchFields:async function(){}};}}}]};}}};}}};
window.fetch=async function(url,options){
 if(!/^\/\.netlify\/functions\/lead-(submit|update)$/.test(String(url)))throw Error('QA blocked external fetch');
 var data=JSON.parse(options.body),key=data.submission_id+'/'+data.stage;counts.requests++;var attempt=(attempts.get(key)||0)+1;attempts.set(key,attempt);report();
 if(scenario==='slow')await new Promise(function(resolve,reject){pending.push(resolve);counts.pending=pending.length;report();if(options.signal)options.signal.addEventListener('abort',function(){reject(Error('AbortError'));});});
 if(scenario==='failure'&&attempt===1)return Response.json({ok:false,error:'intake_temporarily_unavailable'},{status:503});
 if(scenario==='uncertain')return Response.json({ok:false,error:'submission_review_required',retryable:false},{status:409});
 if(!receipts.has(key)){
  if(data.stage==='contact')counts.leadCreates++;else counts.detailsWrites++;
  receipts.set(key,{ok:true,forwarded:data.stage==='contact',updated:data.stage==='qualified',meta_event_id:'lead_'+data.submission_id});
 }
 report();
 if(scenario==='lost'&&attempt===1)throw Error('QA browser response lost after server acceptance');
 return Response.json(receipts.get(key));
};
window.addEventListener('message',function(e){if(e.data&&e.data.type==='cashasis-qa-release'){pending.splice(0).forEach(resolve=>resolve());counts.pending=0;report();}});
document.addEventListener('click',function(event){var link=event.target.closest&&event.target.closest('a');if(link&&!link.hasAttribute('data-cao-open'))event.preventDefault();},true);
window.addEventListener('DOMContentLoaded',function(){
 document.querySelectorAll('form').forEach(function(form){var fields={name:'FORMTEST QA',email:'formtest.cashasis.qa@example.invalid',phone:'2025550107',address:'123 FORMTEST QA ONLY Street'};Object.keys(fields).forEach(function(k){var el=form.querySelector('[name="'+k+'"]');if(el)el.value=fields[k];});});report();
});
})();
