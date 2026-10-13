import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const [background,output,headline,variant="white"]=process.argv.slice(2);
if(!background||!output||!headline)throw Error('Usage: BACKGROUND OUTPUT "LINE ONE|LINE TWO"');
if(!['white','navy'].includes(variant))throw Error('Logo variant must be white or navy');
const lines=headline.split('|'),count=headline.replaceAll('|',' ').trim().split(/\s+/).length;
if(count<3||count>7||lines.length>3||lines.some(x=>!x.trim()))throw Error('Require 3–7 words, 1–3 nonempty lines');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=[];let y=250;
for(let i=0;i<lines.length;i++){
 const img=await sharp({text:{text:`<span foreground="${i===1?'#ff6900':'#ffffff'}">${escape(lines[i])}</span>`,font:'DejaVu Sans Bold 76',fontfile:path.join(root,'assets/headline-bold.ttf'),rgba:true,dpi:72}}).png().toBuffer();
 const m=await sharp(img).metadata();if(m.width>670||y+m.height>565)throw Error('Headline overflow; shorten it');
 text.push({input:img,left:44,top:y});y+=90;
}
const overlay=Buffer.from('<svg width="1200" height="630"><defs><linearGradient id="g"><stop stop-color="#061a28" stop-opacity=".97"/><stop offset=".7" stop-color="#061a28" stop-opacity=".9"/><stop offset="1" stop-color="#061a28" stop-opacity="0"/></linearGradient></defs><rect width="800" height="630" fill="url(#g)"/><rect x="44" y="570" width="570" height="9" fill="#ff6900"/></svg>');
const logoPath=path.join(root,`assets/official-logo-${variant}.png`);
const logoMeta=await sharp(logoPath).metadata(),logoStats=await sharp(logoPath).stats();
if(!logoMeta.hasAlpha||logoStats.channels[3]?.min!==0)throw Error('Logo must have a transparent alpha background');
const logo=await sharp(logoPath).trim().resize({width:490,height:125,fit:'inside'}).png().toBuffer();
await sharp(background).resize(1200,630,{fit:'cover'}).composite([{input:overlay},{input:logo,left:44,top:42},...text]).png().toFile(output);
console.log(JSON.stringify({output,width:1200,height:630,headline,template:'left-photo-transparent-v2',logoVariant:variant,productionApproved:false}));
