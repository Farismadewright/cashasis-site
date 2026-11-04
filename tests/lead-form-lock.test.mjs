import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

function matchOne(el, sel) {
  if (sel.startsWith('[')) {
    const attr = sel.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
    if (!attr) return false;
    return attr[2] === undefined ? el.hasAttribute(attr[1]) : el.getAttribute(attr[1]) === attr[2];
  }
  const parts = sel.match(/^(?:([a-zA-Z0-9]+))?(?:\.([a-zA-Z0-9_-]+))?(?:\[([^\]=]+)(?:="([^"]*)")?\])?$/);
  if (!parts || (!parts[1] && !parts[2] && !parts[3])) return false;
  if (parts[1] && el.tagName !== parts[1].toUpperCase()) return false;
  if (parts[2] && !(el.attrs.class || '').split(/\s+/).includes(parts[2])) return false;
  if (parts[3]) {
    if (parts[4] === undefined) { if (!el.hasAttribute(parts[3])) return false; }
    else if (el.getAttribute(parts[3]) !== parts[4]) return false;
  }
  return true;
}

function descendants(el) {
  const out = [];
  (function walk(node) {
    for (const child of node.children) { out.push(child); walk(child); }
  })(el);
  return out;
}

function queryAll(root, selector) {
  const parts = selector.trim().split(/\s+/);
  let matched = descendants(root).filter(el => matchOne(el, parts[0]));
  for (const part of parts.slice(1)) {
    matched = matched.flatMap(el => descendants(el).filter(child => matchOne(child, part)));
  }
  return matched;
}

class Node {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = {...attrs};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.value = attrs.value || '';
    this.checked = false;
    this.disabled = false;
    this.style = {};
    this.textContent = '';
    this.classList = {
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false),
      toggle: (name, force) => {
        const names = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
        const next = force === undefined ? !names.has(name) : !!force;
        if (next) names.add(name); else names.delete(name);
        this.attrs.class = [...names].join(' ');
        return next;
      },
      contains: name => (this.attrs.class || '').split(/\s+/).includes(name),
    };
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? String(this.attrs[name]) : null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } return this; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  querySelectorAll(selector) { return queryAll(this, selector); }
  querySelector(selector) { return queryAll(this, selector)[0] || null; }
  closest(selector) { let node = this; while (node) { if (matchOne(node, selector)) return node; node = node.parentNode; } return null; }
  checkValidity() {
    if (!this.hasAttribute('required')) return true;
    if (this.attrs.type === 'checkbox') return this.checked;
    return String(this.value || '').trim().length > 0;
  }
  reportValidity() {}
  scrollIntoView() {}
  dispatch(type) {
    const event = {type, target: this, preventDefault() { this.defaultPrevented = true; }, defaultPrevented: false};
    for (const fn of this.listeners[type] || []) fn(event);
    return event;
  }
  click() {
    if (this.disabled) return;
    this.dispatch('click');
    if (this.attrs.type === 'submit' && !this.disabled) this.closest('form')?.dispatch('submit');
  }
}

function field(name, required = true) {
  const input = new Node('input', {type: 'text', name, ...(required ? {required: ''} : {})});
  return input;
}

