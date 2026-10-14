import {getStore} from '@netlify/blobs';
import {createStoreView,processReceipt,archiveReceipt} from './_shared/attribution-queue.js';
// schedule is the platform admission boundary: Netlify blocks incoming web requests.
// See https://docs.netlify.com/build/functions/api/#schedule
async function scheduledProduction(request,context){
 if(context?.deploy?.context!=='production'||context?.site?.id!=='a00e8950-5064-4a85-880a-86acf9041c35'||request?.method!=='POST')return false;
 try{
  const event=await request.json();
  return typeof event?.next_run==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.next_run)&&Number.isFinite(Date.parse(event.next_run));
 }catch{return false;}
}
function scheduledAttributionStore(){
 const primary=getStore({name:'cashasis-attribution-v1',consistency:'strong'});
 const legacy=['cashasis-attribution-preview-local','cashasis-attribution-preview-6ac3d18a1f91290008b75a0f'].map(name=>getStore({name,consistency:'strong'}));
 return createStoreView(primary,legacy);
}
export default async function(request,context){
 const schedulerAccepted=await scheduledProduction(request,context);
 // Temporary diagnostics: allowlisted platform metadata only; never log request data or secrets.
 try{
  const deploy=context?.deploy;
  const published=deploy?.published;
  console.info('[attribution] reconcile_diagnostic_v1',{
   requestId:typeof context?.requestId==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(context.requestId)?context.requestId:null,
   deployId:typeof deploy?.id==='string'&&/^[a-f0-9]{24}$/i.test(deploy.id)?deploy.id:null,
   deployPresent:deploy!=null,
   deployContext:['production','deploy-preview','branch-deploy','dev'].includes(deploy?.context)?deploy.context:null,
   deployContextType:typeof deploy?.context,
   published:typeof published==='boolean'||published==='true'||published==='false'?published:null,
   publishedType:typeof published,
   guardAccepted:schedulerAccepted
  });
 }catch{}
 if(!schedulerAccepted)return new Response(null,{status:503});
 const store=scheduledAttributionStore();const started=Date.now();const cursor=await store.get('reconciliation-cursor',{type:'json'});const offset=Math.max(0,Number(cursor?.offset)||0);let skipped=0,removed=0;let inspected=0,processed=0,pending=0;
 // Low-volume bounded reconciliation; never read or rewrite seller contact data outside saved receipts.
 for await(const page of store.list({prefix:'pending/',paginate:true})){
  for(const item of page.blobs){
   if(skipped++<offset)continue;
   if(++inspected>500||processed>=5||Date.now()-started>18000){await store.setJSON('reconciliation-cursor',{offset:Math.max(0,offset+inspected-1-removed)});console.warn('[attribution] reconciliation_limit', {inspected,processed,pending});return new Response(null,{status:204});}
   const receipt=await store.get(item.key,{type:'json'});if(!receipt)continue;if(['identity_conflict','review_required','expired','intake_rejected','recorded'].includes(receipt.status)){await archiveReceipt(receipt.id,receipt.status,store);removed++;continue;}const expired=Date.now()-Date.parse(receipt.createdAt)>30*86400000;if(!expired&&(!['awaiting_intake','pending','pending_contact_creation','pending_busy'].includes(receipt.status)||receipt.nextAttemptAt>Date.now()))continue;
   pending++;try{const result=await processReceipt(receipt.id,store);if(['recorded','identity_conflict','review_required','expired','intake_rejected'].includes(result.status))removed++;if(result.status.startsWith('pending')){const latest=await store.getWithMetadata(item.key,{type:'json'});if(latest)await store.setJSON(item.key,{...latest.data,nextAttemptAt:Date.now()+3600000},{onlyIfMatch:latest.etag});}processed++;}catch(err){console.error('[attribution] retry_failed',{receipt:receipt.id,error:err.message});const latest=await store.getWithMetadata(item.key,{type:'json'});if(latest)await store.setJSON(item.key,{...latest.data,attempts:(latest.data.attempts||0)+1,nextAttemptAt:Date.now()+3600000},{onlyIfMatch:latest.etag});processed++;}
  }
 }
 await store.setJSON('reconciliation-cursor',{offset:0});
 console.log('[attribution] reconcile',{inspected,processed,pending});return new Response(null,{status:204});
}
export const config={schedule:'*/10 * * * *'};

