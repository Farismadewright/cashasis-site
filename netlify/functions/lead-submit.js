import { attributionStore, publishedProduction, preflight, queueAttribution, markReady, processReceipt, archiveReceipt } from './_shared/attribution-queue.js';
import crypto from 'node:crypto';

const META_DATASET_ID = '992265673072496';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  },
  body: JSON.stringify(body),
});

function realStreetAddress(value) {
  const s = String(value || '').trim();
  if (s.length < 6 || s.length > 180) return false;
  // For the seller form we require a normal street-number address. This blocks
  // the exact bot pattern we have seen: one random token such as QF43wMoClE.
  if (!/^\s*\d+[a-zA-Z]?\s+.+/.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  return true;
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validEmail(value) {
  const s = String(value || '').trim();
  return s.length >= 5 && s.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}


function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '').trim().toLowerCase()).digest('hex');
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function sendMetaLead(body, event) {
  if(/^attribution\.qa\.(google|meta|organic|preserve)\.20261005@example\.invalid$/i.test(body.email||''))return {ok:true,skipped:true};
  const META_TEST_EVENT_CODE = Netlify.env.get('META_TEST_EVENT_CODE') || '';
  const META_CAPI_ACCESS_TOKEN = Netlify.env.get('META_CAPI_ACCESS_TOKEN') || '';
  if (!META_CAPI_ACCESS_TOKEN) {
    console.warn('[lead-submit] META_CAPI_ACCESS_TOKEN missing; CAPI skipped');
    return { ok: false, skipped: true };
  }
  const page = String(body.page || '');
  const stage = String(body.stage || '');
  if (!(stage === 'qualified' || page.includes('step3-complete'))) return { ok: true, skipped: true };

  const eventId = String(body.meta_event_id || '').trim();
  const headers = event.headers || {};
  const forwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const clientIp = String(forwardedFor).split(',')[0].trim();
  const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
  const userData = {
    em: [sha256(body.email)],
    ph: [sha256(normalizePhone(body.phone))],
  };
  const parts = String(body.full_name || '').trim().split(/\s+/);
  if (parts[0]) userData.fn = [sha256(parts[0])];
  if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(' '))];
  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (body.fbp) userData.fbp = String(body.fbp);
  if (body.fbc) userData.fbc = String(body.fbc);

  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: String(body.event_source_url || 'https://www.cashasis.com/'),
      user_data: userData,
      custom_data: { content_name: 'Seller Lead', content_category: 'seller_lead', form_location: page || 'unknown' },
      ...(eventId ? { event_id: eventId } : {}),
    }],
    ...(META_TEST_EVENT_CODE ? { test_event_code: META_TEST_EVENT_CODE } : {}),
  };

  const response = await fetch(`https://graph.facebook.com/v23.0/${META_DATASET_ID}/events?access_token=${encodeURIComponent(META_CAPI_ACCESS_TOKEN)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error('[lead-submit] Meta CAPI rejected event', response.status, responseText);
    return { ok: false, status: response.status };
  }
  console.log('[lead-submit] Meta CAPI Lead sent', { event_id: eventId || null });
  return { ok: true };
}

async function handler(event, context) {
  const GHL_WEBHOOK_URL = Netlify.env.get('GHL_WEBHOOK_URL') || 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { ok: false, error: 'invalid_json' }); }

  // Honeypot is the first line of defense. Do not reveal a rejection to bots.
  if (String(body._website || '').trim()) {
    console.warn('[lead-submit] filtered honeypot');
    return json(200, { ok: true, filtered: true, reason: 'honeypot' });
  }

  const name = String(body.full_name || '').trim();
  const address = String(body.address1 || '').trim();
  if (name.length < 2 || name.length > 100) {
    console.warn('[lead-submit] filtered name');
    return json(200, { ok: true, filtered: true, reason: 'name' });
  }
  if (!realStreetAddress(address)) {
    console.warn('[lead-submit] filtered address', address);
    return json(200, { ok: true, filtered: true, reason: 'address' });
  }
  if (!validPhone(body.phone)) {
    console.warn('[lead-submit] filtered phone');
    return json(200, { ok: true, filtered: true, reason: 'phone' });
  }
  if (!validEmail(body.email)) {
    console.warn('[lead-submit] filtered email');
    return json(200, { ok: true, filtered: true, reason: 'email' });
  }

  if(body.tcpa_consent!==true)return json(400,{ok:false,error:'consent_required'});
  const outbound = { ...body };
  delete outbound.attribution;
  delete outbound._website;
  delete outbound._started_at;

  const store=body.attribution?attributionStore(context):undefined;
  let receiptId=null;
  try {
    await preflight(body);
    receiptId=await queueAttribution(body,store);
  }catch(err){return json(err.message==='identity_conflict'?409:503,{ok:false,error:err.message==='identity_conflict'?'identity_conflict':'intake_temporarily_unavailable'});}
  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(outbound),
    });
    const upstreamText = await response.text();
    if (!response.ok) {
      if(receiptId)await archiveReceipt(receiptId,'intake_rejected',store);
      console.error('[lead-submit] GHL rejected request', response.status, upstreamText);
      return json(502, { ok: false, error: 'upstream_error', status: response.status });
    }
    console.log('[lead-submit] forwarded lead', { email: outbound.email, address: outbound.address1, stage: outbound.stage });
    let attribution={status:'not_recorded'};
    try { if(receiptId){await markReady(receiptId,store);attribution=await processReceipt(receiptId,store);}else attribution={status:'no_evidence'}; } catch(err) { console.error('[lead-submit] Attribution persistence failed',err.message); attribution={status:'error'}; }
    let capi = { ok: true, skipped: true };
    try { capi = await sendMetaLead(body, event); }
    catch (metaErr) { console.error('[lead-submit] Meta CAPI request failed', metaErr && metaErr.message); capi = { ok: false }; }
    return json(200, { ok: true, forwarded: true, is_test: /^attribution\.qa\.(google|meta|organic|preserve)\.20261005@example\.invalid$/i.test(body.email||''), attribution_status: attribution.status, upstream_status: response.status, capi_ok: !!capi.ok, meta_event_id: body.meta_event_id || null });
  } catch (err) {
    console.error('[lead-submit] GHL request failed', err && err.message);
    return json(502, { ok: false, error: 'upstream_unavailable' });
  }
};

export default async function(request, context) {
  if(request.method==='POST'&&!publishedProduction(context))return Response.json({ok:false,error:'non_production_intake_disabled'},{status:503});
  const result=await handler({httpMethod:request.method,headers:Object.fromEntries(request.headers),body:request.method==='GET'||request.method==='HEAD'?'':await request.text()},context);
  return new Response(result.statusCode===204?null:result.body,{status:result.statusCode,headers:{...result.headers,'x-cashasis-runtime-scope':context?.deploy?.context||'unknown','x-cashasis-current-deploy':String(context?.deploy?.published===true)}});
}
