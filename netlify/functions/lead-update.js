import { preflight, queueAttribution, markReady, processReceipt } from './_shared/attribution-queue.js';
import crypto from 'node:crypto';

const LOCATION_ID = 'O3BfhO3fUHCu0LXCtV7e';
const META_DATASET_ID = '992265673072496';
const PROPERTY_CONDITION_FIELD = '01i2ggTacsfSrYfKqLxq';
const TIMELINE_FIELD = 'Dwz4ZW2U43Psb6h6nDs3';

function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}
function sha256(v){return crypto.createHash('sha256').update(String(v||'').trim().toLowerCase()).digest('hex');}
function phone(v){return String(v||'').replace(/\D/g,'');}

async function ghl(path, options={}) {
  const token = Netlify.env.get('GHL_PRIVATE_INTEGRATION_TOKEN') || Netlify.env.get('GHL_API_TOKEN') || '';
  if (!token) throw new Error('ghl_api_token_missing');
  const r=await fetch('https://services.leadconnectorhq.com'+path,{...options,headers:{Authorization:'Bearer '+token,Version:'2021-07-28','Content-Type':'application/json',...(options.headers||{})}});
  const t=await r.text(); let data={}; try{data=JSON.parse(t)}catch{}
  if(!r.ok) throw new Error('ghl_'+r.status+':'+t.slice(0,300));
  return data;
}
async function metaLead(body,eventId,event){
  if(/^attribution\.qa\.(google|meta|organic|preserve)\.20261005@example\.invalid$/i.test(body.email||''))return;
  const token=Netlify.env.get('META_CAPI_ACCESS_TOKEN')||''; if(!token)return;
  const h=event.headers||{}, ip=String(h['x-forwarded-for']||'').split(',')[0].trim();
  const parts=String(body.full_name||'').trim().split(/\s+/);
  const ud={em:[sha256(body.email)],ph:[sha256(phone(body.phone))]};
  if(parts[0])ud.fn=[sha256(parts[0])]; if(parts.length>1)ud.ln=[sha256(parts.slice(1).join(' '))];
  if(ip)ud.client_ip_address=ip;if(h['user-agent'])ud.client_user_agent=h['user-agent'];if(body.fbp)ud.fbp=body.fbp;if(body.fbc)ud.fbc=body.fbc;
  const payload={data:[{event_name:'Lead',event_time:Math.floor(Date.now()/1000),event_id:eventId,action_source:'website',event_source_url:body.event_source_url||'https://www.cashasis.com/',user_data:ud,custom_data:{content_name:'Seller Lead',content_category:'seller_lead',form_location:body.page||'step3-complete'}}]};
  const test=Netlify.env.get('META_TEST_EVENT_CODE')||'';if(test)payload.test_event_code=test;
  const r=await fetch('https://graph.facebook.com/v23.0/'+META_DATASET_ID+'/events?access_token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  if(!r.ok)console.error('[lead-update] Meta CAPI rejected',r.status,await r.text());
}
async function handler(event){
  if(event.httpMethod!=='POST')return json(405,{ok:false,error:'method_not_allowed'});
  let b;try{b=JSON.parse(event.body||'{}')}catch{return json(400,{ok:false,error:'invalid_json'})}
  if(b.tcpa_consent!==true)return json(400,{ok:false,error:'consent_required'});
  if(!b.email&&!b.phone)return json(400,{ok:false,error:'identity_required'});
  try{
    const contact=await preflight(b,ghl);if(!contact)return json(404,{ok:false,error:'contact_not_found'});
    const receiptId=await queueAttribution(b);
    await ghl('/contacts/'+contact.id,{method:'PUT',body:JSON.stringify({customFields:[
      {id:PROPERTY_CONDITION_FIELD,fieldValue:String(b.property_condition||'')},
      {id:TIMELINE_FIELD,fieldValue:String(b.selling_timeline||'')}
    ]})});
    let attribution={status:'not_recorded'};
    try{if(receiptId){await markReady(receiptId);attribution=await processReceipt(receiptId,undefined,ghl);}else attribution={status:'no_evidence'};}catch(e){console.error('[lead-update] Attribution persistence failed',e.message);attribution={status:'error'};}
    const eid=String(b.meta_event_id||('lead_'+Date.now()));
    try{await metaLead(b,eid,event)}catch(e){console.error('[lead-update] CAPI failed',e.message)}
    return json(200,{ok:true,updated:true,is_test:/^attribution\.qa\.(google|meta|organic|preserve)\.20261005@example\.invalid$/i.test(b.email||''),attribution_status:attribution.status,contact_id:contact.id,meta_event_id:eid});
  }catch(e){console.error('[lead-update]',e.message);return json(e.message==='identity_conflict'?409:502,{ok:false,error:e.message==='identity_conflict'?'identity_conflict':'update_failed'});}
}
export default async function(request) {
  const result=await handler({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='GET'||request.method==='HEAD'?'':await request.text()});
  return new Response(result.statusCode===204?null:result.body,{status:result.statusCode,headers:result.headers});
}
