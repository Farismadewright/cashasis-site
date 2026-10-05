import {attributionStore,processReceipt,archiveReceipt,publishedProduction} from './_shared/attribution-queue.js';
export default async function(request,context){
 if(!publishedProduction(context))return new Response(null,{status:503});
 const store=attributionStore(context);const started=Date.now();const cursor=await store.get('reconciliation-cursor',{type:'json'});const offset=Math.max(0,Number(cursor?.offset)||0);let skipped=0,removed=0;let inspected=0,processed=0,pending=0;
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
