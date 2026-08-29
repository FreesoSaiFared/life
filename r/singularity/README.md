# transductive.org/r/singularity

A Reddit reader with a transductive editorial overlay.

## Vertical slice

1. `data/posts.json` is the half-static article registry.
2. `index.html` + `app.js` render a stripped Reddit-like list/article reader.
3. Every post tracks `source_bytes` and `previous_source_bytes`; a source refresh never overwrites the existing summary automatically.
4. If `summary_status` is `missing`, the article page exposes a ready-to-copy ChatGPT Plus prompt and `contributor.user.js`.
5. Contributor output is returned as a JSON article proposal. Intended server workflow: `submitted -> owner_notified -> vetted/published`, or `submitted -> auto_published` after 48h.

## Source quarry

The reader architecture deliberately reuses proven source patterns instead of cloning Reddit behavior from scratch:

- Redlib (`redlib-org/redlib`, AGPL-3.0): signed-out subreddit/post reader architecture, server-side Reddit normalization, lightweight HTML rendering.
- reddit-thread (`mikekonoval/reddit-thread`, MIT): complete thread ingestion via Arctic Shift with official Reddit OAuth fallback for fresh threads.
- Horizon (`Thysrael/Horizon`): subreddit discovery fallback sequence including Reddit RSS when JSON access is blocked.

Important 2026 correction: anonymous Reddit `URL+.json` is no longer dependable for unattended server ingestion. The public workflow may still instruct a logged-in browser user to open the `.json` form, but the daily collector must use RSS/authenticated API/archive fallbacks.

## Article state

```json
{
  "reddit_id": "...",
  "reddit_url": "...",
  "json_url": "...",
  "title": "...",
  "source_bytes": 0,
  "previous_source_bytes": 0,
  "source_changed": false,
  "summary_status": "missing|submitted|published",
  "summary": null,
  "summary_version": 0,
  "submitted_at": null,
  "auto_publish_at": null
}
```

The key invariant is that source growth changes the evidence record, not the published summary. A new summary is produced only through the summarization workflow.
