const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const repo=path.resolve(process.argv[2]||'.'),output=path.resolve(process.argv[3]||'.');fs.mkdirSync(output,{recursive:true});const slug=process.argv[4]||'publisher-validation';assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
const {chromium:playwright}=require('playwright');
(async()=>{const server=require('http').createServer((req,res)=>{let filePath=path.join(repo,'dist')+decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(filePath.endsWith('/'))filePath+='index.html';try{res.setHeader('Content-Type',filePath.endsWith('.css')?'text/css':filePath.endsWith('.js')?'text/javascript':filePath.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(filePath));}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
const b=await playwright.launch({args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"],executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true});
const results=[];
try{for(const width of [360,390,768,1366]){
 const c=await b.newContext({viewport:{width,height:850},deviceScaleFactor:1});const p=await c.newPage();
 await p.goto(`http://127.0.0.1:8766/blog/${slug}/`,{waitUntil:'domcontentloaded'});await p.locator('.article-hero').waitFor();
 const d=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.querySelector('.article-body').getBoundingClientRect().width,table:document.querySelector('table')?.getBoundingClientRect().width||0,tableScrollSafe: (()=>{const t=document.querySelector('table');if(!t)return true;const p=t.parentElement;return getComputedStyle(p).overflowX==='auto'&&p.getBoundingClientRect().width<=document.querySelector('.article-body').getBoundingClientRect().width;})(),image:document.querySelector('.article-hero').getBoundingClientRect().width,imageLoaded:document.querySelector('.article-hero').naturalWidth,h1s:document.querySelectorAll('h1').length,canonical:document.querySelector('link[rel=canonical]').href,og:document.querySelector('meta[property="og:image"]').content}));
 const summary=p.locator('.faq summary').first();if(await summary.count()){await summary.click();assert(await summary.evaluate(el=>el.parentElement.open));}
 await p.screenshot({path:path.join(output,`mobile-${width}.png`),fullPage:true});
 results.push(d);assert(d.scroll<=width,'horizontal overflow at '+width);assert(d.table<=d.body||d.tableScrollSafe,'table overflow at '+width);assert(d.image<=d.body,'image overflow');assert.equal(d.imageLoaded,1200);assert.equal(d.h1s,1);await c.close();
 }
}catch(e){fs.writeFileSync(path.join(output,'mobile-results.json'),JSON.stringify({passed:false,results,error:e.message},null,2));throw e;}finally{await b.close();server.close();}
fs.writeFileSync(path.join(output,'mobile-results.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results));})();
