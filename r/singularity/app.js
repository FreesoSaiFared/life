const app=document.querySelector('#app');
const data=await fetch('./data/posts.json',{cache:'no-store'}).then(r=>r.json());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=id=>data.find(p=>p.reddit_id===id);
const delta=p=>(p.source_bytes||0)-(p.previous_source_bytes||0);
const summaryHtml=s=>'<p>'+esc(s).replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';

function promptFor(p){
  return `You are producing a proposed article for transductive.org/r/singularity.

SOURCE
Title: ${p.title}
Reddit URL: ${p.reddit_url}
Complete thread evidence: ${p.evidence_url||p.json_url}
Evidence source: ${p.source_origin||'unknown'}
Complete tree reported: ${Boolean(p.source_complete)}
Known source bytes: ${p.source_bytes||0}
Previous source bytes: ${p.previous_source_bytes||0}

TASK
1. Ingest the complete thread evidence URL first. It contains the post plus flattened comments with depth, parent_id, author, score and body. Use Reddit itself only to verify/direct-link citations.
2. Identify the strongest claims, disagreements, overlooked implications and surprising minority positions. Do not summarize every comment.
3. Write from the transductive perspective: ask how AI changes the space of possible institutions, identities, work, cognition and collective action, not merely how it improves an existing process.
4. Clearly distinguish the source post, what commenters add, and the transductive interpretation.
5. Cite important comments using direct https://www.reddit.com/ permalinks.
6. If source_complete is false, explicitly acknowledge incomplete evidence.
7. Return ONLY one JSON object with keys:
   reddit_id, title, dek, summary_markdown,
   cited_comments[{author,score,permalink,claim}],
   source_bytes_observed, generated_at.
8. source_bytes_observed MUST equal ${p.source_bytes||0}.
9. If this is a refresh, rewrite the synthesis as one current article; do not append a changelog.

REDDIT_ID
${p.reddit_id}`;
}
function contributionBox(p){
  const refresh=Boolean(p.summary&&p.summary_refresh_needed),prompt=promptFor(p);
  return `<section class="missing"><strong>${refresh?'Source grew — refresh this summary.':'No transductive summary yet.'}</strong>
  <p>Run the prompt in a ChatGPT Plus session. When it returns the final JSON object, paste it below. Submission emails the moderator immediately and auto-publishes after 48 hours unless rejected.</p>
  <div class="buttons"><button data-copy-prompt="${esc(p.reddit_id)}">Copy ChatGPT prompt</button><a class="button secondary" href="./contributor.user.js" target="_blank">Continuation userscript</a><a class="button secondary" href="https://chatgpt.com/" target="_blank" rel="noopener">Start ChatGPT Plus</a></div>
  <details><summary>Show prompt</summary><pre class="prompt">${esc(prompt)}</pre></details>
  <label class="proposal-label">Returned proposal JSON<textarea data-proposal="${esc(p.reddit_id)}" rows="12" placeholder='{"reddit_id":"${esc(p.reddit_id)}", ...}'></textarea></label>
  <div class="buttons"><button data-submit-proposal="${esc(p.reddit_id)}">Submit for publication</button></div><div class="submit-state" data-submit-state="${esc(p.reddit_id)}"></div></section>`;
}
function sourceButtons(p){return `<div class="buttons"><a class="button secondary" href="${esc(p.reddit_url)}" target="_blank" rel="noopener">Reddit</a>${p.evidence_url?`<a class="button secondary" href="${esc(p.evidence_url)}" target="_blank" rel="noopener">Complete thread JSON</a>`:''}<a class="button secondary" href="${esc(p.json_url)}" target="_blank" rel="noopener">Reddit .json</a></div>`}
function postCard(p){const d=delta(p),status=p.last_ingest_error?'ingest pending':p.source_complete?'complete tree':'partial tree';
  return `<article class="post"><div class="score">▲<br>${esc(p.score)}<br>▼</div><div class="postbody"><div class="meta">r/singularity · u/${esc(p.author)} · ${esc(p.comment_count)} comments · ${esc(status)}</div><a class="title" href="#/post/${encodeURIComponent(p.reddit_id)}">${esc(p.title)}</a>${p.dek?`<div class="dek">${esc(p.dek)}</div>`:''}${p.summary?`<div class="summary">${summaryHtml(p.summary)}</div>`:'<div class="meta">Transductive summary missing — open for contribution.</div>'}${p.summary_refresh_needed?'<div class="refresh">New source evidence exists; summary refresh requested.</div>':''}<div class="source-change">source ${p.source_bytes||0} bytes${d?` · ${d>0?'+':''}${d} since previous ingest`:''}</div>${sourceButtons(p)}</div></article>`}
function list(){app.innerHTML=data.map(postCard).join('')}
function article(p){if(!p){app.innerHTML='<div class="article">Post not found.</div>';return}
  const cites=(p.cited_comments||[]).map(c=>`<li><a href="${esc(c.permalink)}" target="_blank" rel="noopener">u/${esc(c.author)}</a>${c.score!=null?` · ${esc(c.score)} points`:''}<br>${esc(c.claim||'')}</li>`).join('');
  app.innerHTML=`<article class="article"><div class="meta">r/singularity · u/${esc(p.author)} · ${esc(p.comment_count)} comments · evidence: ${esc(p.source_origin||'pending')}</div><h1>${esc(p.title)}</h1>${sourceButtons(p)}${p.last_ingest_error?`<div class="warning">Latest complete-tree ingest pending: ${esc(p.last_ingest_error)}</div>`:''}${p.summary?`<h2>Transductive view</h2>${p.dek?`<div class="dek">${esc(p.dek)}</div>`:''}<div class="summary">${summaryHtml(p.summary)}</div>`:''}${(!p.summary||p.summary_refresh_needed)?contributionBox(p):''}${cites?`<h3>Reddit citations</h3><ul class="citations">${cites}</ul>`:''}<div class="source-change">Current evidence: ${p.source_bytes||0} bytes · previous: ${p.previous_source_bytes||0} · summary v${p.summary_version||0}</div></article>`}
function route(){const m=location.hash.match(/^#\/post\/(.+)$/);m?article(byId(decodeURIComponent(m[1]))):list()}
addEventListener('hashchange',route);route();
addEventListener('click',async e=>{
  const copy=e.target?.dataset?.copyPrompt;if(copy){await navigator.clipboard.writeText(promptFor(byId(copy)));e.target.textContent='Copied';setTimeout(()=>e.target.textContent='Copy ChatGPT prompt',1200);return}
  const id=e.target?.dataset?.submitProposal;if(!id)return;const box=document.querySelector(`[data-proposal="${CSS.escape(id)}"]`),state=document.querySelector(`[data-submit-state="${CSS.escape(id)}"]`);
  let proposal;try{proposal=JSON.parse(box.value);proposal.reddit_id=id}catch(err){state.textContent='Invalid JSON: '+err.message;return}
  e.target.disabled=true;state.textContent='Submitting…';
  try{const r=await fetch('./api/contribute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(proposal)});const out=await r.json();if(!r.ok)throw new Error(out.error||`HTTP ${r.status}`);state.innerHTML=`Submitted. Auto-publish: <strong>${esc(out.auto_publish_at||'already queued')}</strong>${out.moderation_issue?` · <a href="${esc(out.moderation_issue)}" target="_blank">moderation issue</a>`:''}`}
  catch(err){state.textContent='Submission failed: '+err.message;e.target.disabled=false}
});