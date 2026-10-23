import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const targets=['dist/index.html','dist/fix-it-or-sell-it/index.html'];
test('generated capture injected once, forms instrumented, inline scripts parse',()=>{for(const f of targets){const html=fs.readFileSync(f,'utf8');assert.equal((html.match(/src="\/js\/cashasis-attribution.js"/g)||[]).length,1);assert(html.includes('window.cashasisAttribution.enrich(d)'));assert(!html.includes('body:JSON.stringify(d)'));for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)){if(/ld\+json|type="module"/.test(m[1])||!m[2].trim())continue;new vm.Script(m[2],{filename:f});}}});
test('build postprocessor idempotent',()=>{const before=targets.map(f=>fs.readFileSync(f,'utf8'));execFileSync('node',['scripts/inject-attribution.mjs']);assert.deepEqual(targets.map(f=>fs.readFileSync(f,'utf8')),before);});
// Visual facelift (approved): these two files are no longer frozen to 290fa66.
// The pin is the facelift source. Head, tracking, form fields, and routes stay covered by verify_against_baseline.py.
// Homepage pin includes the visual hero rotation list only.
const visualPins={
  'public/index.html':'0648631391f7a00d81547fe7fdb03f70daf74888728778b2974f3d20e8845802',
  'src/pages/fix-it-or-sell-it.astro':'f0b90367373b214362fe9b20c411598cd2d5468c88ae8b4a636d46384d193d44'
};
test('homepage and calculator source files match the visual facelift pin',()=>{for(const [f,hex] of Object.entries(visualPins))assert.equal(createHash('sha256').update(fs.readFileSync(f)).digest('hex'),hex,f);});
