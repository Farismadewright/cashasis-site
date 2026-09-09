const GHL_WEBHOOK = 'https://services.leadconnectorhq.com/hooks/O3BfhO3fUHCu0LXCtV7e/webhook-trigger/570a225e-0922-4942-90c6-7e3bd28b086d';
const PROTECTED_ENDPOINT = '/.netlify/functions/lead-submit';

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
      if(url==='${PROTECTED_ENDPOINT}' && init && init.body){
        var d=JSON.parse(init.body);
        var visible=document.querySelector('input[name="_website"]');
        d._website=visible?visible.value:'';
        d._started_at=startedAt;
        init=Object.assign({},init,{body:JSON.stringify(d)});
      }
    }catch(e){}
    return nativeFetch(input,init);
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
