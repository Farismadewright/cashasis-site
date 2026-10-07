import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
if(process.env.CONTEXT==='production')throw Error('QA-only branch must never publish to production');
const repo=process.cwd();
const out=path.join(repo,'_qa-form/site');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(repo,'_qa-form/index.html'),path.join(out,'index.html')); 
const source=fs.readFileSync(path.join(repo,'public/index.html'),'utf8');
const controller=fs.readFileSync(path.join(repo,'public/js/cashasis-offer.js'),'utf8');
const autocomplete=[...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('(g=>{var h,a,k,p="The Google Maps'))[1];
const mock=fs.readFileSync(path.join(repo,'_qa-form/qa-stubs.js'),'utf8');
let html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,'').replace(/<link\b[^>]*>/gi,'');
html=html.replace(/<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>/gi,(whole,before,url,after)=>{
 if(url.startsWith('/')){const file=path.join(repo,'public',url);if(fs.existsSync(file)){const ext=path.extname(file).slice(1);return '<img'+before+'src="data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+fs.readFileSync(file).toString('base64')+'"'+after+'>';}}
 return '<img'+before+'src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E"'+after+'>';
});
// Defense in depth: the QA artifact cannot connect to external services even
// if a stub were accidentally removed. No production page is modified.
html=html.replace('<head>','<head>\n<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; frame-src \'none\'; form-action \'none\'; base-uri \'none\'">\n<script>'+mock.replaceAll('</script','<\\/script')+'</script>');
html=html.replace('</body>','<script>'+controller.replaceAll('</script','<\\/script')+'</script><script>'+autocomplete.replaceAll('</script','<\\/script')+'</script></body>');
fs.writeFileSync(path.join(out,'offer-qa.html'),html);
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({base:'5bac7a7b78fc76b6f4be6e7f8e8a4868301d747a',controllerSHA256:crypto.createHash('sha256').update(controller).digest('hex'),homepageSHA256:crypto.createHash('sha256').update(source).digest('hex'),generatedAt:new Date().toISOString(),networkPolicy:'CSP connect-src none; no external scripts, iframes, fonts or images; fetch replaced with in-memory mock',scope:'Actual homepage CSS/markup and unmodified offer controller; mock transport + analytics, no deployment'},null,2));
console.log('Created offline QA HTML:',html.length,'bytes');
