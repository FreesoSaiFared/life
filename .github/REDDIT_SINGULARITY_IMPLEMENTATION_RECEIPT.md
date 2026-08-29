# r/singularity implementation receipt

Recorded: 2026-08-29 Europe/Amsterdam

## Accepted source state

- Repository: `FreesoSaiFared/life`
- Initial implementation PR: #1
- Squash merge: `c4ccecfebc1592d32a939f7d62c65e4c66de3d69`
- Complete-thread donor: `mikekonoval/reddit-thread@ddbc507b81284a5cb98e9555762435c6a5b05096`
- Current production Worker name: `transductive-r-singularity`
- Intended route: `transductive.org/r/singularity*`
- Cloudflare account: `d4204bfece1421ae859e5fba54c0a385`

## Ingestion acceptance

GitHub Actions run: `33243838337`

- donor selftest: PASS
- r/singularity feed entries: 25
- registry entries: 26
- source trees accepted complete: 19
- source trees explicitly partial: 6
- fetch failures: 0
- immutable source snapshots: implemented as `data/raw/<reddit_id>.<sha256>.thread.json`
- complete is asserted only when observed archive comments match Reddit's known comment count
- published summaries survive re-ingest; changed or partial evidence sets `summary_refresh_needed`

## Source/build acceptance

GitHub Actions run: `33243838371`

- Python compilation: PASS
- JavaScript syntax: PASS
- registry JSON validation: PASS
- Wrangler v4 dry-run: PASS

Subsequent Worker corrections:

- `0c970477d8b75e579053bb95d7a7aa5f7be266a5` — Worker-first Static Assets routing
- `be076957b66aca75f9d090cdc8433139bfee790c` — normalize production-prefixed and workers.dev root paths
- `591fb9698fbd3b095abb80026ca28468c0261bd7` — pin non-secret Cloudflare account ID
- `a9ba5a501c041e49a9dc9ff83662436ac36d9a78` — keep temporary acceptance account-neutral

## Contribution + moderation contract

Public dynamic boundary:

- `GET /r/singularity/api/health`
- `POST /r/singularity/api/contribute`

Accepted proposal path:

`missing/stale article -> ChatGPT Plus prompt -> proposal JSON -> POST -> GitHub moderation issue + durable submission -> moderator email -> approve/reject window -> 48h auto-publish unless rejected`

Moderation workflow:

- `transductive-review` — pending
- `transductive-approved` — publish next pass
- `transductive-rejected` — prevent publication
- no decision at deadline — publish with reason `48h-auto-publish`

## Live Cloudflare + real Chrome acceptance

Final credential-neutral acceptance run: `33244376439`

Temporary Worker URL at time of test:
`https://transductive-r-singularity-preview.balanced-cardigan.workers.dev`

Temporary previews expire; the URL is evidence, not a production endpoint.

Observed:

- `/`: HTTP 200
- `/r/singularity/`: HTTP 200
- `/api/health`: HTTP 200
- `/r/singularity/api/health`: HTTP 200
- health service: `transductive-r-singularity`
- temporary contribution/email secrets: correctly absent
- desktop viewport 1440x1100: 26 posts, article navigation PASS, contribution UI PASS, horizontal overflow 0, console/page errors 0
- mobile viewport 390x844: 26 posts, article navigation PASS, contribution UI PASS, horizontal overflow 0, console/page errors 0
- screenshots visually inspected: PASS

Evidence artifact:

- GitHub Actions artifact ID: `9712366331`
- artifact name: `reddit-singularity-browser-acceptance`
- ZIP size: 151396 bytes
- ZIP SHA-256: `6b9adf75ca00e4624eda47972c7efad0f83a2b3b8bd2ffcd8c0406758cb102a3`
- contains `browser-acceptance.json`, `desktop.png`, `mobile.png`

## Post-contribution hardening acceptance

Evidence-version and moderation hardening landed after the initial browser acceptance:

