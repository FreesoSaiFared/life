const app=document.querySelector('#app');
const data=await fetch('./data/posts.json',{cache:'no-store'}).then(r=>r.json());

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=id=>data.find(p=>p.reddit_id===id);
const delta=p=>(p.source_bytes||0)-(p.previous_source_bytes||0);

function promptFor(p){
  return `You are producing a proposed article for transductive.org/r/singularity.\n\nSOURCE POST\nTitle: ${p.title}\nReddit URL: ${p.reddit_url}\nJSON URL: ${p.json_url}\nKnown source bytes: ${p.source_bytes}\nPrevious source bytes: ${p.previous_source_bytes}\n\nTASK\n1. Ingest the Reddit post and comments. Prefer the logged-in URL+.json view when available; otherwise use the visible Reddit thread.\n2. Read enough of the comment tree to identify the strongest claims, disagreements, overlooked implications, and direct comment permalinks.\n3. Write a compact article from a transductive perspective: treat AI as a force that changes the space of possible institutions, identities, work, cognition and collective action rather than merely improving an existing process.\n4. Do not summarize every comment. Synthesize the thread. Distinguish what the post claims, what commenters add, and your transductive interpretation.\n5. Cite Reddit comments with direct reddit.com permalinks.\n6. Return ONLY one JSON object with keys: reddit_id, title, dek, summary_markdown, cited_comments[{author,score,permalink,claim}], source_bytes_observed, generated_at.\n7. If the source is larger than the previously recorded version, update the synthesis rather than appending a changelog.\n\nREDDIT_ID\n${p.reddit_id}`;
}

function missingBox(p){
  const prompt=promptFor(p);
  return `<section class="missing"><strong>No transductive summary yet.</strong><p>This article is open for a ChatGPT Plus contribution. The session should ingest the post + comments, synthesize them, cite direct Reddit comments, then return one proposal JSON object.</p><div class="buttons"><button data-copy-prompt="${esc(p.reddit_id)}">Copy ChatGPT prompt</button><a class="button secondary" href="./contributor.user.js" target="_blank">Open continuation userscript</a><a class="button secondary" href="https://chatgpt.com/" target="_blank" rel="noopener">Start ChatGPT Plus session</a></div><pre class="prompt">${esc(prompt)}</pre></section>`;
}

function postCard(p){
  const d=delta(p);
  return `<article class="post"><div class="score">▲<br>${esc(p.score)}<br>▼</div><div class="postbody"><div class="meta">r/singularity · u/${esc(p.author)} · ${esc(p.comment_count)} comments</div><a class="title" href="#/post/${encodeURIComponent(p.reddit_id)}">${esc(p.title)}</a>${p.summary?`<div class="summary">${esc(p.summary)}</div>`:'<div class="meta">Transductive summary missing — open for contribution.</div>'}<div class="source-change">source ${p.source_bytes||0} bytes${d?` · ${d>0?'+':''}${d} since previous ingest`:''}</div><div class="buttons"><a class="button secondary" href="${esc(p.reddit_url)}" target="_blank" rel="noopener">Reddit</a><a class="button secondary" href="${esc(p.json_url)}" target="_blank" rel="noopener">URL+.json</a></div></div></article>`;
}

function list(){app.innerHTML=data.map(postCard).join('');}
function article(p){
  if(!p){app.innerHTML='<div class="article">Post not found.</div>';return;}
  const links=(p.direct_comment_links||[]).map(x=>`<li><a href="${esc(x)}" target="_blank" rel="noopener">${esc(x)}</a></li>`).join('');
  app.innerHTML=`<article class="article"><div class="meta">r/singularity · u/${esc(p.author)} · ${esc(p.comment_count)} comments</div><h1>${esc(p.title)}</h1><div class="buttons"><a class="button secondary" href="${esc(p.reddit_url)}" target="_blank" rel="noopener">Open source thread</a><a class="button secondary" href="${esc(p.json_url)}" target="_blank" rel="noopener">Open URL+.json</a></div>${p.summary?`<h2>Transductive view</h2><div class="summary">${esc(p.summary)}</div>`:missingBox(p)}${links?`<h3>Cited comments</h3><ul>${links}</ul>`:''}<div class="source-change">Current source: ${p.source_bytes||0} bytes · previous: ${p.previous_source_bytes||0} bytes · summary v${p.summary_version||0}</div></article>`;
}
function route(){const m=location.hash.match(/^#\/post\/(.+)$/);m?article(byId(decodeURIComponent(m[1]))):list();}
addEventListener('hashchange',route);route();
addEventListener('click',async e=>{const id=e.target?.dataset?.copyPrompt;if(!id)return;await navigator.clipboard.writeText(promptFor(byId(id)));e.target.textContent='Copied';setTimeout(()=>e.target.textContent='Copy ChatGPT prompt',1200);});
