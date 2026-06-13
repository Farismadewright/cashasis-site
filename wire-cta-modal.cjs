#!/usr/bin/env node
/* wire-cta-modal.cjs — add a pop-out modal version of the cash-offer wizard and
   point every "Get My Offer" CTA at it (instead of scrolling up to the hero).
   The hero stays inline; the modal is a self-contained contact -> condition ->
   timeline -> success flow with the same two-phase GHL send.
   Run from the Astro repo root:  node wire-cta-modal.cjs
   Edits only: public/index.html   Fail-loud: asserts each step before writing. */

const fs = require('fs');
const P = 'public/index.html';
if (!fs.existsSync(P)) throw new Error('MISSING FILE: ' + P + ' (run from repo root)');
let h = fs.readFileSync(P, 'utf8');
function assertCount(needle, n, label){
  const c = h.split(needle).length - 1;
  if (c !== n) throw new Error(`[${label}] expected ${n}, found ${c}. Aborting (nothing written).`);
}

/* reuse the option cards + success markup already in the hero (keep identical) */
const COND = h.match(/<button type="button" class="cao-opt" data-field="condition"[\s\S]*?<\/button>/g) || [];
const TIME = h.match(/<button type="button" class="cao-opt" data-field="timeline"[\s\S]*?<\/button>/g) || [];
const SUCCESS = (h.match(/<div class="cao-check">[\s\S]*?<\/p>/) || [])[0];
if (COND.length !== 4) throw new Error('expected 4 condition options, found ' + COND.length);
if (TIME.length !== 4) throw new Error('expected 4 timeline options, found ' + TIME.length);
if (!SUCCESS) throw new Error('success pane not found');

/* (1) convert the 3 CTAs: scroll-to-hero -> open modal */
const OLD_CTA = '<a href="#leadForm" class="btn btn-orange">Get My Offer <span>&rarr;</span></a>';
const NEW_CTA = '<a href="#" class="btn btn-orange" data-cao-open>Get My Offer <span>&rarr;</span></a>';
assertCount(OLD_CTA, 3, '1:ctas');
h = h.split(OLD_CTA).join(NEW_CTA);

/* (2) modal-form CSS (label-above, matches live site), replace the cao media-query anchor */
const ANCHOR = '  @media(max-width:560px){.cao-title{font-size:22px}.cao-done h4{font-size:22px}}';
const MODAL_CSS =
`  .cao-f{margin-bottom:14px}
  .cao-f label{display:block;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-bottom:6px}
  .cao-f input{width:100%;border:1.5px solid rgba(13,27,42,.14);border-radius:10px;padding:13px 14px;font-size:15px;font-family:inherit;color:var(--navy,#0D1B2A);background:#fff;box-sizing:border-box}
  .cao-f input:focus{outline:none;border-color:var(--orange,#F26D21)}
  .cao-frow{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .cao-consent{display:flex;gap:9px;align-items:flex-start;background:#f6f8fa;border-radius:10px;padding:12px 13px;margin:4px 0 16px;font-size:11.5px;line-height:1.5;color:#64748b}
  .cao-consent input{margin-top:2px;flex:0 0 auto;width:15px;height:15px;accent-color:var(--orange,#F26D21)}
  .cao-consent a{color:var(--orange,#F26D21);font-weight:600;text-decoration:none}
  .cao-next{width:100%;border:0;background:var(--orange,#F26D21);color:#fff;font-weight:800;font-size:16px;padding:15px;border-radius:999px;cursor:pointer;font-family:inherit}
  .cao-next:hover{filter:brightness(.96)}
  .cao-foot{text-align:center;font-size:12px;color:#64748b;margin:14px 0 0}
  .cao-foot b{color:var(--navy,#0D1B2A)}
  @media(max-width:480px){.cao-frow{grid-template-columns:1fr}}
  @media(max-width:560px){.cao-title{font-size:22px}.cao-done h4{font-size:22px}}`;
assertCount(ANCHOR, 1, '2:css-anchor');
h = h.split(ANCHOR).join(MODAL_CSS);

