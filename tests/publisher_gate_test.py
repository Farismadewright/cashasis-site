import sys,unittest,json,tempfile,hashlib,copy
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'automation/blog-publisher/scripts'))
from release_gate import check
from seller_voice import summarize
from social_drafts import generate
class GateTests(unittest.TestCase):
 def test_missing_activation_is_denied(self):
  r=check('.',{}, {'runId':'x','articles':[]},[]);self.assertFalse(r['allowed']);self.assertIn('production OFF',r['errors'])
 def test_privacy_and_recurring_counts(self):
  msgs=[{'direction':'inbound','body':'What is the price?','contactId':str(i)} for i in range(3)]
  msgs+=[{'direction':'inbound','body':'STOP price','contactId':'stop'},{'direction':'outbound','body':'price','contactId':'out'}]
  out=summarize(msgs);self.assertEqual(out['themes'][0]['sellerCount'],3);self.assertNotIn('contactId',json.dumps(out));self.assertNotIn('What is',json.dumps(out))
 def test_social_has_canonical_and_no_publish(self):
  out=generate({'slug':'safe-topic','title':'Safe topic','description':'Public article description','image':'/images/safe-topic.png'});self.assertEqual(out['status'],'draft_only');self.assertTrue(out['url'].endswith('/blog/safe-topic/'))
 def test_duplicate_run_and_budget_fail_closed(self):
  state={'mode':'production','unattendedProduction':True,'dailyCap':3,'apiMode':'paid','dailySpendLimitUSD':1,'monthlySpendLimitUSD':1,'lease':{'runId':'x','expiresAt':(datetime.now(ZoneInfo('America/Chicago'))+timedelta(hours=1)).isoformat()}}
  r=check('.',state,{'runId':'x','articles':[{'costUSD':2}]},[{'runId':'x'}]);self.assertIn('missing unique durable reservation',r['errors']);self.assertIn('daily budget exceeded',r['errors'])
if __name__=='__main__':unittest.main()
