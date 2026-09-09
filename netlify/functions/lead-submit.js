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

function validOrigin(headers = {}) {
  const origin = String(headers.origin || headers.Origin || '').toLowerCase();
  const referer = String(headers.referer || headers.Referer || '').toLowerCase();
  const ok = (v) => {
    if (!v) return false;
    try {
      const host = new URL(v).hostname;
      return host === 'cashasis.com' || host === 'www.cashasis.com' || host.endsWith('.netlify.app');
    } catch (_) {
      return false;
    }
  };
  // Netlify/internal same-origin requests can occasionally arrive without Origin.
  // Referer is accepted as the fallback, and production requests are still
  // protected by honeypot + timing + field-shape checks below.
  return ok(origin) || ok(referer);
}

function looksHumanAddress(value) {
  const s = String(value || '').trim();
  if (s.length < 5 || s.length > 180) return false;
  if (!/[a-z]/i.test(s)) return false;
  // The spam we are seeing is a single random token (e.g. QF43wMoClE).
  // A real address normally contains a number OR multiple words.
  if (!/\d/.test(s) && !/\s/.test(s)) return false;
  return true;
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  // Keep this permissive enough for legitimate form tests / international users;
  // the bot filter does not depend on phone alone.
  return digits.length >= 7 && digits.length <= 15;
}

function validEmail(value) {
  const s = String(value || '').trim();
  return s.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { ok: false, error: 'invalid_json' }); }

  if (!validOrigin(event.headers)) {
    console.warn('[lead-submit] filtered invalid_origin');
    return json(403, { ok: false, error: 'invalid_origin' });
  }

  // Honeypot: real users never see/fill this field.
  if (String(body._website || '').trim()) {
    console.warn('[lead-submit] filtered honeypot');
    return json(200, { ok: true, filtered: true, reason: 'honeypot' });
  }

  // Reject machine-speed submissions and stale/replayed sessions, but keep the
  // threshold low enough that quick real users are never blocked.
  const startedAt = Number(body._started_at || 0);
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 500 || elapsed > 2 * 60 * 60 * 1000) {
    console.warn('[lead-submit] filtered timing', { startedAt: !!startedAt, elapsed });
    return json(200, { ok: true, filtered: true, reason: 'timing' });
  }

  const name = String(body.full_name || '').trim();
  const address = String(body.address1 || '').trim();
  if (name.length < 2 || name.length > 100) {
    console.warn('[lead-submit] filtered name');
    return json(200, { ok: true, filtered: true, reason: 'name' });
  }
  if (!looksHumanAddress(address)) {
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
    if (!response.ok) {
      const text = await response.text();
      console.error('[lead-submit] GHL rejected request', response.status, text);
      return json(502, { ok: false, error: 'upstream_error' });
    }
    console.log('[lead-submit] forwarded lead', { email: outbound.email, address: outbound.address1, stage: outbound.stage });
    return json(200, { ok: true, forwarded: true });
  } catch (err) {
    console.error('[lead-submit] GHL request failed', err && err.message);
    return json(502, { ok: false, error: 'upstream_unavailable' });
  }
};
