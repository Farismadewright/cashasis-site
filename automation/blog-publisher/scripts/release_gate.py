"""Fail-closed release checks. Native Work runner owns factual review and GitHub CAS lock."""
import json,sys,re,hashlib
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

def check(repo,state,batch,ledger,now=None):
 errors=[];repo=Path(repo);now=now or datetime.now(ZoneInfo('America/Chicago'));day=now.astimezone(ZoneInfo('America/Chicago')).date().isoformat()
 gates=['templateApproved','workflowPassed','mobilePassed','metadataPassed','sellerVoicePassed','budgetApproved','nativeUnattendedTestPassed']
 for gate in gates:
  if state.get(gate) is not True:errors.append('required gate: '+gate)
 if state.get('unattendedProduction') is not True or state.get('mode')!='production':errors.append('production OFF')
 if state.get('dailyCap')!=3:errors.append('daily cap must be 3')
 articles=batch.get('articles',[])
 if not 1<=len(articles)<=3:errors.append('batch must contain 1–3 articles')
 lease=state.get('lease',{})
 if lease.get('runId')!=batch.get('runId'):errors.append('lease run mismatch')
 if not isinstance(lease.get('fence'),int) or lease.get('fence')!=batch.get('fence'):errors.append('lease fence mismatch')
 try:
  expiry=datetime.fromisoformat(lease['expiresAt']).timestamp();issued=datetime.fromisoformat(lease['issuedAt']).timestamp()
  if expiry<=now.timestamp():errors.append('lease expired')
  if expiry-issued>7200 or issued>now.timestamp()+300:errors.append('lease exceeds allowed duration')
 except (KeyError,ValueError):errors.append('missing valid lease')
 # Reserved entries count too: failed/ambiguous releases must not grant a duplicate allowance.
 used=sum(x.get('day')==day and x.get('status') in ['reserved','preview','publishing','published','unknown'] for x in ledger)
 if used>3:errors.append('daily allowance exhausted')
 reservations=[x for x in ledger if x.get('runId')==batch.get('runId') and x.get('day')==day and x.get('status')=='reserved']
 for a in articles:
  matching=[x for x in reservations if x.get('slug')==a.get('slug') and x.get('intentKey')==a.get('intentKey')]
  if len(matching)!=1:errors.append('missing unique durable reservation')
 if state.get('apiMode')=='paid':
  costs=[a.get('costUSD') for a in articles]
  if any(not isinstance(c,(int,float)) or c<0 for c in costs):errors.append('unknown API cost')
  else:
   total=sum(costs)
   if state.get('dailyCostUSD',0)+total>state.get('dailySpendLimitUSD',0):errors.append('daily budget exceeded')
   if state.get('monthlyCostUSD',0)+total>state.get('monthlySpendLimitUSD',0):errors.append('monthly budget exceeded')
 else:
  if any(a.get('externalApiUsed') for a in articles):errors.append('unapproved external API use')
 seen=set();intents=set()
 for a in articles:
  slug=a.get('slug','');intent=a.get('intentKey','')
  if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug):errors.append('invalid slug')
  if not intent or intent in intents or any(x.get('intentKey')==intent and not (x.get('runId')==batch.get('runId') and x.get('status')=='reserved') for x in ledger):errors.append('duplicate or absent intent')
  if slug in seen or any(x.get('slug')==slug and not (x.get('runId')==batch.get('runId') and x.get('status')=='reserved') for x in ledger):errors.append('duplicate slug')
  seen.add(slug);intents.add(intent)
  if not 1<=len(a.get('title',''))<=70 or not 50<=len(a.get('description',''))<=160:errors.append('metadata length')
  if not a.get('primaryKeyword') or not a.get('supportingKeywords'):errors.append('keywords missing')
  for gate in ['privacy','originality','editorial','facts','sources','thumbnail','build','metadata','links','mobile','preview']:
   if a.get('checks',{}).get(gate)!='pass':errors.append(slug+': '+gate)
  if not a.get('sources') or any(not x.get('url','').startswith('https://') or not x.get('verifiedAt') or not x.get('claim') for x in a.get('sources',[])):errors.append('verified citations missing')
  if not a.get('nearestOverlaps') or not a.get('substantiveDifference'):errors.append('overlap review missing')
  for channel in ['facebook','instagram','linkedin','googleBusinessProfile','promotionalExcerpt']:
   if not a.get('social',{}).get(channel):errors.append('social draft missing: '+channel)
  if a.get('image')!='/images/'+slug+'.png':
   errors.append('image path must match slug');continue
  f=repo/'public/images'/(slug+'.png')
  if not f.is_file():errors.append('image missing')
  else:
   from PIL import Image
   if Image.open(f).size!=(1200,630):errors.append('image size')
   if hashlib.sha256(f.read_bytes()).hexdigest()!=a.get('imageSha256'):errors.append('image hash mismatch')
 requiredHashes={'scripts/render_thumbnail.mjs','assets/official-logo-white.png','assets/official-logo-navy.png','assets/headline-bold.ttf'}
 if set(state.get('templateHashes',{}))!=requiredHashes:errors.append('complete approved template hashes required')
 for path,expected in state.get('templateHashes',{}).items():
  f=repo/'automation/blog-publisher'/path
  if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=expected:errors.append('locked template mismatch '+path)
 return {'allowed':not errors,'day':day,'errors':errors}
if __name__=='__main__':
 repo,state,batch,ledger=sys.argv[1:];result=check(repo,json.load(open(state)),json.load(open(batch)),json.load(open(ledger)));print(json.dumps(result,indent=2));sys.exit(not result['allowed'])
