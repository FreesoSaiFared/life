#!/usr/bin/env python3
import hashlib, json, os, re, subprocess, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "posts.json"
RAW = ROOT / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)
UA = "transductive-reddit-reader/0.2 (+https://transductive.org/r/singularity/)"
FEED = "https://www.reddit.com/r/singularity/new/.rss"
FETCHER = Path(os.environ.get("REDDIT_THREAD_FETCHER", ROOT / ".quarry" / "reddit-thread" / "scripts" / "fetch_thread.py"))

def get(url, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()

def reddit_id(url):
    m = re.search(r"/comments/([a-z0-9]+)/", url, re.I)
    return m.group(1).lower() if m else hashlib.sha1(url.encode()).hexdigest()[:12]

def json_url(url):
    return url.split("?")[0].rstrip("/") + ".json"

def feed_entries(blob):
    root = ET.fromstring(blob)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in root.findall("a:entry", ns):
        title = e.findtext("a:title", default="", namespaces=ns)
        author = e.findtext("a:author/a:name", default="unknown", namespaces=ns)
        link = ""
        for node in e.findall("a:link", ns):
            if node.attrib.get("rel", "alternate") == "alternate":
                link = node.attrib.get("href", "")
        if link:
            out.append((title, author, link))
    return out

def load_registry():
    return json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else []

def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def fetch_thread(url, rid):
    if not FETCHER.exists():
        raise RuntimeError(f"quarried reddit-thread fetcher not found at {FETCHER}")
    dest = RAW / f"{rid}.thread.json"
    proc = subprocess.run(
        [sys.executable, str(FETCHER), url, "--flat", "--out", str(dest)],
        text=True, capture_output=True, timeout=120,
    )
    if proc.returncode:
        raise RuntimeError((proc.stderr or proc.stdout or f"fetcher exit {proc.returncode}").strip())
    payload = json.loads(dest.read_text(encoding="utf-8"))
    return dest, payload, (proc.stderr or "").strip()

def evidence_url(rid):
    return f"https://transductive.org/r/singularity/data/raw/{rid}.thread.json"

def main():
    old = load_registry()
    byid = {p["reddit_id"]: p for p in old}
    feed = get(FEED, "application/atom+xml,application/xml,text/xml,*/*")
    seen = []
    failures = []

    for title, feed_author, url in feed_entries(feed)[:50]:
        rid = reddit_id(url)
        seen.append(rid)
        prev = byid.get(rid, {})
        record = dict(prev)
        now = datetime.now(timezone.utc).isoformat()
        try:
            path, thread, receipt = fetch_thread(url, rid)
            post = thread.get("post") or {}
            summary = thread.get("summary") or {}
            size = path.stat().st_size
            digest = sha256(path)
            prior_size = int(prev.get("source_bytes") or 0)
            prior_digest = prev.get("source_sha256")
            changed = bool(prior_digest and prior_digest != digest)

            history = list(prev.get("source_history") or [])
            if not history or history[-1].get("sha256") != digest:
                history.append({"ingested_at": now, "bytes": size, "sha256": digest, "source": thread.get("source")})
                history = history[-30:]

            record.update({
                "reddit_id": rid,
                "reddit_url": url,
                "json_url": json_url(url),
                "evidence_url": evidence_url(rid),
                "title": post.get("title") or title,
                "author": post.get("author") or feed_author,
                "score": post.get("score") or 0,
                "comment_count": post.get("num_comments") if isinstance(post.get("num_comments"), int) else summary.get("comments", 0),
                "created_utc": post.get("created_utc") or 0,
                "source_kind": "complete-thread-json",
                "source_origin": thread.get("source"),
                "source_complete": bool(summary.get("complete")),
                "source_more_stubs": int(summary.get("more_stubs") or 0),
                "source_max_depth": int(summary.get("max_depth") or 0),
                "source_comment_count": int(summary.get("comments") or 0),
                "previous_source_bytes": prior_size,
                "source_bytes": size,
                "previous_source_sha256": prior_digest,
                "source_sha256": digest,
                "source_changed": changed,
                "source_history": history,
                "last_ingested_at": now,
                "last_ingest_error": None,
                "ingest_receipt": receipt[-1000:],
            })

            if record.get("summary") and changed:
                record["summary_refresh_needed"] = True
            else:
                record.setdefault("summary_refresh_needed", False)
        except Exception as exc:
            record.update({
                "reddit_id": rid,
                "reddit_url": url,
                "json_url": json_url(url),
                "title": title,
                "author": feed_author,
                "last_ingested_at": now,
                "last_ingest_error": str(exc)[:2000],
            })
            failures.append({"reddit_id": rid, "error": str(exc)[:300]})

        record.setdefault("score", 0)
        record.setdefault("comment_count", 0)
        record.setdefault("created_utc", 0)
        record.setdefault("source_bytes", 0)
        record.setdefault("previous_source_bytes", 0)
        record.setdefault("summary_status", "missing")
        record.setdefault("summary", None)
        record.setdefault("summary_version", 0)
        record.setdefault("summary_refresh_needed", False)
        record.setdefault("submitted_at", None)
        record.setdefault("auto_publish_at", None)
        record.setdefault("direct_comment_links", [])
        byid[rid] = record

    seen_set = set(seen)
    ordered = [byid[r] for r in seen] + [p for p in old if p["reddit_id"] not in seen_set]
    DATA.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "feed_entries": len(seen),
        "registry_entries": len(ordered),
        "complete_sources": sum(1 for p in ordered if p.get("source_complete")),
        "changed": sum(1 for p in ordered if p.get("source_changed")),
        "failures": failures,
    }))

if __name__ == "__main__":
    main()
