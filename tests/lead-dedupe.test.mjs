import test from 'node:test';
import assert from 'node:assert/strict';
import submitHandler from '../netlify/functions/lead-submit.js';
import {LEAD_DEDUPE_WINDOW_MS, leadDedupeKeys, reserveLeadSubmission} from '../netlify/functions/_shared/lead-dedupe.js';

const WEBHOOK = 'https://ghl-webhook.test/mock';
const contextBase = {deploy: {context: 'production', published: true}};
const seller = {
  full_name: 'Controlled Test',
  email: 'controlled@example.com',
  phone: '+1 (713) 555-0101',
  address1: '100 Controlled Test Street',
  tcpa_consent: true,
  stage: 'contact',
  page: 'step1-contact',
};

class MemoryStore {
  constructor() { this.m = new Map(); this.seq = 0; }
  async get(key) {
    await Promise.resolve();
    const hit = this.m.get(key);
    return hit ? structuredClone(hit.data) : null;
  }
  async getWithMetadata(key) {
    await Promise.resolve();
    const hit = this.m.get(key);
    return hit ? structuredClone(hit) : null;
  }
  async setJSON(key, value, options = {}) {
    await Promise.resolve();
    const old = this.m.get(key);
    if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) return {modified: false};
    const etag = String(++this.seq);
    this.m.set(key, {data: structuredClone(value), etag});
    return {modified: true, etag};
  }
  async delete(key) {
    await Promise.resolve();
    this.m.delete(key);
  }
}

function request(body) {
  return new Request('https://www.cashasis.com/.netlify/functions/lead-submit', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  });
}

function installFetch({webhookStatus = 200, holdWebhook = false, contactForEmail = null} = {}) {
  const calls = [];
  let release = () => {};
  globalThis.Netlify = {env: {get: key => key === 'GHL_WEBHOOK_URL' ? WEBHOOK : (String(key).includes('GHL') ? 'controlled-token' : '')}};
  globalThis.fetch = async (url, opt = {}) => {
    const target = String(url);
    if (target.includes('webhook-trigger')) throw new Error('refusing live GHL webhook');
    calls.push(target);
    if (target === WEBHOOK) {
      if (holdWebhook) await new Promise(resolve => { release = resolve; });
      return new Response('{}', {status: webhookStatus});
    }
    if (target.includes('search/duplicate') && target.includes('email=')) {
      return Response.json({contact: contactForEmail});
    }
    if (target.includes('search/duplicate')) return Response.json({contact: null});
    if (target.includes('/contacts/')) return Response.json({contact: contactForEmail || {id: 'c1', email: seller.email, phone: '7135550101'}});
    throw new Error('unexpected ' + target + ' ' + (opt.method || 'GET'));
  };
  return {calls, webhooks: () => calls.filter(url => url === WEBHOOK).length, release: () => release()};
}