- `9091ac9e13a7b191af989d5f08344aa54fd1e3c9` — add evidence-version validation scaffolding and moderation-state selftest
- `d025f02f26f96f7f6e7fba16eafc28708ce89a01` — repair Worker validation syntax caught by temporary deployment
- `e39871a58596964b061216c937046efdaf045394` — add executable stale-evidence POST contract gate
- `d9c324a942d52525609e65a32fc06248062b39a8` — enforce the missing stale-evidence comparison in the Worker

Moderation proof: GitHub Actions run `33247362609`

- moderation labels ensured: PASS
- four-case state-machine selftest: PASS
- rejection wins over approval/deadline
- approval publishes before deadline
- unlabeled expired proposal auto-publishes
- unlabeled unexpired proposal remains pending
- live empty-queue pass: `{"changed": false, "results": []}`
- publication additionally blocks a proposal if source evidence changed after submission

Final contribution/browser proof: GitHub Actions run `33247545898`

- stale `source_bytes_observed`: HTTP 409 before GitHub mutation
- malformed/missing `source_bytes_observed`: HTTP 400
- temporary Worker deploy: PASS
- `/`: HTTP 200
- `/r/singularity/`: HTTP 200
- `/api/health`: HTTP 200
- `/r/singularity/api/health`: HTTP 200
- desktop 1440x1100: 26 posts, article navigation PASS, contribution UI PASS, horizontal overflow 0, browser errors 0
- mobile 390x844: 26 posts, article navigation PASS, contribution UI PASS, horizontal overflow 0, browser errors 0
- preview correctly reports production contribution/email secrets absent

Final evidence artifact:

- artifact ID: `9713328082`
- name: `reddit-singularity-browser-acceptance`
- size: 151391 bytes
- SHA-256: `f5ef40b2615965fcb54cd7e8e6c8bc803cc200247b7fb969b47f713bbb8d6fea`
- head SHA: `d9c324a942d52525609e65a32fc06248062b39a8`

Latest permanent-deployment preflight: run `33247545906`

- preflight itself: PASS
- permanent deployment: intentionally skipped
- status remains `PRODUCTION_DEPLOY_PENDING_AUTH`
- missing authorities remain `CLOUDFLARE_API_TOKEN`, `SINGULARITY_GITHUB_TOKEN`, `RESEND_API_KEY`, and `MODERATOR_EMAIL`

## Production boundary

Production is NOT claimed deployed.

Permanent GitHub Actions deployment is gated and currently reports:

`PRODUCTION_DEPLOY_PENDING_AUTH`

Missing repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `SINGULARITY_GITHUB_TOKEN`
- `RESEND_API_KEY`
- `MODERATOR_EMAIL`

The user's previously authenticated Windows Wrangler OAuth lane is the preferred production actuator, but the registered Windows device was offline on two retries in this session.

Historical/current recovered Wrangler facts:

- OAuth account ID: `d4204bfece1421ae859e5fba54c0a385`
- Wrangler config previously observed at `C:\Users\Admin\AppData\Roaming\xdg.config\.wrangler\config\default.toml`
- narrow route is deliberately more specific than existing transductive.org root ownership

## Exact continuation frontier

When the authenticated Windows host becomes callable:

1. Check `wrangler whoami`; require account `d4204bfece1421ae859e5fba54c0a385`.
2. Materialize current `FreesoSaiFared/life@master` on the host without modifying existing `E:\transductive.org`.
3. Ensure protected environment values exist for `SINGULARITY_GITHUB_TOKEN`, `RESEND_API_KEY`, and `MODERATOR_EMAIL`; do not print them.
4. Run `.github/scripts/deploy-reddit-singularity-authenticated.ps1`.
5. Verify public `https://transductive.org/r/singularity/api/health` reports both contribution and email configured.
6. Run real Chrome desktop + 390px acceptance against `https://transductive.org/r/singularity/`.
7. Submit one controlled proposal, verify moderation issue + email, mark it rejected, and prove the hourly moderation pass does not publish it.
8. Submit a second controlled proposal, approve it, prove publication and direct Reddit citation rendering.
9. Record Worker version, route, public hashes/screenshots and rollback target.

Nothing before Step 1 needs architectural redesign.
