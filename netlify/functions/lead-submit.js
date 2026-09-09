const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';

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

exports.handler = async function handler(event) {
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

  const outbound = { ...body };
  delete outbound._website;
  delete outbound._started_at;

  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(outbound),
    });
    const upstreamText = await response.text();
    if (!response.ok) {
      console.error('[lead-submit] GHL rejected request', response.status, upstreamText);
      return json(502, { ok: false, error: 'upstream_error', status: response.status });
    }
    console.log('[lead-submit] forwarded lead', { email: outbound.email, address: outbound.address1, stage: outbound.stage });
    return json(200, { ok: true, forwarded: true, upstream_status: response.status });
  } catch (err) {
    console.error('[lead-submit] GHL request failed', err && err.message);
    return json(502, { ok: false, error: 'upstream_unavailable' });
  }
};
