/* Homepage offer flow. Both entry points share request and conversion guards. */
(function (root) {
  'use strict';
  if (root.cashasisOfferInitialized) return;
  root.cashasisOfferInitialized = true;
  var flows = new Map();
  var startedAt = Date.now();
  var TTL = 24 * 60 * 60 * 1000;

  function read(key) {
    try { return JSON.parse(root.sessionStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function save(flow) {
    if (!flow.storageKey) return;
    try { root.sessionStorage.setItem(flow.storageKey, JSON.stringify({ id: flow.id, at: flow.at, tracked: flow.tracked })); } catch (_) {}
  }
  function uuid() {
    if (root.crypto.randomUUID) return root.crypto.randomUUID();
    var bytes = root.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes, function (v, i) { return ([4, 6, 8, 10].includes(i) ? '-' : '') + v.toString(16).padStart(2, '0'); }).join('');
  }
  function normalized(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function normalizedPhone(value) { return String(value || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); }
  function identity(data) {
    return [normalized(data.email), normalizedPhone(data.phone), normalized(data.address1)].join('\n');
  }
  function getFlow(data) {
    var key = identity(data);
    if (!flows.has(key)) {
      // Store only a hash and opaque token, never the seller's entered details.
      var pending = Promise.resolve().then(async function () {
        var storageKey = null;
        try {
          var bytes = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
          storageKey = 'cashasis.offer.v1.' + Array.from(new Uint8Array(bytes), function (v) { return v.toString(16).padStart(2, '0'); }).join('');
        } catch (_) {}
        var saved = storageKey && read(storageKey);
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.id) || Date.now() - saved.at >= TTL || saved.at > Date.now()) saved = null;
        var flow = { id: saved ? saved.id : uuid(), at: saved ? saved.at : Date.now(), tracked: saved ? saved.tracked || {} : {}, storageKey: storageKey, requests: {} };
        save(flow);
        return flow;
      });
      flows.set(key, pending);
    }
    return flows.get(key);
  }
  function phone() { return root.cashasisDni ? root.cashasisDni.phone() : '(346) 584-6365'; }
  function message(error) {
    var code = error && error.message;
    if (code === 'identity_conflict') return 'Please check that the phone number and email belong to the same person, then try again. Your information is still here.';
    if (code === 'submission_review_required' || code === 'upstream_error') return 'We could not confirm whether this request was saved. To avoid sending it twice, please call ' + phone() + ' for help. Your information is still here.';
    if (/pending|in_progress|unconfirmed/.test(code || '')) return 'Your request may still be processing. Your information is saved here. Try again to check its status, or call ' + phone() + '.';
    if (/conflict|mismatch/.test(code || '')) return 'This request already has saved details. To avoid sending it twice, please call ' + phone() + ' for help.';
    if (code === 'filtered' || /invalid_|consent_required/.test(code || '')) return 'Please check your name, street address, phone, email and consent, then try again. Your information is still here.';
    return 'We could not confirm this step. Your information is still here. Please try again or call ' + phone() + '.';
  }
  function cookie(name) {
    var match = root.document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    try { return match ? decodeURIComponent(match[1]) : ''; } catch (_) { return ''; }
  }
  function paint() { return new Promise(function (resolve) { root.requestAnimationFrame(function () { root.setTimeout(resolve, 0); }); }); }
  function track(flow, stage, data, response) {
    if (response.is_test || flow.tracked[stage]) return;
    // Mark before dispatch: analytics exceptions must never invite another intake.
    flow.tracked[stage] = true;
    save(flow);
    try {
      if (typeof root.fbq === 'function') {
        if (stage === 'contact') root.fbq('trackCustom', 'FormStart', { form_location: data.page });
        else root.fbq('track', 'Lead', { content_name: 'Seller Lead', content_category: 'seller_lead', form_location: data.page }, { eventID: response.meta_event_id || data.meta_event_id });
      }
    } catch (_) {}
    try {
      if (typeof root.gtag === 'function') root.gtag('event', stage === 'contact' ? 'form_start' : 'generate_lead', stage === 'contact' ? { form_location: data.page } : { lead_source: data.lead_source, form_location: data.page });
    } catch (_) {}
  }
  function send(flow, stage, data) {
    // An in-page duplicate joins the same promise. A retry keeps the same ID.
    var signature = JSON.stringify([normalized(data.full_name), normalized(data.email), normalizedPhone(data.phone), normalized(data.address1), data.tcpa_consent, data.property_condition || '', data.selling_timeline || '']);
    if (flow.requests[stage]) {
      if (flow.requests[stage].signature !== signature) return Promise.reject(new Error('submission_conflict'));
      return flow.requests[stage].promise;
    }
    data.submission_id = flow.id;
    if (stage === 'qualified') {
      data.meta_event_id = 'lead_' + flow.id;
      data.event_source_url = root.location.href;
      var fbp = cookie('_fbp'), fbc = cookie('_fbc');
      if (fbp) data.fbp = fbp;
      if (fbc) data.fbc = fbc;
    }
    if (root.cashasisAttribution) root.cashasisAttribution.enrich(data);
    var endpoint = stage === 'contact' ? 'lead-submit' : 'lead-update';
    var flag = stage === 'contact' ? 'forwarded' : 'updated';
    var controller = new AbortController();
    var timer = root.setTimeout(function () { controller.abort(); }, 45000);
    var request = Promise.resolve().then(function () { return root.fetch('/.netlify/functions/' + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal
    }); }).then(async function (response) {
      var result;
      try { result = await response.json(); } catch (_) { throw new Error('invalid_response'); }
      if (!response.ok || result.ok !== true || result[flag] !== true || result.filtered) throw new Error(result.error || (result.filtered ? 'filtered' : 'submission_failed'));
      track(flow, stage, data, result);
      return result;
    }).catch(function (error) {
      delete flow.requests[stage];
      throw error;
    }).finally(function () { root.clearTimeout(timer); });
    flow.requests[stage] = { signature: signature, promise: request };
    return request;
  }
  function init(container, form, modal) {
    if (!container || !form) return;
    var paneAttribute = modal ? 'data-mpane' : 'data-pane';
    var panes = container.querySelectorAll('.cao-pane');
    var current = 1, busy = false, flow = null, contactData = null;
    var status = root.document.createElement('p');
    status.className = 'cao-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    (modal ? container.querySelector('.cao-body') : container).appendChild(status);
    // Keep the existing honeypot contract even without an HTML-rewrite edge function.
    if (!form.querySelector('[name="_website"]')) {
      var hp = root.document.createElement('input'); hp.type = 'text'; hp.name = '_website'; hp.tabIndex = -1; hp.autocomplete = 'off'; hp.className = 'cao-honeypot'; hp.setAttribute('aria-hidden', 'true'); form.appendChild(hp);
    }
    function value(name) { var el = form.querySelector('[name="' + name + '"]'); return el ? el.value.trim() : ''; }
    function pane(number) {
      current = number;
      panes.forEach(function (p) { p.classList.toggle('active', p.getAttribute(paneAttribute) === String(number)); });
      if (modal) {
        var meta = { 1: ['Get Your Free Cash Offer', 'Step 1 of 3 · Takes 30 seconds', '33%'], 2: ['One Quick Question…', 'Step 2 of 3 · Almost done', '66%'], 3: ['One Quick Question…', 'Step 3 of 3 · Last one', '100%'], 4: ["You're All Set!", 'Offer incoming within 24 hours', '100%'] }[number];
        container.querySelector('.cao-title').textContent = meta[0]; container.querySelector('.cao-step').textContent = meta[1]; container.querySelector('.cao-bar span').style.width = meta[2];
      } else {
        root.document.getElementById('caoBar').style.width = { 1: '0%', 2: '33%', 3: '66%', 4: '100%' }[number];
        root.document.getElementById('caoProg').style.visibility = number === 1 ? 'hidden' : 'visible';
        try { container.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }
      var heading = container.querySelector('.cao-pane.active h4, .cao-pane.active h2');
      if (heading && (!modal || container.classList.contains('open'))) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    async function action(button, label, work) {
      if (busy) return;
      busy = true; // Synchronous guard, before validation, token lookup or fetch.
      var controls = Array.from(container.querySelectorAll('button:not(.cao-close), input:not([type="hidden"])'));
      var prior = controls.map(function (control) { var disabled = control.disabled; control.disabled = true; return disabled; });
      var original = button.innerHTML;
      button.textContent = label; button.classList.add('cao-loading'); button.setAttribute('aria-busy', 'true');
      container.setAttribute('aria-busy', 'true'); status.classList.remove('cao-status-error'); status.textContent = label;
      try { await paint(); await work(); status.textContent = ''; }
      catch (error) { status.classList.add('cao-status-error'); status.textContent = message(error); }
      finally {
        controls.forEach(function (control, i) { control.disabled = prior[i]; });
        button.innerHTML = original; button.classList.remove('cao-loading'); button.removeAttribute('aria-busy'); container.removeAttribute('aria-busy'); busy = false;
      }
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (busy || current !== 1) return;
      var inputs = form.querySelectorAll('input[required]');
      for (var i = 0; i < inputs.length; i++) if (!inputs[i].checkValidity()) { inputs[i].reportValidity(); return; }
      var data = { full_name: value('name'), phone: value('phone'), email: value('email'), address1: value('address'), tcpa_consent: form.querySelector('[name="consent"]').checked, source: 'cashasis-hero', lead_source: 'cashasis-hero', submitted_at: new Date().toISOString(), _website: value('_website'), _started_at: startedAt, page: modal ? 'modal-step1-contact' : 'step1-contact', stage: 'contact' };
      action(event.submitter || form.querySelector('[type="submit"]'), 'Sending…', async function () {
        flow = await getFlow(data); await send(flow, 'contact', data); contactData = data; pane(2);
      });
    });
    container.querySelectorAll('.cao-opt').forEach(function (button) {
      button.addEventListener('click', function () {
        var field = button.getAttribute('data-field');
        if (busy || (field === 'condition' ? current !== 2 : current !== 3)) return;
        form.querySelector('[name="' + field + '"]').value = button.getAttribute('data-val');
        action(button, field === 'condition' ? 'Continuing…' : 'Finishing…', async function () {
          if (field === 'condition') { pane(3); return; }
          var data = Object.assign({}, contactData, { property_condition: value('condition'), selling_timeline: value('timeline'), page: modal ? 'modal-step3-complete' : 'step3-complete', stage: 'qualified', submitted_at: new Date().toISOString() });
          await send(flow, 'qualified', data); pane(4);
        });
      });
    });
    var back = container.querySelector('.cao-back');
    if (back) back.addEventListener('click', function () { if (!busy && current === 3) { status.textContent = ''; pane(2); } });
    if (modal) {
      function close() { container.classList.remove('open'); container.setAttribute('aria-hidden', 'true'); root.document.body.style.overflow = ''; }
      root.document.querySelectorAll('[data-cao-open]').forEach(function (button) { button.addEventListener('click', function (event) { event.preventDefault(); container.classList.add('open'); container.setAttribute('aria-hidden', 'false'); root.document.body.style.overflow = 'hidden'; }); });
      container.querySelector('.cao-close').addEventListener('click', close);
      container.addEventListener('click', function (event) { if (event.target === container) close(); });
      root.document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && container.classList.contains('open')) close(); });
    }
  }
  init(root.document.getElementById('caoCard'), root.document.getElementById('leadForm'), false);
  init(root.document.getElementById('caoModal'), root.document.getElementById('caoModalForm'), true);
})(window);
