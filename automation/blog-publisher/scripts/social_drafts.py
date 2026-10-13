"""Create stored social drafts from verified public article metadata; never publish."""
import json,sys,re
from pathlib import Path

def generate(a):
 slug=a['slug']
 if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',slug):raise ValueError('Invalid slug')
 url='https://www.cashasis.com/blog/'+slug+'/'
 title=a['title'];summary=a['description']
 hashtags=['#CashAsIs','#HoustonRealEstate','#SellAsIs']
 return {'slug':slug,'url':url,'image':'https://www.cashasis.com'+a['image'],'status':'draft_only','facebook':f'{title}\n\n{summary}\n\nCompare your options and request a no-obligation cash offer.\n{url}', 'instagram':f'{title}\n\n{summary}\n\nRead the guide: {url}\n\n'+ ' '.join(hashtags),'linkedin':f'{title}\n\n{summary}\n\nFor Houston-area property sellers, understanding the choices comes before choosing a buyer.\n{url}','googleBusinessProfile':f'{title}\n\n{summary}\nRead the guide and compare your selling options: {url}','promotionalExcerpt':summary,'hashtags':hashtags}
if __name__=='__main__':
 a=json.load(sys.stdin);out=generate(a)
 if len(sys.argv)>1:Path(sys.argv[1]).write_text(json.dumps(out,indent=2)+'\n')
 else:print(json.dumps(out,indent=2))