function mount() {
  const ids = {};
  const track = node => { if (node.attrs.id) ids[node.attrs.id] = node; return node; };
  const root = new Node('body');
  const button = track(new Node('button', {type: 'submit', class: 'btn btn-orange btn-block'}));
  button.textContent = 'Get my cash offer';
  const heroForm = track(new Node('form', {id: 'leadForm'}));
  const heroPanes = ['1', '2', '3', '4'].map(n => new Node('div', {class: n === '1' ? 'cao-pane active' : 'cao-pane', 'data-pane': n}));
  heroForm.append(field('address'), field('name'), field('phone'), field('email'), new Node('input', {type: 'checkbox', name: 'consent', required: ''}), button, field('condition', false), field('timeline', false));
  heroPanes[0].append(heroForm);
  const card = track(new Node('div', {id: 'caoCard'})).append(...heroPanes);
  const next = new Node('button', {type: 'submit', class: 'cao-next'});
  const modalForm = track(new Node('form', {id: 'caoModalForm'}));
  modalForm.append(field('name'), field('phone'), field('email'), field('address'), new Node('input', {type: 'checkbox', name: 'consent', required: ''}), next, field('condition', false), field('timeline', false));
  const modalPanes = ['1', '2', '3', '4'].map(n => new Node('div', {class: n === '1' ? 'cao-pane active' : 'cao-pane', 'data-mpane': n}));
  modalPanes[0].append(modalForm);
  const bar = new Node('span');
  const modal = track(new Node('div', {id: 'caoModal'})).append(
    new Node('button', {class: 'cao-close', type: 'button'}),
    new Node('h3', {class: 'cao-title'}),
    new Node('p', {class: 'cao-step'}),
    new Node('div', {class: 'cao-bar'}).append(bar),
    ...modalPanes,
    new Node('button', {class: 'cao-back', type: 'button'}),
  );
  root.append(card, modal, track(new Node('div', {id: 'caoProg'})), track(new Node('div', {id: 'caoBar'})));
  const calls = [];
  const pending = [];
  const alerts = [];
  const pixels = [];
  const context = {
    document: {
      cookie: '',
      getElementById: id => ids[id] || null,
      querySelectorAll: selector => queryAll(root, selector),
      querySelector: selector => queryAll(root, selector)[0] || null,
    },
    location: {href: 'https://www.cashasis.com/'},
    fetch: (url, init) => {
      calls.push({url, body: JSON.parse(init.body)});
      return new Promise(resolve => pending.push(resolve));
    },
    alert: message => alerts.push(message),
    fbq: (...args) => pixels.push(args),
    gtag: () => {},
  };
  vm.createContext(context);
  for (const marker of ["post({page:'step1-contact'", "post({page:'modal-step1-contact'"]) {
    const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).find(source => source.includes(marker));
    vm.runInContext(script, context, {filename: marker});
  }
  return {heroForm, button, modalForm, next, heroPanes, modalPanes, calls, pending, alerts, pixels};
}

function fill(form) {
  for (const name of ['name', 'phone', 'email', 'address']) form.querySelector(`[name="${name}"]`).value = name === 'address' ? '100 Main St' : 'Ada Seller';
  form.querySelector('[name="phone"]').value = '7135550101';
  form.querySelector('[name="email"]').value = 'ada@example.com';
  form.querySelector('[name="consent"]').checked = true;
}

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve));
}

function answer(pending, body, ok = true) {
  pending.shift()(new Response(JSON.stringify(body), {status: ok ? 200 : 502, headers: {'content-type': 'application/json'}}));
}

test('double click on the homepage offer button sends one step-1 request', async () => {
  const ui = mount();
  fill(ui.heroForm);
  ui.button.click();
  ui.button.click();
  ui.heroForm.dispatch('submit');
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].url, '/.netlify/functions/lead-submit');
  assert.equal(ui.calls[0].body.page, 'step1-contact');
  assert.equal(ui.calls[0].body.stage, 'contact');
  assert.equal(ui.button.disabled, true);
  answer(ui.pending, {ok: false, error: 'upstream_unavailable'}, false);
  await flush();
  assert.equal(ui.alerts.length, 1);
  assert.equal(ui.button.disabled, false);
  ui.button.click();
  assert.equal(ui.calls.length, 2);
});

test('double click on the popup Next button sends one step-1 request', async () => {
  const ui = mount();
  fill(ui.modalForm);
  ui.next.click();
  ui.next.click();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].body.page, 'modal-step1-contact');
  assert.equal(ui.next.disabled, true);
  answer(ui.pending, {ok: true, forwarded: true});
  await flush();
  assert.equal(ui.alerts.length, 0);
  assert.equal(ui.modalPanes[1].classList.contains('active'), true);
  assert.equal(ui.pixels.length, 1);
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.next.disabled, false);
});

test('a deduped success advances the form once and does not alert or track twice', async () => {
  const ui = mount();
  fill(ui.heroForm);
  ui.button.click();
  ui.button.click();
  answer(ui.pending, {ok: true, forwarded: false, deduped: true});
  await flush();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.alerts.length, 0);
  assert.equal(ui.pixels.length, 0);
  assert.equal(ui.heroPanes[1].classList.contains('active'), true);
});

test('invalid homepage submit does not lock the button or call the server', async () => {
  const ui = mount();
  ui.button.click();
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.heroForm.getAttribute('data-submitting'), null);
});
