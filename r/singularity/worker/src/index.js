const PREFIX="/r/singularity";
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const b64=text=>{const b=new TextEncoder().encode(text);let x="";for(let i=0;i<b.length;i+=32768)x+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(x)};
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");

async function gh(env,path,init={}){
  const r=await fetch("https://api.github.com"+path,{...init,headers:{
    accept:"application/vnd.github+json",authorization:"Bearer "+env.GITHUB_TOKEN,
    "x-github-api-version":"2022-11-28","user-agent":"transductive-singularity-contributor/0.2",...(init.headers||{})
  }});
  const t=await r.text(); let v=null; try{v=t?JSON.parse(t):null}catch{v={raw:t}}
  if(!r.ok) throw new Error(`GitHub ${r.status}: ${v?.message||t.slice(0,240)}`);
  return v;
}
async function registry(env){const r=await env.ASSETS.fetch(new Request("https://assets.invalid/data/posts.json"));if(!r.ok)throw new Error("article registry unavailable");return r.json()}
function normalize(x){
  if(!x||typeof x!=="object")throw new Error("proposal must be an object");
  const p={reddit_id:String(x.reddit_id||"").toLowerCase(),title:String(x.title||"").trim(),dek:String(x.dek||"").trim(),
    summary_markdown:String(x.summary_markdown||"").trim(),source_bytes_observed:Number(x.source_bytes_observed),
    cited_comments:Array.isArray(x.cited_comments)?x.cited_comments.slice(0,80).map(c=>({author:String(c?.author||""),
      score:Number.isFinite(Number(c?.score))?Number(c.score):null,permalink:String(c?.permalink||""),claim:String(c?.claim||"").slice(0,2000)})):[]
  };
  if(!/^[a-z0-9]+$/.test(p.reddit_id))throw new Error("invalid reddit_id");
  if(!p.title||p.title.length>500)throw new Error("invalid title");
  if(!p.dek||p.dek.length>1000)throw new Error("invalid dek");
  if(p.summary_markdown.length<80||p.summary_markdown.length>60000)throw new Error("summary_markdown must be 80..60000 characters");\n  if(!Number.isInteger(p.source_bytes_observed)||p.source_bytes_observed<0)throw new Error("source_bytes_observed must be a non-negative integer");
  for(const c of p.cited_comments)if(c.permalink&&!/^https:\/\/(?:www\.)?reddit\.com\//i.test(c.permalink))throw new Error("citation permalink must be reddit.com");
  return p;
}
async function email(env,s,issue){
  if(!env.RESEND_API_KEY||!env.MODERATOR_EMAIL)return{sent:false,reason:"email secrets not configured"};
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},
    body:JSON.stringify({from:env.MODERATOR_FROM||"Transductive <moderation@transductive.org>",to:[env.MODERATOR_EMAIL],
      subject:`Transductive review: ${s.proposal.title.slice(0,120)}`,html:`<h2>r/singularity proposal</h2><p><strong>${esc(s.proposal.title)}</strong></p><p>Submitted: ${esc(s.submitted_at)}<br>Auto-publishes: ${esc(s.auto_publish_at)}</p><p><a href="${esc(issue)}">Open moderation issue</a></p><p>Add <code>transductive-approved</code> to publish now or <code>transductive-rejected</code> to stop publication.</p>`})});
  const t=await r.text();return r.ok?{sent:true}:{sent:false,reason:`Resend ${r.status}: ${t.slice(0,240)}`};
}
async function contribute(req,env){
  if(!env.GITHUB_TOKEN)return json({error:"contribution service not configured"},503);
  if(Number(req.headers.get("content-length")||0)>100000)return json({error:"payload too large"},413);
  let p;try{p=normalize(await req.json())}catch(e){return json({error:String(e.message||e)},400)}
  let posts;try{posts=await registry(env)}catch(e){return json({error:String(e.message||e)},503)}
  const post=posts.find(x=>x.reddit_id===p.reddit_id);if(!post)return json({error:"unknown reddit_id"},404);
  if(post.summary_status==="published"&&!post.summary_refresh_needed)return json({error:"article already has a current published summary"},409);
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(p.reddit_id+"\0"+p.summary_markdown));
  const id=hex(d).slice(0,24), repo=env.GITHUB_REPO||"FreesoSaiFared/life", branch=env.GITHUB_BRANCH||"master";
  const path=`r/singularity/data/submissions/${id}.json`;
  const exists=await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,{headers:{authorization:"Bearer "+env.GITHUB_TOKEN,"user-agent":"transductive-singularity-contributor/0.2",accept:"application/vnd.github+json"}});
  if(exists.ok)return json({status:"already-submitted",submission_id:id});
  const submitted=new Date(),auto=new Date(submitted.getTime()+48*3600*1000);
  let issue;try{issue=await gh(env,`/repos/${repo}/issues`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
    title:`[r/singularity] Review ${p.reddit_id}: ${p.title.slice(0,120)}`,
    body:[`Submission: **${id}**`,`Reddit: https://www.reddit.com/comments/${p.reddit_id}/`,`Submitted: ${submitted.toISOString()}`,`Auto-publish: ${auto.toISOString()}`,"","Add `transductive-approved` to publish on the next hourly pass.","Add `transductive-rejected` to prevent publication.","","### Dek",p.dek,"","### Proposed summary",p.summary_markdown].join("\n"),
    labels:["transductive-review"]})})}catch(e){return json({error:String(e.message||e)},502)}
  const s={schema:"transductive-reddit-submission/1",submission_id:id,status:"pending",submitted_at:submitted.toISOString(),auto_publish_at:auto.toISOString(),issue_number:issue.number,issue_url:issue.html_url,proposal:p};
  try{await gh(env,`/repos/${repo}/contents/${path}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({message:`Queue r/singularity summary ${id}`,content:b64(JSON.stringify(s,null,2)+"\n"),branch})})}
  catch(e){return json({error:String(e.message||e),issue_url:issue.html_url},502)}
  const note=await email(env,s,issue.html_url);
  return json({status:"submitted",submission_id:id,auto_publish_at:s.auto_publish_at,moderation_issue:issue.html_url,moderator_email_sent:note.sent,email_note:note.sent?undefined:note.reason},202);
}
export default{async fetch(req,env){const u=new URL(req.url);
  const path=u.pathname.startsWith(PREFIX)?(u.pathname.slice(PREFIX.length)||"/"):u.pathname;
  if(req.method==="GET"&&path==="/api/health")return json({ok:true,service:"transductive-r-singularity",contribution_configured:Boolean(env.GITHUB_TOKEN),email_configured:Boolean(env.RESEND_API_KEY&&env.MODERATOR_EMAIL)});
  if(req.method==="POST"&&path==="/api/contribute")return contribute(req,env);
  if(req.method==="OPTIONS"&&path.startsWith("/api/"))return new Response(null,{status:204});
  u.pathname=path;
  return env.ASSETS.fetch(new Request(u,req));
}};