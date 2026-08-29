# transductive.org/r/singularity

A mostly-static Reddit reader with a transductive editorial overlay and volunteer ChatGPT Plus article production.

## Proven ingestion
Daily discovery uses Reddit RSS. Each discovered thread is passed to the pinned upstream donor `mikekonoval/reddit-thread@ddbc507b81284a5cb98e9555762435c6a5b05096` instead of a locally reimplemented scraper. The donor obtains the complete comment tree from Arctic Shift, reports completeness/more-stub state, and switches to Reddit OAuth for fresh threads when REDDIT_* credentials exist.

Evidence is stored as `data/raw/<reddit_id>.thread.json`. Each post tracks current/previous byte size, SHA-256 history, source origin, completeness, comment count and max depth. Source changes never overwrite a published summary; they set `summary_refresh_needed`.

## Contribution flow
1. Missing/stale article exposes an exact ChatGPT prompt plus the complete-thread evidence URL.
2. Contributor returns one proposal JSON object and pastes it into the article page.
3. `POST /r/singularity/api/contribute` validates the proposal against the article registry.
4. The Worker opens a GitHub moderation issue, stores the proposal under `data/submissions/`, and emails the moderator through Resend.
5. Add `transductive-approved` to publish on the next hourly pass, or `transductive-rejected` to block it.
6. With neither label, the hourly moderation workflow auto-publishes after 48 hours.

The published article remains half-static: moderation writes the accepted summary back into `data/posts.json`.

## Contribution proposal
```json
{
  "reddit_id": "1abc...",
  "title": "...",
  "dek": "...",
  "summary_markdown": "...",
  "cited_comments": [{"author":"...","score":10,"permalink":"https://www.reddit.com/...","claim":"..."}],
  "source_bytes_observed": 12345,
  "generated_at": "..."
}
```

## Cloudflare boundary
`worker/wrangler.jsonc` owns only `transductive.org/r/singularity*`, preserving the rest of transductive.org. Static assets are served through the Worker asset binding; dynamic routes are:
- `GET /r/singularity/api/health`
- `POST /r/singularity/api/contribute`

Production deploy requires GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SINGULARITY_GITHUB_TOKEN` — fine-grained token with Contents + Issues write on FreesoSaiFared/life
- `RESEND_API_KEY`
- `MODERATOR_EMAIL`
Optional Reddit freshness secrets: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD`.

## Acceptance
Ingest CI must prove the donor selftest and at least one complete-thread evidence record. Deploy CI then requires public `/api/health` to report both contribution and email configured. Browser acceptance follows on the public reader after deployment.
