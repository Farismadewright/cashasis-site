"""Aggregate public-safe article and metric records. Missing metrics remain unavailable."""
import json,sys
from pathlib import Path
records=[json.loads(p.read_text()) for p in Path(sys.argv[1]).glob('*.json')]
out={'published':sum(x.get('status')=='published' for x in records),'held':sum(x.get('status')=='hold' for x in records),'rejected':sum(x.get('status')=='rejected' for x in records),'sellerConcernTopics':sum(x.get('topicOrigin')=='seller_voice' for x in records),'metrics':{},'limitations':[]}
for k in ['impressions','clicks','organicSessions','uniqueSellerLeads','formSubmissions']:
 values=[x.get('metrics',{}).get(k) for x in records]
 complete=bool(values) and all(isinstance(v,(int,float)) for v in values)
 out['metrics'][k]=sum(values) if complete else None
 if not complete:out['limitations'].append(k+' unavailable or incomplete')
s=out['metrics']['organicSessions'];n=out['metrics']['uniqueSellerLeads'];out['leadConversionRate']=n/s if s and n is not None else None
out['note']='Only combine matching date windows and attribution scopes; event totals are not unique sellers.'
print(json.dumps(out,indent=2))