test('overlapping step-1 posts forward once while the first request is still in flight', async () => {
  const store = new MemoryStore();
  const net = installFetch({holdWebhook: true});
  const submit = body => submitHandler(request(body), {...contextBase, dedupeStore: store});
  const first = submit({...seller, submitted_at: '2026-11-04T15:25:55.154Z'});
  for (let i = 0; i < 50 && net.webhooks() < 1; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(net.webhooks(), 1);
  const secondResponse = await submit({...seller, submitted_at: '2026-11-04T15:25:56.558Z', page: 'modal-step1-contact'});
  const second = await secondResponse.json();
  assert.equal(secondResponse.status, 200);
  assert.equal(second.ok, true);
  assert.equal(second.deduped, true);
  assert.equal(second.forwarded, false);
  assert.equal(net.webhooks(), 1);
  net.release();
  const firstBody = await (await first).json();
  assert.equal(firstBody.forwarded, true);
  assert.equal(firstBody.deduped, undefined);
  assert.equal(net.webhooks(), 1);
  assert.equal(net.calls.some(url => url.includes('webhook-trigger')), false);
});

test('two racing posts for the same email or phone and step produce one webhook call', async () => {
  const store = new MemoryStore();
  const net = installFetch();
  const submit = body => submitHandler(request(body), {...contextBase, dedupeStore: store});
  const [left, right] = await Promise.all([
    submit({...seller, email: 'race@example.com', submitted_at: '2026-11-04T15:25:55.000Z'}),
    submit({...seller, email: 'race@example.com', phone: '7135550101', submitted_at: '2026-11-04T15:25:56.000Z'}),
  ]);
  const bodies = await Promise.all([left.json(), right.json()]);
  assert.deepEqual(bodies.map(body => body.ok), [true, true]);
  assert.equal(bodies.filter(body => body.forwarded).length, 1);
  assert.equal(bodies.filter(body => body.deduped).length, 1);
  assert.equal(net.webhooks(), 1);
});

test('same phone with a different email is the same lead for that step', async () => {
  const store = new MemoryStore();
  const net = installFetch();
  const submit = body => submitHandler(request(body), {...contextBase, dedupeStore: store});
  assert.equal((await (await submit(seller)).json()).forwarded, true);
  const repeat = await (await submit({...seller, email: 'other@example.com', phone: '713.555.0101'})).json();
  assert.equal(repeat.deduped, true);
  assert.equal(net.webhooks(), 1);
});

test('a different step still forwards inside the dedupe window', async () => {
  const store = new MemoryStore();
  const net = installFetch();
  const submit = body => submitHandler(request(body), {...contextBase, dedupeStore: store});
  await submit({...seller, email: 'steps@example.com'});
  const qualified = await (await submit({...seller, email: 'steps@example.com', stage: 'qualified', page: 'step3-complete'})).json();
  assert.equal(qualified.forwarded, true);
  assert.equal(net.webhooks(), 2);
});

test('failed forward releases the claim so a retry is delivered', async () => {
  const store = new MemoryStore();
  let attempts = 0;
  globalThis.Netlify = {env: {get: key => key === 'GHL_WEBHOOK_URL' ? WEBHOOK : (String(key).includes('GHL') ? 'controlled-token' : '')}};
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('webhook-trigger')) throw new Error('refusing live GHL webhook');
    if (target === WEBHOOK) {
      attempts += 1;
      return new Response('no', {status: attempts === 1 ? 500 : 200});
    }
    if (target.includes('search/duplicate')) return Response.json({contact: null});
    throw new Error('unexpected ' + target);
  };
  const submit = () => submitHandler(request({...seller, email: 'retry@example.com'}), {...contextBase, dedupeStore: store});
  assert.equal((await submit()).status, 502);
  const retried = await (await submit()).json();
  assert.equal(retried.forwarded, true);
  assert.equal(attempts, 2);
});

test('blob store missing fails open and still does not call the live webhook', async () => {
  const previous = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  try {
    const net = installFetch();
    const response = await submitHandler(request({...seller, email: 'failopen@example.com'}), contextBase);
    const body = await response.json();
    assert.equal(body.forwarded, true);
    assert.equal(net.webhooks(), 1);
    assert.equal(net.calls.some(url => url.includes('webhook-trigger')), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_TEST_CONTEXT;
    else process.env.NODE_TEST_CONTEXT = previous;
  }
});

test('dedupe key is email or phone plus step, expires after 60 seconds, and stores no raw contact', async () => {
  const store = new MemoryStore();
  const now = 1_700_000_000_000;
  const body = {...seller, email: 'Case@Example.com', phone: '+1 713-555-0101'};
  const first = await reserveLeadSubmission(body, store, now);
  assert.equal(first.duplicate, false);
  assert.equal((await reserveLeadSubmission({...body, email: 'case@example.com', phone: '19995550199'}, store, now + 1000)).duplicate, true);
  assert.equal((await reserveLeadSubmission({...body, email: 'different@example.com', phone: '(713) 555-0101'}, store, now + 1000)).duplicate, true);
  assert.equal((await reserveLeadSubmission(body, store, now + LEAD_DEDUPE_WINDOW_MS - 1)).duplicate, true);
  assert.equal((await reserveLeadSubmission(body, store, now + LEAD_DEDUPE_WINDOW_MS)).duplicate, false);
  const saved = [...store.m.values()].map(entry => JSON.stringify(entry.data)).join('\n');
  assert.equal(saved.includes('@'), false);
  assert.equal(saved.includes('555-0101'), false);
  assert.equal(saved.includes('7135550101'), false);
  assert.equal(leadDedupeKeys(body).keys.length, 2);
});
