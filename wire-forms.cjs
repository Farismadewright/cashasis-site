#!/usr/bin/env node
/* wire-forms.cjs — point the 3 CashAsIs forms at their GHL inbound webhooks.
   Run from the Astro repo root:  node wire-forms.cjs
   Edits: public/index.html, public/referrals/index.html, public/careers/index.html
   Fail-loud: every replacement asserts it matched exactly once. */

const fs = require('fs');

const U_CASH = 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';
const U_REF  = 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/071feb27-21ed-4d9f-9a42-f37434b63391';
const U_CAR  = 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/c8b6ae21-59e6-494d-b8db-01952bd41bd0';

function read(p){ if(!fs.existsSync(p)) throw new Error('MISSING FILE: '+p); return fs.readFileSync(p,'utf8'); }
function replOnce(h, oldStr, newStr, label){
  const n = h.split(oldStr).length - 1;
  if(n !== 1) throw new Error(`[${label}] expected 1 match, found ${n}. Aborting (no files written).`);
  return h.split(oldStr).join(newStr);
}
function replRe(h, re, newStr, label){
  const m = h.match(re);
  if(!m || m.length !== 1) throw new Error(`[${label}] regex expected 1 match, found ${m?m.length:0}. Aborting.`);
  return h.replace(re, newStr);
}

/* ---------------- HOMEPAGE MODAL (Get My Cash Offer) ---------------- */
let idx = read('public/index.html');
idx = replOnce(idx,
  'var GHL_WEBHOOK_URL="PASTE_YOUR_GHL_INBOUND_WEBHOOK_URL_HERE";',
  'var GHL_WEBHOOK_URL="'+U_CASH+'";',
  'home:url');

const OLD_SL = `function submitLead(){var d={};new FormData(form).forEach(function(v,k){d[k]=v;});var c=form.querySelector('input[name="consent"]');d.consent=(c&&c.checked)?'yes':'no';d.page='homepage';d.site='cashasis.com';pane(4);if(GHL_WEBHOOK_URL.indexOf('PASTE_')===0)return;fetch(GHL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){});}`;
const NEW_SL = `function submitLead(){var g=function(n){var el=form.querySelector('[name="'+n+'"]');return el?el.value.trim():'';};var c=form.querySelector('input[name="consent"]');var d={full_name:g('name'),phone:g('phone'),email:g('email'),address1:g('address'),property_condition:g('condition'),selling_timeline:g('timeline'),tcpa_consent:!!(c&&c.checked),source:'cashasis-hero',lead_source:'cashasis-hero',page:'hero-modal',page_number:3,submitted_at:new Date().toISOString()};pane(4);if(GHL_WEBHOOK_URL.indexOf('http')!==0)return;fetch(GHL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){});}`;
idx = replOnce(idx, OLD_SL, NEW_SL, 'home:submitLead');
fs.writeFileSync('public/index.html', idx);
console.log('OK  public/index.html  (cash-offer webhook + payload keys)');

/* ---------------- REFERRALS ---------------- */
let ref = read('public/referrals/index.html');
ref = replOnce(ref,
  'const RAILWAY_REFERRAL_ENDPOINT = "https://YOUR-RAILWAY-AGENT-URL/referral"; // <-- fill in',
  'const RAILWAY_REFERRAL_ENDPOINT = "'+U_REF+'"; // GHL referrals webhook',
  'ref:endpoint');
ref = replOnce(ref,
  'const DEMO = true; // <-- set to false once the endpoint is live',
  'const DEMO = false; // live -> posts to GHL',
  'ref:demo');
ref = replOnce(ref,
  'photos: photos.map(p => p.dataUrl),   // base64; Railway uploads to storage + CRM',
  'photos: [],   // base64 omitted on direct-to-GHL (1MB webhook limit) — use photoLink',
  'ref:photos');
fs.writeFileSync('public/referrals/index.html', ref);
console.log('OK  public/referrals/index.html  (referrals webhook, DEMO off, photos stripped)');

/* ---------------- CAREERS ---------------- */
let car = read('public/careers/index.html');
car = replOnce(car,
  'const CAREERS_ENDPOINT = "https://YOUR-ENDPOINT-URL/careers"; // <-- fill in',
  'const CAREERS_ENDPOINT = "'+U_CAR+'"; // GHL careers webhook',
  'car:endpoint');
car = replOnce(car,
  'const DEMO = true; // <-- set to false once the endpoint is live',
  'const DEMO = false; // live -> posts to GHL',
  'car:demo');
const NEW_BP = `function buildPayload(){
  var _n = document.getElementById('app-name').value.trim();
  var _sp = _n.indexOf(' ');
  return {
    full_name: _n,
    first_name: _sp>0 ? _n.slice(0,_sp) : _n,
    last_name:  _sp>0 ? _n.slice(_sp+1) : '',
    phone: document.getElementById('app-phone').value.trim(),
    email: document.getElementById('app-email').value.trim(),
    city:  document.getElementById('app-city').value.trim(),
    state: document.getElementById('app-state').value.trim(),
    position: positionSel.value,
    availability: (document.querySelector('input[name="availability"]:checked') || {}).value || '',
    experience:   (document.querySelector('input[name="experience"]:checked') || {}).value || '',
    has_transportation: document.getElementById('app-transport').checked ? 'Yes' : 'No',
    cover_letter:   document.getElementById('app-cover').value.trim(),
    portfolio_link: document.getElementById('app-link').value.trim(),
    heard_from:     document.getElementById('app-source').value.trim(),
    resume_link:    document.getElementById('resume-link').value.trim(),
    resume_filename: resume ? resume.name : '',
    source: 'cashasis-careers',
    tags: 'careers, applicant, needs-review'
  };
}`;
car = replRe(car, /function buildPayload\(\)\{[\s\S]*?\n\}/, NEW_BP, 'car:buildPayload');
fs.writeFileSync('public/careers/index.html', car);
console.log('OK  public/careers/index.html  (careers webhook, DEMO off, payload flattened)');

console.log('\nAll 3 forms wired. Next: npm run build  ->  commit  ->  push.');
