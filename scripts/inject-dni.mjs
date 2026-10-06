// Add native call tracking to generated output; preserve source and form logic.
import fs from 'node:fs';
import path from 'node:path';

const root = 'dist';
const loader = '<script src="/js/cashasis-dni.js"></script>';
const formPages = new Map([
  ['dist/index.html', 4],
  ['dist/fix-it-or-sell-it/index.html', 2],
]);
let pages = 0;
let forms = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) { walk(file); continue; }
    if (!file.endsWith('.html')) continue;
    let html = fs.readFileSync(file, 'utf8');
    // Mark existing main-number links without changing their E.164 targets.
    html = html.replace(/<a\b[^>]*\bhref=(['"])tel:\+13465846365\1[^>]*>/gi,
      tag => /\bdata-cashasis-call\b/.test(tag) ? tag : tag.replace(/^<a\b/i, '<a data-cashasis-call'));

    if (formPages.has(file)) {
      const literal = 'call (346) 584-6365.';
      const dynamic = "call '+(window.cashasisDni?window.cashasisDni.phone():'(346) 584-6365')+'.";
      const originalCount = html.split(literal).length - 1;
      const dynamicCount = html.split(dynamic).length - 1;
      if (originalCount + dynamicCount !== formPages.get(file)) {
        throw new Error('Seller phone error messages changed; review DNI integration: ' + file);
      }
      html = html.replaceAll(literal, dynamic);
      forms++;
    }

    if (html.includes('data-cashasis-call')) {
      if (!html.includes('</body>')) throw new Error('Missing body end: ' + file);
      if (!html.includes(loader)) html = html.replace('</body>', loader + '\n</body>');
      pages++;
    }
    fs.writeFileSync(file, html);
  }
}

walk(root);
if (forms !== 2) throw new Error('Expected two seller-form pages; found ' + forms);
if (!pages) throw new Error('No main-number pages found for native call tracking');
console.log('Native DNI prepared:', pages, 'pages,', forms, 'seller-form pages');
