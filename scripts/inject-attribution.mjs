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

// Allow only actually built public blog paths, so new posts retain attribution.
const blogPaths=[];
for(const dir of fs.readdirSync(path.join(root,'blog'),{withFileTypes:true})){
 if(dir.isDirectory()&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dir.name)&&fs.existsSync(path.join(root,'blog',dir.name,'index.html')))blogPaths.push('/blog/'+dir.name+'/');
}
blogPaths.sort();
fs.writeFileSync('netlify/functions/_shared/published-blog-paths.js','export const PUBLISHED_BLOG_PATHS = new Set('+JSON.stringify(blogPaths)+');\n');
const jsPath=path.join(root,'js/cashasis-attribution.js');
let js=fs.readFileSync(jsPath,'utf8');
const match=js.match(/var KNOWN_PATHS=new Set\((\[[^;]+\])\);/);
if(!match)throw Error('Attribution path allowlist format changed');
const known=[...new Set([...JSON.parse(match[1]),...blogPaths,...blogPaths.map(p=>p.slice(0,-1))])];
js=js.replace(match[0],'var KNOWN_PATHS=new Set('+JSON.stringify(known)+');');
fs.writeFileSync(jsPath,js);
