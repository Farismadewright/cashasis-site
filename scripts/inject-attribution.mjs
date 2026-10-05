// Add attribution to generated seller pages without copying unrelated page configuration or public keys.
import fs from 'node:fs';import path from 'node:path';
const root='dist';let pages=0,forms=0;
function walk(dir){for(const name of fs.readdirSync(dir)){const f=path.join(dir,name);if(fs.statSync(f).isDirectory()){walk(f);continue;}if(!f.endsWith('.html'))continue;let html=fs.readFileSync(f,'utf8');if(!html.includes('</head>'))continue;
if(!html.includes('src="/js/cashasis-attribution.js"'))html=html.replace('</head>','<script src="/js/cashasis-attribution.js"></script>\n</head>');pages++;
if(['dist/index.html','dist/fix-it-or-sell-it/index.html'].includes(f)){
 const before=html;html=html.replaceAll('body:JSON.stringify(d)','body:JSON.stringify(window.cashasisAttribution?window.cashasisAttribution.enrich(d):d)');
 if(html===before&&!html.includes('window.cashasisAttribution.enrich(d)'))throw Error('Seller form changed: attribution integration requires review: '+f);forms++;
 html=html.replaceAll('.then(function(data){if(typeof fbq','.then(function(data){if(data.is_test)return data;if(typeof fbq').replaceAll('.then(function(data){var page=','.then(function(data){if(data.is_test)return data;var page=');
 html=html.replaceAll('.then(function(){if(typeof fbq','.then(function(data){if(!data.is_test&&typeof fbq').replaceAll(";if(typeof gtag==='function')gtag('event','form_start'",";if(!data.is_test&&typeof gtag==='function')gtag('event','form_start'").replaceAll(";if(typeof gtag==='function')gtag('event','generate_lead'",";if(!data.is_test&&typeof gtag==='function')gtag('event','generate_lead'");
}
fs.writeFileSync(f,html);
}}
walk(root);if(forms!==2)throw Error('Expected homepage and calculator seller form pages; found '+forms);console.log('Attribution injected:',pages,'pages,',forms,'seller form pages');
