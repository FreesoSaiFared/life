#!/usr/bin/env python3
import hashlib,json,os,re,sys,time,urllib.request,xml.etree.ElementTree as ET
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'posts.json'
RAW=ROOT/'data'/'raw'
RAW.mkdir(parents=True,exist_ok=True)
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'
FEED='https://www.reddit.com/r/singularity/new/.rss'


def get(url,accept='*/*'):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept})
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read(),r.headers.get_content_type()


def reddit_id(url):
    m=re.search(r'/comments/([a-z0-9]+)/',url,re.I)
    return m.group(1) if m else hashlib.sha1(url.encode()).hexdigest()[:12]


def json_url(url):
    clean=url.split('?')[0].rstrip('/')
    return clean+'.json'


def feed_entries(blob):
    root=ET.fromstring(blob)
    ns={'a':'http://www.w3.org/2005/Atom'}
    out=[]
    for e in root.findall('a:entry',ns):
        title=e.findtext('a:title',default='',namespaces=ns)
        author=e.findtext('a:author/a:name',default='unknown',namespaces=ns)
        link=''
        for l in e.findall('a:link',ns):
            if l.attrib.get('rel','alternate')=='alternate': link=l.attrib.get('href','')
        if link: out.append((title,author,link))
    return out


def load_registry():
    if not DATA.exists(): return []
    return json.loads(DATA.read_text(encoding='utf-8'))


def main():
    old=load_registry(); byid={p['reddit_id']:p for p in old}
    feed,_=get(FEED,'application/atom+xml,application/xml,text/xml,*/*')
    seen=[]
    for title,author,url in feed_entries(feed)[:50]:
        rid=reddit_id(url); seen.append(rid); prev=byid.get(rid,{})
        source=b''; kind='json'; jurl=json_url(url)
        try:
            source,_=get(jurl,'application/json,text/plain,*/*')
        except Exception:
            kind='html'
            try: source,_=get(url,'text/html,application/xhtml+xml,*/*')
            except Exception: source=b''
        prior_bytes=int(prev.get('source_bytes') or 0)
        now_bytes=len(source)
        if source:
            (RAW/f'{rid}.{kind}').write_bytes(source)
        record=dict(prev)
        record.update({
            'reddit_id':rid,'reddit_url':url,'json_url':jurl,'title':title,'author':author,
            'source_kind':kind,'previous_source_bytes':prior_bytes,'source_bytes':now_bytes,
            'source_changed':bool(prior_bytes and prior_bytes!=now_bytes),'last_ingested_at':datetime.now(timezone.utc).isoformat()
        })
        record.setdefault('score',0);record.setdefault('comment_count',0)
        record.setdefault('created_utc',0);record.setdefault('summary_status','missing')
        record.setdefault('summary',None);record.setdefault('summary_version',0)
        record.setdefault('submitted_at',None);record.setdefault('auto_publish_at',None)
        record.setdefault('direct_comment_links',[])
        byid[rid]=record
        time.sleep(.5)
    ordered=[byid[r] for r in seen]+[p for p in old if p['reddit_id'] not in set(seen)]
    DATA.write_text(json.dumps(ordered,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'feed_entries':len(seen),'registry_entries':len(ordered),'changed':sum(1 for p in ordered if p.get('source_changed'))}))

if __name__=='__main__':
    main()
