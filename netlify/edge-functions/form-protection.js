const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';
const PROTECTED_ENDPOINT = '/.netlify/functions/lead-submit';

// Production form protection. The protected endpoint has been verified end-to-end
// against the live GHL workflow before enabling this rewrite.
const protectionScript = `
<script>
(function(){
  var startedAt = Date.now();
  function addHoneypot(form){
    if(!form || form.querySelector('input[name="_website"]')) return;
    var hp=document.createElement('input');
    hp.type='text'; hp.name='_website'; hp.tabIndex=-1; hp.autocomplete='off';
    hp.setAttribute('aria-hidden','true');
    hp.style.position='absolute'; hp.style.left='-10000px'; hp.style.width='1px'; hp.style.height='1px'; hp.style.opacity='0';
    form.appendChild(hp);
  }
  document.addEventListener('DOMContentLoaded',function(){
    addHoneypot(document.getElementById('leadForm'));
    addHoneypot(document.getElementById('caoModalForm'));
  });
  var nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      var url=typeof input==='string'?input:(input&&input.url)||'';
      if((url==='${PROTECTED_ENDPOINT}' || url==='${GHL_WEBHOOK}') && init && init.body){
        var d=JSON.parse(init.body);
        var form=(d.page||'').indexOf('modal-')===0?document.getElementById('caoModalForm'):document.getElementById('leadForm');
        var hp=form&&form.querySelector('input[name="_website"]');
        d._website=hp?hp.value:'';
        d._started_at=startedAt;
        init=Object.assign({},init,{body:JSON.stringify(d)});
        input='${PROTECTED_ENDPOINT}';
      }
    }catch(e){}
    var result=nativeFetch(input,init);
    try{
      var trackedUrl=typeof input==='string'?input:(input&&input.url)||'';
      if(trackedUrl==='${PROTECTED_ENDPOINT}' && init && init.body){
        var payload=JSON.parse(init.body);
        result.then(function(resp){
          if(!resp || !resp.ok) return;
          resp.clone().json().then(function(data){
            if(!data || !data.forwarded) return;
            var stage=String(payload.stage||'');
            var page=String(payload.page||'');
            if(stage==='qualified' || page.indexOf('step3-complete')>=0){
              var params={content_name:'Seller Lead',content_category:'seller_lead',form_location:page||'unknown'};
              if(typeof window.fbq==='function') window.fbq('track','Lead',params);
              if(typeof window.gtag==='function') window.gtag('event','generate_lead',{lead_source:payload.lead_source||payload.source||'cashasis',form_location:page||'unknown'});
              window.dispatchEvent(new CustomEvent('cashasis:lead',{detail:{stage:stage,page:page}}));
            } else if(stage==='contact'){
              if(typeof window.fbq==='function') window.fbq('trackCustom','FormStart',{form_location:page||'unknown'});
              if(typeof window.gtag==='function') window.gtag('event','form_start',{form_location:page||'unknown'});
            }
          }).catch(function(){});
        }).catch(function(){});
      }
    }catch(e){}
    return result;
  };
})();
</script>`;

export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  html = html.split(GHL_WEBHOOK).join(PROTECTED_ENDPOINT);
  html = html.replace('</head>', protectionScript + '\n</head>');

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
};
