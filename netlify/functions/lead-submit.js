const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': 'https://cashasis.com',
    'vary': 'Origin',
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
  return ok(origin) || ok(referer);
}

function looksHumanAddress(value) {
  const s = String(value || '').trim();
  if (s.length < 8 || s.length > 180) return false;
  if (!/[a-z]/i.test(s) || !/\d/.test(s)) return false;
  // Blocks obvious random-token submissions while allowing normal US addresses.
  const compact = s.replace(/[^a-z0-9]/gi, '');
  if (compact.length >= 8 && !/\s/.test(s)) return false;
  return true;
}

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function validEmail(value) {
  const s = String(value || '').trim();
  return s.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!validOrigin(event.headers)) return json(403, { ok: false, error: 'invalid_origin' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { ok: false, error: 'invalid_json' }); }

  // Honeypot: real users never see/fill this field.
  if (String(body._website || '').trim()) return json(200, { ok: true, filtered: true });

  // Human timing: reject instant form posts and stale/replayed page sessions.
  const startedAt = Number(body._started_at || 0);
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 1500 || elapsed > 2 * 60 * 60 * 1000) {
    return json(200, { ok: true, filtered: true });
  }

  const name = String(body.full_name || '').trim();
  const address = String(body.address1 || '').trim();
  if (name.length < 2 || name.length > 100 || !looksHumanAddress(address) || !validPhone(body.phone) || !validEmail(body.email)) {
    return json(200, { ok: true, filtered: true });
  }

  // Never pass anti-bot metadata into GHL.
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
      console.error('[lead-submit] GHL rejected request', response.status, await response.text());
      return json(502, { ok: false, error: 'upstream_error' });
    }
    return json(200, { ok: true });
  } catch (err) {
    console.error('[lead-submit] GHL request failed', err && err.message);
    return json(502, { ok: false, error: 'upstream_unavailable' });
  }
};
