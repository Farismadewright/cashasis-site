"""Read stdin only. Emit aggregate themes, never raw messages or identifiers."""
import sys,json,re
from collections import defaultdict
patterns={'price_and_offer':r'\b(price|offer|worth|asking|low|amount|cash)\b','condition_and_repairs':r'\b(repair|roof|foundation|condition|contractor|damage|hvac)\b','closing_timing':r'\b(close|closing|days|week|month)\b','taxes':r'\b(tax|taxes|delinquent|lien)\b','foreclosure':r'foreclos|auction','inheritance':r'inherit|probate|heir|deceas','tenants':r'tenant|renter|lease|rental|evict','vacancy':r'vacant|empty|abandon','fees':r'\b(fee|fees|commission)\b'}
def summarize(messages):
 groups=defaultdict(set);sample=set();inbound=0
 for i,m in enumerate(messages):
  if m.get('direction')!='inbound':continue
  body=m.get('body','') or ''
  if re.search(r'wrong number|do not contact|stop texting|unsubscribe|\bSTOP\b',body,re.I):continue
  inbound+=1;person=m.get('contactId') or ('unknown-'+str(i));sample.add(person)
  for theme,pattern in patterns.items():
   if re.search(pattern,body,re.I):groups[theme].add(person)
 return {'method':'keyword-screen; review context privately before topic selection','inboundMessages':inbound,'distinctConversationsInSample':len(sample),'themes':[{'theme':k,'sellerCount':len(v),'recurring':len(v)>=3} for k,v in sorted(groups.items()) if len(v)>=3],'privacy':'aggregate_only; no identities, quotes, exact property facts or raw text','coverage':'bounded sample; not company-wide prevalence'}
if __name__=='__main__':
 d=json.load(sys.stdin);print(json.dumps(summarize(d.get('messages',[])),indent=2))
