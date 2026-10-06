(function (root) {
  'use strict';
  if (root.cashasisDni) return;

  var doc = root.document;
  var main = '(346) 584-6365';
  var sessionSrc = 'https://backend.leadconnectorhq.com/appengine/js/user_session.js';
  var poolSrc = 'https://backend.leadconnectorhq.com/appengine/loc/O3BfhO3fUHCu0LXCtV7e/pool/IfFLw9v6i7Hyetkmz4bS/number_pool.js';

  // Read the number the native pool actually displayed; never allocate one here.
  root.cashasisDni = {
    phone: function () {
      var links = doc.querySelectorAll('a[data-cashasis-call]');
      for (var i = 0; i < links.length; i++) {
        var values = [links[i].textContent || '', links[i].getAttribute('href') || ''];
        for (var j = 0; j < values.length; j++) {
          var digits = values[j].replace(/\D/g, '');
          if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.slice(1);
          if (/^\d{10}$/.test(digits)) {
            return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
          }
        }
      }
      return main;
    }
  };

  // Production artifacts are also served on preview/permalink hosts. Keep those
  // hosts inert, even when their build context was production.
  if (root.location.protocol !== 'https:' ||
      !/^(www\.)?cashasis\.com$/i.test(root.location.hostname)) return;

  function load(src, id, ready) {
    var existing = doc.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (ready) existing.addEventListener('load', ready, { once: true });
      return;
    }
    var script = doc.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    if (ready) script.addEventListener('load', ready, { once: true });
    // A blocked/failed native script leaves the original business number intact.
    doc.body.appendChild(script);
  }

  function loadPool() {
    if (!root.userSessionAttribution) return;
    load(poolSrc, 'cashasis-ghl-number-pool');
  }

  // Prepare the native attribution API before the pool's automatic initializer.
  // This avoids a race when scripts arrive after DOMContentLoaded. The vendor
  // alone decides visitor eligibility, assigns/recycles numbers, and swaps DOM.
  if (root.userSessionAttribution) loadPool();
  else load(sessionSrc, 'cashasis-ghl-user-session', loadPool);
})(window);
