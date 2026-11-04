import crypto from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {hash} from './attribution-queue.js';

// One forward per seller step. A second click can arrive while the first
// request is still waiting on the form webhook, so the claim is taken before
// that call and released if the forward does not succeed.
export const LEAD_DEDUPE_WINDOW_MS = 60000;

const normalizePhone = value => String(value || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

export function leadStep(body) {
  const stage = String(body?.stage || '').trim().toLowerCase();
  if (stage) return stage;
  return String(body?.page || '').trim().toLowerCase();
}

export function leadDedupeKeys(body) {
  const step = leadStep(body);
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = normalizePhone(body?.phone);
  const keys = [];
  if (email) keys.push('dedupe/email/' + hash(email + '\n' + step));
  if (phone) keys.push('dedupe/phone/' + hash(phone + '\n' + step));
  return {step, keys};
}

export function openLeadDedupeStore(context) {
  if (context && Object.prototype.hasOwnProperty.call(context, 'dedupeStore')) return context.dedupeStore;
  // Unit tests pass an explicit store. Outside Netlify, getStore throws; the
  // caller fails open so a local test never touches the live webhook.
  if (process.env.NODE_TEST_CONTEXT) return null;
  return getStore({name: 'cashasis-attribution-v1', consistency: 'strong'});
}

async function releaseKeys(store, keys, token) {
  for (const key of keys) {
    const current = await store.get(key, {type: 'json'});
    if (current && current.token === token) await store.delete(key);
  }
}

export async function reserveLeadSubmission(body, store, now = Date.now()) {
  const {step, keys} = leadDedupeKeys(body);
  const noop = async () => {};
  if (!keys.length) return {duplicate: false, step, release: noop};
  const token = crypto.randomUUID();
  const record = {until: now + LEAD_DEDUPE_WINDOW_MS, step, token};
  const owned = [];

  const duplicate = async () => {
    await releaseKeys(store, owned, token);
    return {duplicate: true, step, release: noop};
  };

  for (const key of keys) {
    const current = await store.get(key, {type: 'json'});
    if (current && current.until > now) return duplicate();
  }

  for (const key of keys) {
    const created = await store.setJSON(key, record, {onlyIfNew: true});
    if (created?.modified) {
      owned.push(key);
      continue;
    }
    const meta = await store.getWithMetadata(key, {type: 'json'});
    if (!meta) {
      const again = await store.setJSON(key, record, {onlyIfNew: true});
      if (again?.modified) {
        owned.push(key);
        continue;
      }
      return duplicate();
    }
    if (meta.data?.until > now) return duplicate();
    const replaced = await store.setJSON(key, record, {onlyIfMatch: meta.etag});
    if (!replaced?.modified) {
      const latest = await store.get(key, {type: 'json'});
      if (latest?.until > now && latest.token !== token) return duplicate();
    }
    owned.push(key);
  }

  return {duplicate: false, step, release: () => releaseKeys(store, owned, token)};
}
