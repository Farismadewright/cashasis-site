import crypto from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {sanitizeEvidence,persistAttribution,resolveContact} from './attribution.js';
export const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const phone=v=>String(v||'').replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
export function attributionStore(){const context=Netlify.env.get('CONTEXT');return getStore({name:context==='production'?'cashasis-attribution-v1':'cashasis-attribution-preview-'+String(Netlify.env.get('DEPLOY_ID')||'local'),consistency:'strong'});}
export async function ghl(path,options={}){const token=Netlify.env.get('GHL_PRIVATE_INTEGRATION_TOKEN')||Netlify.env.get('GHL_API_TOKEN');if(!token)throw Error('ghl_api_token_missing');const r=await fetch('https://services.leadconnectorhq.com'+path,{...options,signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+token,Version:'2021-07-28','Content-Type':'application/json'}});if(!r.ok)throw Error('attribution_ghl_'+r.status);return r.json();}
export function identityMatches(body,contact){if(!contact)return true;if(body.email&&contact.email&&body.email.trim().toLowerCase()!==contact.email.trim().toLowerCase())return false;if(body.phone&&contact.phone&&phone(body.phone)!==phone(contact.phone))return false;return true;}
export async function preflight(body,api=ghl){const a=await resolveContact(body,api);if(!identityMatches(body,a))throw Error('identity_conflict');if(body.phone){const r=await api('/contacts/search/duplicate?locationId=O3BfhO3fUHCu0LXCtV7e&number='+encodeURIComponent(body.phone));let b=r.contact||(r.contacts&&r.contacts[0]);if(b){const full=await api('/contacts/'+b.id);b=full.contact||full;}if(b&&((a&&a.id!==b.id)||!identityMatches(body,b)))throw Error('identity_conflict');}return a;}
export async function queueAttribution(body,store){
 const evidence=sanitizeEvidence(body.attribution);if(!evidence)return null;store=store||attributionStore();
 const email=String(body.email||'').trim().toLowerCase();if(!email)return null;
 let id=hash(email+'\n'+JSON.stringify(evidence));
 for(let retry=0;retry<10;retry++){const prior=await store.get('completed/'+id,{type:'json'});if(prior?.status!=='intake_rejected')break;id=hash(id+'retry');}
 const key='pending/'+id;
 const entry={version:1,id,email,phoneHash:body.phone?hash(phone(body.phone)):null,evidence,status:'awaiting_intake',createdAt:new Date().toISOString(),attempts:0};
 if(await store.get('completed/'+id,{type:'json'}))return id;
 await store.setJSON(key,entry,{onlyIfNew:true});const saved=await store.get(key,{type:'json'});if(!saved||saved.id!==id)throw Error('receipt_readback_failed');return id;
}
export async function processReceipt(id,store=attributionStore(),api=ghl){
 const key='pending/'+id;const done=await store.get('completed/'+id,{type:'json'});if(done)return {status:done.status};let receipt=await store.get(key,{type:'json'});if(!receipt)return {status:'missing_receipt'};if(receipt.status==='awaiting_intake'&&Date.now()-Date.parse(receipt.createdAt)<60000)return {status:'awaiting_intake'};
 if(Date.now()-Date.parse(receipt.createdAt)>30*86400000){await store.setJSON('completed/'+id,{id,status:'expired',createdAt:receipt.createdAt,updatedAt:new Date().toISOString()},{onlyIfNew:true});if(await store.get('completed/'+id,{type:'json'}))await store.delete(key);return {status:'expired'};}
 if(['recorded','identity_conflict','review_required','expired','intake_rejected'].includes(receipt.status)){await archiveReceipt(id,receipt.status,store);return {status:receipt.status};}
 let contact=await resolveContact({email:receipt.email},api);if(!contact){await store.setJSON(key,{...receipt,status:'pending_contact_creation',attempts:receipt.attempts+1,nextAttemptAt:Date.now()+3600000});return {status:'pending_contact_creation'};}
 if(receipt.phoneHash&&contact.phone&&hash(phone(contact.phone))!==receipt.phoneHash){await archiveReceipt(id,'identity_conflict',store);return {status:'identity_conflict'};}
 const lockKey='locks/'+contact.id,token=crypto.randomUUID(),now=Date.now();const old=await store.getWithMetadata(lockKey,{type:'json'});if(old?.data?.until>now)return {status:'pending_busy'};
 const lock=await store.setJSON(lockKey,{token,until:now+90000},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(!lock.modified)return {status:'pending_busy'};
 const check=await store.get(lockKey,{type:'json'});if(check?.token!==token)return {status:'pending_busy'};
 try{
  receipt=await store.get(key,{type:'json'});if(receipt.status==='recorded')return {status:'recorded'};
  const fresh=await api('/contacts/'+contact.id);contact=fresh.contact||fresh;if(!identityMatches({email:receipt.email},contact)||(receipt.phoneHash&&contact.phone&&hash(phone(contact.phone))!==receipt.phoneHash)){await archiveReceipt(id,'identity_conflict',store);return {status:'identity_conflict'};}
  const claimKey='claims/'+contact.id;await store.setJSON(claimKey,{receiptId:id,at:new Date().toISOString()},{onlyIfNew:true});const claim=await store.get(claimKey,{type:'json'});
  if(!claim)throw Error('claim_readback_failed');
  const result=await persistAttribution({body:{email:receipt.email,attribution:receipt.evidence},contact,ghl:api,allowCredit:claim.receiptId===id,receiptId:id,noteAttempted:!!receipt.noteAttempted,beforeNote:async()=>{receipt={...receipt,noteAttempted:true};await store.setJSON(key,receipt);}});
  const updated={...receipt,status:result.status,attempts:receipt.attempts+1,contactId:contact.id,updatedAt:new Date().toISOString()};
  if(result.status==='recorded'){const audit={id,status:'recorded',contactId:contact.id,createdAt:receipt.createdAt,updatedAt:updated.updatedAt};await store.setJSON('completed/'+id,audit,{onlyIfNew:true});const verified=await store.get('completed/'+id,{type:'json'});if(verified?.status!=='recorded')throw Error('completion_readback_failed');await store.delete(key);}else if(result.status==='review_required')await archiveReceipt(id,'review_required',store,contact.id);else await store.setJSON(key,updated);return result;
 }finally{const current=await store.getWithMetadata(lockKey,{type:'json'});if(current?.data?.token===token)await store.setJSON(lockKey,{token,until:0},{onlyIfMatch:current.etag});}
}

export async function markReady(id,store=attributionStore()){if(!id)return;const key='pending/'+id;const r=await store.getWithMetadata(key,{type:'json'});if(r?.data?.status==='awaiting_intake')await store.setJSON(key,{...r.data,status:'pending'},{onlyIfMatch:r.etag});}

export async function archiveReceipt(id,status,store=attributionStore(),contactId=null){if(!id)return;const key='pending/'+id;const receipt=await store.get(key,{type:'json'});if(!receipt)return;await store.setJSON('completed/'+id,{id,status,contactId:contactId||receipt.contactId||null,createdAt:receipt.createdAt,updatedAt:new Date().toISOString()},{onlyIfNew:true});if(status==='review_required')console.warn('[attribution] review_required',{receipt:id,contactId:contactId||receipt.contactId||null});const audit=await store.get('completed/'+id,{type:'json'});if(audit)await store.delete(key);}
