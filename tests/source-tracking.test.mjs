import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const rd=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const intake=rd('../supabase/functions/careers-intake/index.ts');
const sql=rd('../supabase/migrations/20261024164253_hiring_candidates_source_tracking.sql');
// Pull the pure sanitizer helpers out of the edge function and run them under Node.
const helpers=intake.slice(intake.indexOf('function cleanTag'),intake.indexOf('Deno.serve'))
  .replace('(v: unknown, max: number): string | null','(v, max)').replace('(v: unknown): string | null','(v)')
  .replace('(v: unknown, now: number): string | null','(v, now)').replace('(raw: unknown, now: number)','(raw, now)').replace('raw as Record<string, unknown>','raw');
const readAttribution=new Function(helpers+';return readAttribution;')();
const now=Date.now();
test('sanitizer lower-cases, caps and rejects junk',()=>{
  const a=readAttribution({utm_source:' Facebook ',utm_medium:'POST',utm_campaign:'Oct26-ACQ',utm_content:'x'.repeat(500),landing_url:'https://www.cashasis.com/careers?x=1',first_touch_at:new Date(now-864e5).toISOString()},now);
  assert.equal(a.utm_source,'facebook');assert.equal(a.utm_medium,'post');assert.equal(a.utm_campaign,'oct26-acq');
  assert.equal(a.utm_content.length,80);assert.equal(a.landing_url,'https://www.cashasis.com/careers');assert.ok(a.first_touch_at);
  const b=readAttribution({utm_source:{x:1},utm_medium:'../../x',utm_campaign:'7135550101',landing_url:'https://evil.com/careers',first_touch_at:'2001-01-01'},now);
  assert.deepEqual(Object.values(b),[null,null,null,null,null,null]);
  for(const bad of [null,'x',[],42])assert.equal(readAttribution(bad,now).utm_source,null);
});
test('intake never takes source from the client and never fails the application on attribution',()=>{
  assert.match(intake,/source: "cashasis-careers"/);assert.doesNotMatch(intake,/source:\s*p\.source/);
  assert.match(intake,/\.\.\.attribution/);assert.match(intake,/catch \{\s*return \{ utm_source: null/);
});
test('migration is additive only',()=>{
  assert.doesNotMatch(sql.replace(/^--.*$/gm,'').replace(/'[^']*'/g,"''"),/\b(drop|delete|truncate|rename|alter column)\b/i);assert.doesNotMatch(sql,/text\s+not null/i);
  for(const c of ['utm_source','utm_medium','utm_campaign','utm_content','landing_url','first_touch_at'])assert.match(sql,new RegExp('add column if not exists '+c));
});
test('careers form sends attribution, dashboard shows Source + filters',()=>{
  const careers=rd('../public/careers/index.html'),dash=rd('../public/hiring/index.html');
  assert.match(careers,/attribution: attributionFields\(\)/);assert.match(careers,/cashasisAttribution/);
  assert.doesNotMatch(careers,/ghl|leadconnector|msgsndr/i);
  assert.match(dash,/id="fSource"/);assert.match(dash,/<div>Source<\/div>/);
  assert.doesNotMatch(dash,/acquisitions_fit|interview_questions|screening/);
});
