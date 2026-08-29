#!/usr/bin/env python3
import json, os, sys, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
POSTS=ROOT/"data"/"posts.json"
SUB=ROOT/"data"/"submissions"
SUB.mkdir(parents=True,exist_ok=True)
REPO=os.environ.get("GITHUB_REPOSITORY","FreesoSaiFared/life")
TOKEN=os.environ.get("GITHUB_TOKEN","")

def ts(v):
    return datetime.fromisoformat(v.replace("Z","+00:00"))

def moderation_decision(labels, auto_publish_at, now):
    labels=set(labels)
    if "transductive-rejected" in labels:
        return "rejected"
    if "transductive-approved" in labels:
        return "approved"
    if now >= ts(auto_publish_at):
        return "auto"
    return None

def selftest():
    now=datetime(2026,8,29,10,0,0,tzinfo=timezone.utc)
    past=(now-timedelta(minutes=1)).isoformat()
    future=(now+timedelta(hours=1)).isoformat()
    assert moderation_decision({"transductive-rejected","transductive-approved"},past,now)=="rejected"
    assert moderation_decision({"transductive-approved"},future,now)=="approved"
    assert moderation_decision(set(),past,now)=="auto"
    assert moderation_decision(set(),future,now) is None
    print(json.dumps({"selftest":"ok","cases":4}))
    return 0

def issue(n):
    req=urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/issues/{n}",
        headers={"Accept":"application/vnd.github+json","Authorization":f"Bearer {TOKEN}","User-Agent":"transductive-moderator/0.3"},
    )
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.load(r)

def write(p,o):
    p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

def main():
    posts=json.loads(POSTS.read_text(encoding="utf-8"))
    byid={p["reddit_id"]:p for p in posts}
    now=datetime.now(timezone.utc)
    changed=False
    results=[]

    for path in sorted(SUB.glob("*.json")):
        s=json.loads(path.read_text(encoding="utf-8"))
        if s.get("status")!="pending":
            continue
        try:
            labels={x["name"] for x in issue(s["issue_number"]).get("labels",[])}
        except Exception as e:
            results.append({"id":s.get("submission_id"),"state":"issue-read-failed","error":str(e)[:200]})
            continue

        decision=moderation_decision(labels,s["auto_publish_at"],now)
        if decision=="rejected":
            s.update(status="rejected",moderated_at=now.isoformat(),moderation_reason="transductive-rejected label")
            write(path,s)
            changed=True
            results.append({"id":s["submission_id"],"state":"rejected"})
            continue
        if decision is None:
            continue

        p=s["proposal"]
        post=byid.get(p["reddit_id"])
        if not post:
            s.update(status="blocked",moderation_reason="article disappeared from registry")
            write(path,s)
            changed=True
            continue

        if int(p.get("source_bytes_observed") or 0) != int(post.get("source_bytes") or 0):
            s.update(status="blocked",moderation_reason="source evidence changed after submission")
            write(path,s)
            changed=True
            results.append({"id":s["submission_id"],"state":"blocked","reason":"stale-evidence"})
            continue

        post.update(
            dek=p.get("dek"),
            summary=p["summary_markdown"],
            summary_status="published",
            summary_refresh_needed=False,
            summary_source_bytes=int(p.get("source_bytes_observed") or 0),
            summary_published_at=now.isoformat(),
            summary_submission_id=s["submission_id"],
            cited_comments=p.get("cited_comments") or [],
            direct_comment_links=[c.get("permalink") for c in (p.get("cited_comments") or []) if c.get("permalink")],
        )
        post["summary_version"]=int(post.get("summary_version") or 0)+1
        reason="moderator-approved" if decision=="approved" else "48h-auto-publish"
        s.update(status="published",published_at=now.isoformat(),publication_reason=reason)
        write(path,s)
        changed=True
        results.append({"id":s["submission_id"],"state":"published","reason":reason})

    if changed:
        write(POSTS,posts)
    print(json.dumps({"changed":changed,"results":results}))
    return 0

if __name__=="__main__":
    if "--selftest" in sys.argv:
        raise SystemExit(selftest())
    raise SystemExit(main())
