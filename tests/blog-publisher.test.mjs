import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {sanitizeEvidence,classify} from '../netlify/functions/_shared/attribution.js';
const ctx={module:{exports:{}},URL,Date};vm.runInNewContext(fs.readFileSync('dist/js/cashasis-attribution.js','utf8'),ctx);
const {capture,safeUrl}=ctx.module.exports,now=Date.now();
const slug='sell-house-with-tenants-houston';
test('published organic landing and internal blog CTA retain acquisition plus slug',()=>{
 const landing=capture(`https://www.cashasis.com/blog/${slug}/`,'https://www.google.com/search',null,now);
 const form=capture(`https://www.cashasis.com/?utm_source=blog&utm_medium=cta&utm_campaign=blog_cta&utm_content=${slug}&utm_term=post`,`https://www.cashasis.com/blog/${slug}/`,landing,now+100);
 const safe=sanitizeEvidence(form);assert.equal(safe.first.url,`https://www.cashasis.com/blog/${slug}/`);assert.equal(classify(safe.first),'google_organic');assert.equal(safe.blog.slug,slug);assert.equal(safe.latest.utm_source,undefined);
});
test('arbitrary private URL and unrecognized blog slug are stripped',()=>{
 assert.equal(safeUrl('https://www.cashasis.com/blog/private-contact-7135550000/?secret=x'),'https://www.cashasis.com/');
 const a=capture('https://www.cashasis.com/?utm_source=blog&utm_medium=cta&utm_content=private-contact-7135550000','',null,now);assert.equal(sanitizeEvidence(a).blog,undefined);
});
test('metadata has sharing image, keywords and breadcrumb without extra H1',()=>{
 const html=fs.readFileSync(`dist/blog/${slug}/index.html`,'utf8');assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(const key of ['og:title','og:description','og:image','twitter:card','twitter:image','BreadcrumbList','BlogPosting','canonical'])assert(html.includes(key),key);
});
