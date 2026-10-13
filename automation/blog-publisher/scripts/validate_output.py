import sys,json,re
from pathlib import Path
from html.parser import HTMLParser
from PIL import Image
from urllib.parse import urlparse,parse_qs,unquote
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.images=[];self.canonical=[];self.ld=[];self.in_ld=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a':self.links.append(a.get('href',''))
  if tag=='img':self.images.append(a)
  if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
  if tag=='script' and a.get('type')=='application/ld+json':self.in_ld=True
 def handle_data(self,data):
  if self.in_ld:self.ld.append(json.loads(data))
 def handle_endtag(self,tag):
  if tag=='script':self.in_ld=False
r=Path(sys.argv[1]);slug=sys.argv[2]
if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug):raise SystemExit('Invalid slug')
d=r/'dist';p=d/'blog'/slug/'index.html';errors=[]
if not p.exists():raise SystemExit('Missing built article (drafts must not be released)')
t=p.read_text();page=Page();page.feed(t)
expected=f'https://www.cashasis.com/blog/{slug}/'
if page.canonical!=[expected]:errors.append('canonical')
if not any(x.get('@type')=='BlogPosting' for x in page.ld):errors.append('BlogPosting')
hero=[i for i in page.images if 'article-hero' in i.get('class','').split()]
for i in hero:
 imagepath=d/unquote(urlparse(i.get('src','')).path.lstrip('/'))
 if imagepath.exists() and Image.open(imagepath).size!=(1200,630):errors.append('thumbnail must be 1200x630')
for i in page.images:
 u=urlparse(i.get('src',''))
 if not i.get('alt') and not (i.get('width')=='1' and i.get('height')=='1'):errors.append('image alt')
 if not u.netloc and u.path.startswith('/') and not (d/unquote(u.path.lstrip('/'))).is_file():errors.append('missing image '+u.path)
for href in page.links:
 u=urlparse(href)
 if not u.netloc and u.path.startswith('/'):
  target=d/unquote(u.path.lstrip('/'))
  if not target.is_file() and not (target/'index.html').is_file():errors.append('broken link '+href)
ctas=[parse_qs(urlparse(h).query) for h in page.links if 'utm_campaign=blog_cta' in h]
if not any(c.get('utm_content')==[slug] and c.get('utm_source')==['blog'] and c.get('utm_medium')==['cta'] for c in ctas):errors.append('attributed CTA')
for needle in ['G-LW591K1QYF','external-tracking.js','cashasis-attribution.js','cashasis-dni.js']:
 if needle not in t:errors.append('tracking '+needle)
if f'/blog/{slug}/' not in (d/'blog/index.html').read_text():errors.append('index card')
if f'/blog/{slug}/' not in (d/'rss.xml').read_text():errors.append('RSS')
if not any(expected in s.read_text() for s in d.glob('sitemap*.xml')):errors.append('sitemap')
print(json.dumps({'slug':slug,'technicalResult':'fail' if errors else 'pass','errors':errors,'editorialVisualAndRuntimeReview':'required'},indent=2));sys.exit(bool(errors))
