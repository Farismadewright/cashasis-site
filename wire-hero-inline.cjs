#!/usr/bin/env node
/* wire-hero-inline.cjs — convert the homepage hero from a pop-out modal to an
   INLINE multi-step wizard inside the hero card, with a TWO-PHASE GHL send:
     Phase 1 (on "Get My Cash Offer"): name/phone/email/address/consent -> GHL (creates contact)
     Phase 2 (after condition + timeline): same email/phone + condition/timeline -> GHL (updates SAME contact)
   Run from the Astro repo root:  node wire-hero-inline.cjs
   Edits only: public/index.html   (hero card markup, one CSS line, the form script)
   Fail-loud: every step asserts exactly one match before anything is written. */

const fs = require('fs');
const P = 'public/index.html';
if (!fs.existsSync(P)) throw new Error('MISSING FILE: ' + P + ' (run from repo root)');
let h = fs.readFileSync(P, 'utf8');

function one(re, label){
  const m = h.match(re);
  if(!m || m.length !== 1) throw new Error(`[${label}] expected 1 match, found ${m?m.length:0}. Aborting (nothing written).`);
  return m;
}
function swap(re, replacement, label){
  one(re, label);
  h = h.replace(re, function(){ return replacement; });   // function form -> no $ interpretation
}

/* ---- 1. extract reusable pieces from current markup (before mutating) ---- */
const FORM = one(/<form id="leadForm">[\s\S]*?<\/form>/, 'extract:form')[0];
const COND = h.match(/<button type="button" class="cao-opt" data-field="condition"[\s\S]*?<\/button>/g) || [];
const TIME = h.match(/<button type="button" class="cao-opt" data-field="timeline"[\s\S]*?<\/button>/g) || [];
const SUCCESS = one(/<div class="cao-check">[\s\S]*?<\/p>/, 'extract:success')[0];
if (COND.length !== 4) throw new Error('expected 4 condition options, found ' + COND.length);
if (TIME.length !== 4) throw new Error('expected 4 timeline options, found ' + TIME.length);

/* ---- 2. build the new inline 4-pane card ---- */
const NEW_CARD =
'<div class="offer-card" id="caoCard">\n' +
'        <div class="cao-prog" id="caoProg"><span id="caoBar"></span></div>\n' +
'        <div class="cao-pane active" data-pane="1">\n' +
'          <h2>Get Your Cash Offer Today</h2>\n' +
'          <p class="sub">Fill out the form and we\'ll be in touch within 24 hours.</p>\n' +
'          ' + FORM + '\n' +
'        </div>\n' +
'        <div class="cao-pane" data-pane="2">\n' +
'          <h4 class="cao-q">What\'s the condition of your property?</h4>\n' +
'          ' + COND.join('\n          ') + '\n' +
'        </div>\n' +
'        <div class="cao-pane" data-pane="3">\n' +
'          <h4 class="cao-q">What\'s your ideal timeline to close?</h4>\n' +
'          ' + TIME.join('\n          ') + '\n' +
'          <button type="button" class="cao-back" id="caoBack">&larr; Back</button>\n' +
'        </div>\n' +
'        <div class="cao-pane cao-done" data-pane="4">\n' +
'          ' + SUCCESS + '\n' +
'        </div>\n' +
'      </div>';

/* ---- 3. apply edits ---- */
// (A) replace the form-only offer-card with the multi-pane card
swap(/<div class="offer-card">[\s\S]*?<\/form>\s*<\/div>/, NEW_CARD, 'A:offer-card');

// (B) delete the old pop-out modal block (keep the <script> that follows)
swap(/<div class="cao-modal" id="caoModal" aria-hidden="true">[\s\S]*?<\/div>\n<script>/, '<script>', 'B:remove-modal');

// (C) add inline progress-bar CSS (anchored on an existing rule)
const PROG_CSS =
'.cao-modal.open{display:flex}\n' +
'  .cao-prog{height:5px;background:rgba(13,27,42,.10);border-radius:999px;overflow:hidden;margin:0 0 20px;visibility:hidden}\n' +
'  .cao-prog span{display:block;height:100%;width:0;background:var(--orange,#F26D21);transition:width .35s ease}\n' +
'  .offer-card .cao-done{padding:8px 0 4px}\n' +
'  .offer-card .cao-q{margin-top:2px}';
swap(/\.cao-modal\.open\{display:flex\}/, PROG_CSS, 'C:prog-css');

// (D) replace the whole form script with the inline two-phase version
const NEW_SCRIPT =
`<script>
(function(){
  var card=document.getElementById('caoCard');
  var form=document.getElementById('leadForm');
  if(!card||!form) return;
  var GHL_WEBHOOK_URL="https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d";
  var panes=card.querySelectorAll('.cao-pane');
  var prog=document.getElementById('caoProg'), bar=document.getElementById('caoBar');
  var WIDTHS={'1':'0%','2':'33%','3':'66%','4':'100%'};
  function pane(n){
    n=String(n);
    panes.forEach(function(p){p.classList.toggle('active',p.getAttribute('data-pane')===n);});
    if(bar) bar.style.width=WIDTHS[n]||'0%';
    if(prog) prog.style.visibility=(n==='1')?'hidden':'visible';
    try{card.scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){}
  }
  function g(nm){var el=form.querySelector('[name="'+nm+'"]');return el?el.value.trim():'';}
  function consent(){var c=form.querySelector('input[name="consent"]');return !!(c&&c.checked);}
  function post(extra){
    var d={full_name:g('name'),phone:g('phone'),email:g('email'),address1:g('address'),tcpa_consent:consent(),source:'cashasis-hero',lead_source:'cashasis-hero',submitted_at:new Date().toISOString()};
    for(var k in extra){d[k]=extra[k];}
    if(GHL_WEBHOOK_URL.indexOf('http')!==0)return;
    fetch(GHL_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).catch(function(){});
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var r=form.querySelectorAll('input[required]');
    for(var i=0;i<r.length;i++){if(!r[i].checkValidity()){r[i].reportValidity();return;}}
    post({page:'step1-contact',stage:'contact'});
    pane(2);
  });
  card.querySelectorAll('.cao-opt').forEach(function(o){
    o.addEventListener('click',function(){
      var f=o.getAttribute('data-field'),v=o.getAttribute('data-val');
      var hid=form.querySelector('input[name="'+f+'"]');if(hid)hid.value=v;
      if(f==='condition'){pane(3);}
      else if(f==='timeline'){
        post({property_condition:g('condition'),selling_timeline:g('timeline'),page:'step3-complete',stage:'qualified'});
        pane(4);
      }
    });
  });
  var bk=document.getElementById('caoBack');if(bk){bk.addEventListener('click',function(){pane(2);});}
})();
</script>`;
swap(/<script>\n\(function\(\)\{[\s\S]*?\}\)\(\);\n<\/script>/, NEW_SCRIPT, 'D:script');

fs.writeFileSync(P, h);
console.log('OK  public/index.html  ->  inline 4-pane hero wizard + two-phase GHL send');
console.log('    Phase 1 fires on "Get My Cash Offer"; Phase 2 on timeline pick (updates same contact).');
console.log('\nNext: npm run build  ->  commit  ->  push.');