/* (3) modal markup + script, injected before </body> */
const MODAL_HTML =
`<div class="cao-modal" id="caoModal" aria-hidden="true">
  <div class="cao-box" role="dialog" aria-modal="true">
    <button class="cao-close" aria-label="Close">&times;</button>
    <div class="cao-head">
      <h3 class="cao-title">Get Your Free Cash Offer</h3>
      <p class="cao-step">Step 1 of 3 &middot; Takes 30 seconds</p>
      <div class="cao-bar"><span style="width:33%"></span></div>
    </div>
    <div class="cao-body">
      <div class="cao-pane active" data-mpane="1">
        <form id="caoModalForm">
          <div class="cao-f"><label>Full Name *</label><input type="text" name="name" placeholder="First &amp; last name" required></div>
          <div class="cao-frow">
            <div class="cao-f"><label>Phone *</label><input type="tel" name="phone" placeholder="(713) 000-0000" required></div>
            <div class="cao-f"><label>Email *</label><input type="email" name="email" placeholder="you@email.com" required></div>
          </div>
          <div class="cao-f"><label>Property Address *</label><input type="text" name="address" placeholder="Start typing your address..." required></div>
          <label class="cao-consent"><input type="checkbox" name="consent" required><span>By submitting, I consent to receive calls, emails &amp; texts (SMS/MMS) from CashAsIs / Mr. Wright Properties at the info provided. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out. Not a condition of purchase. <a href="/privacy">Privacy Policy</a> &amp; <a href="/terms">Terms</a>.</span></label>
          <button type="submit" class="cao-next">Next &rarr;</button>
          <input type="hidden" name="condition">
          <input type="hidden" name="timeline">
          <p class="cao-foot">&#128274; <b>Free &amp; Confidential</b> &middot; No Spam &middot; No Pressure</p>
        </form>
      </div>
      <div class="cao-pane" data-mpane="2">
        <h4 class="cao-q">What's the condition of your property?</h4>
        ${COND.join('\n        ')}
      </div>
      <div class="cao-pane" data-mpane="3">
        <h4 class="cao-q">What's your ideal timeline to close?</h4>
        ${TIME.join('\n        ')}
        <button type="button" class="cao-back">&larr; Back</button>
      </div>
      <div class="cao-pane cao-done" data-mpane="4">
        ${SUCCESS}
      </div>
    </div>
  </div>
</div>
<script>
(function(){
  var modal=document.getElementById('caoModal');
  if(!modal) return;
  var form=document.getElementById('caoModalForm');
  var GHL_WEBHOOK_URL="https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d";
  var panes=modal.querySelectorAll('.cao-pane');
  var titleEl=modal.querySelector('.cao-title'), stepEl=modal.querySelector('.cao-step'), barEl=modal.querySelector('.cao-bar span');
  var META={'1':{t:'Get Your Free Cash Offer',s:'Step 1 of 3 \\u00b7 Takes 30 seconds',w:'33%'},
            '2':{t:'One Quick Question\\u2026',s:'Step 2 of 3 \\u00b7 Almost done',w:'66%'},
            '3':{t:'One Quick Question\\u2026',s:'Step 3 of 3 \\u00b7 Last one',w:'100%'},
            '4':{t:"You're All Set!",s:'Offer incoming within 24 hours',w:'100%'}};
  function pane(n){n=String(n);panes.forEach(function(p){p.classList.toggle('active',p.getAttribute('data-mpane')===n);});var m=META[n];if(m){titleEl.textContent=m.t;stepEl.textContent=m.s;if(barEl)barEl.style.width=m.w;}}
  function openM(){pane(1);modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';}
  function closeM(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';}
  function g(nm){var el=form.querySelector('[name="'+nm+'"]');return el?el.value.trim():'';}
  function consent(){var c=form.querySelector('input[name="consent"]');return !!(c&&c.checked);}
  function post(extra){var d={full_name:g('name'),phone:g('phone'),email:g('email'),address1:g('address'),tcpa_consent:consent(),source:'cashasis-hero',lead_source:'cashasis-hero',submitted_at:new Date().toISOString()};for(var k in extra){d[k]=extra[k];}if(GHL_WEBHOOK_URL.indexOf('http')!==0)return;fetch(GHL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){});}
  document.querySelectorAll('[data-cao-open]').forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();openM();});});
  modal.querySelector('.cao-close').addEventListener('click',closeM);
  modal.addEventListener('click',function(e){if(e.target===modal)closeM();});
  form.addEventListener('submit',function(e){e.preventDefault();var r=form.querySelectorAll('input[required]');for(var i=0;i<r.length;i++){if(!r[i].checkValidity()){r[i].reportValidity();return;}}post({page:'modal-step1-contact',stage:'contact'});pane(2);});
  modal.querySelectorAll('.cao-opt').forEach(function(o){o.addEventListener('click',function(){var f=o.getAttribute('data-field'),v=o.getAttribute('data-val');var hid=form.querySelector('input[name="'+f+'"]');if(hid)hid.value=v;if(f==='condition'){pane(3);}else if(f==='timeline'){post({property_condition:g('condition'),selling_timeline:g('timeline'),page:'modal-step3-complete',stage:'qualified'});pane(4);}});});
  var bk=modal.querySelector('.cao-back');if(bk){bk.addEventListener('click',function(){pane(2);});}
})();
</script>
</body>`;
assertCount('</body>', 1, '3:body');
h = h.split('</body>').join(MODAL_HTML);

fs.writeFileSync(P, h);
console.log('OK  public/index.html  ->  pop-out modal added; 3 "Get My Offer" CTAs now open it (hero stays inline).');
console.log('\nNext: npm run build  ->  commit  ->  push.');
