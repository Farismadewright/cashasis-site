import sys,json,re,hashlib
from pathlib import Path
r=Path(sys.argv[1]);out=[]
for base,glob in [('src/content/blog','*.md'),('src/pages','**/*.astro')]:
 for p in sorted((r/base).glob(glob)):
  t=p.read_text();title=re.search(r'^title:\s*(.+)$',t,re.M)
  body=re.sub(r'\s+',' ',t.lower()).strip()
  out.append({'path':str(p.relative_to(r)),'slug':p.stem,'title':title.group(1).strip('"\'') if title else None,'sha256':hashlib.sha256(t.encode()).hexdigest(),'normalizedSha256':hashlib.sha256(body.encode()).hexdigest(),'words':len(body.split())})
print(json.dumps(out,indent=2))
