import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const source = fs.readFileSync('public/js/cashasis-dni.js', 'utf8');
const sessionSrc = 'https://backend.leadconnectorhq.com/appengine/js/user_session.js';
const poolSrc = 'https://backend.leadconnectorhq.com/appengine/loc/O3BfhO3fUHCu0LXCtV7e/pool/IfFLw9v6i7Hyetkmz4bS/number_pool.js';
const main = '(346) 584-6365';

function harness(hostname = 'www.cashasis.com', protocol = 'https:') {
  const scripts = [];
  const links = [];
  const document = {
    querySelector(selector) {
      const match = /^script\[src="(.+)"\]$/.exec(selector);
      return match ? scripts.find(script => script.src === match[1]) || null : null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, 'a[data-cashasis-call]');
      return links;
    },
    createElement(tag) {
      assert.equal(tag, 'script');
      return { listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; } };
    },
    body: { appendChild(script) { scripts.push(script); } },
  };
  const root = { document, location: { hostname, protocol } };
  const context = vm.createContext({ window: root });
  const run = () => vm.runInContext(source, context);
  const link = (text, href = 'tel:+13465846365') => {
    const result = { textContent: text, href, getAttribute() { return this.href; } };
    links.push(result);
    return result;
  };
  return { root, scripts, links, run, link };
}

test('only the two exact HTTPS production hosts can load native scripts', () => {
  for (const hostname of ['cashasis.com', 'www.cashasis.com']) {
    const h = harness(hostname); h.run();
    assert.deepEqual(h.scripts.map(s => s.src), [sessionSrc]);
  }
  for (const hostname of ['localhost', 'cashasis-blog.netlify.app', 'main--cashasis-blog.netlify.app',
    'preview.cashasis.com', 'cashasis.com.example.test', 'wwwcashasis.com']) {
    const h = harness(hostname); h.run();
    assert.equal(h.scripts.length, 0, hostname);
    assert.equal(h.root.cashasisDni.phone(), main);
  }
  const http = harness('www.cashasis.com', 'http:'); http.run();
  assert.equal(http.scripts.length, 0);
});

test('session API is ready before native pool script is appended', () => {
  const h = harness(); h.run();
  assert.equal(h.scripts[0].src, sessionSrc);
  assert.equal(h.scripts[0].async, false);
  h.root.userSessionAttribution = {};
  h.scripts[0].listeners.load();
  assert.deepEqual(h.scripts.map(s => s.src), [sessionSrc, poolSrc]);
  assert.equal(h.scripts[1].async, false);
});

test('session failure or missing attribution API fails closed with main available', () => {
  const h = harness(); h.link(main); h.run();
  h.scripts[0].listeners.load();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.root.cashasisDni.phone(), main);
});

test('existing native API is reused and repeated loader execution never duplicates scripts', () => {
  const h = harness(); h.root.userSessionAttribution = {}; h.run(); h.run();
  assert.deepEqual(h.scripts.map(s => s.src), [poolSrc]);
  const api = h.root.cashasisDni;
  h.run(); assert.equal(h.root.cashasisDni, api);
});

test('existing session script waits for its load and native pool URL is not duplicated', () => {
  const h = harness();
  const existing = { src: sessionSrc, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
  h.scripts.push(existing); h.run();
  assert.equal(h.scripts.length, 1);
  h.root.userSessionAttribution = {};
  h.scripts.push({ src: poolSrc });
  existing.listeners.load();
  assert.equal(h.scripts.length, 2);
});

test('phone helper follows actual rendered native changes without replacing or allocating', () => {
  const h = harness('localhost'); const anchor = h.link(main); h.run();
  assert.equal(h.root.cashasisDni.phone(), main);
  anchor.textContent = '(346) 594-0714'; anchor.href = 'tel:+13465940714';
  assert.equal(h.root.cashasisDni.phone(), '(346) 594-0714');
  assert.equal(anchor.href, 'tel:+13465940714');
  assert.equal(h.scripts.length, 0);
});

test('phone helper handles label-only buttons, invalid elements and missing links safely', () => {
  const h = harness('localhost'); h.run();
  assert.equal(h.root.cashasisDni.phone(), main);
  h.link('Call Us', '');
  h.link('Call Us', 'tel:+13466512173');
  assert.equal(h.root.cashasisDni.phone(), '(346) 651-2173');
  h.links.length = 0; h.link('invalid <script>', 'tel:000');
  assert.equal(h.root.cashasisDni.phone(), main);
});

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? htmlFiles(file) : file.endsWith('.html') ? [file] : [];
  });
}

test('every generated main-number page gets exactly one loader and unchanged valid tel targets', () => {
  let instrumented = 0;
  for (const file of htmlFiles('dist')) {
    const html = fs.readFileSync(file, 'utf8');
    const count = (html.match(/src="\/js\/cashasis-dni\.js"/g) || []).length;
    const mainLinks = html.match(/<a\b[^>]*\bhref=(['"])tel:\+13465846365\1[^>]*>/gi) || [];
    const phonePage = mainLinks.length > 0;
    assert.equal(count, phonePage ? 1 : 0, file);
    if (phonePage) {
      instrumented++;
      assert(html.indexOf('src="/js/cashasis-dni.js"') < html.lastIndexOf('</body>'), file);
      for (const tag of mainLinks) {
        assert(tag.includes('data-cashasis-call'), file);
      }
    }
    assert.equal((html.match(/src="\/js\/cashasis-attribution\.js"/g) || []).length, 1, file);
  }
  assert(instrumented > 0);
});

test('all six generated error alerts use assigned visible number or safe main fallback', () => {
  for (const [file, count] of [['dist/index.html', 4], ['dist/fix-it-or-sell-it/index.html', 2]]) {
    const html = fs.readFileSync(file, 'utf8');
    const alerts = html.match(/alert\('We could not [^\n]*?\+'\.'\)/g) || [];
    assert.equal(alerts.length, count, file);
    for (const code of alerts) {
      const values = [];
      vm.runInNewContext(code, { alert: value => values.push(value), window: {} });
      assert(values.pop().includes(main));
      vm.runInNewContext(code, { alert: value => values.push(value), window: { cashasisDni: { phone: () => '(346) 594-0714' } } });
      assert(values.pop().includes('(346) 594-0714'));
    }
  }
});

test('postprocessor is idempotent for the full generated HTML corpus', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cashasis-dni-test-'));
  try {
    for (const file of htmlFiles('dist')) {
      fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
      fs.copyFileSync(file, path.join(temp, file));
    }
    const before = htmlFiles(path.join(temp, 'dist')).map(file => [file, fs.readFileSync(file, 'utf8')]);
    execFileSync(process.execPath, [path.resolve('scripts/inject-dni.mjs')], { cwd: temp });
    for (const [file, expected] of before) assert.equal(fs.readFileSync(file, 'utf8'), expected, file);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('existing form attribution source and postprocessor are unchanged', () => {
  for (const file of ['public/js/cashasis-attribution.js', 'scripts/inject-attribution.mjs']) {
    assert.equal(fs.readFileSync(file, 'utf8'), execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8' }));
  }
});
