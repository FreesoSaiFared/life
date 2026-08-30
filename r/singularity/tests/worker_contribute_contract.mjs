import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync('r/singularity/worker/src/index.js','utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));

const proposal={
  reddit_id:'abc123',
  title:'Successful contribution contract fixture',
  dek:'A compact deck for the contribution contract fixture.',
  summary_markdown:'This deliberately long transductive summary fixture is only used to prove that a valid contribution creates a moderation issue, stores a durable pending submission, and requests moderator email without touching the live network.',
  cited_comments:[{
    author:'fixture_user',
    score:12,
    permalink:'https://www.reddit.com/r/singularity/comments/abc123/example/p0/',
    claim:'Fixture claim'
  }],
  source_bytes_observed:777,
  generated_at:'2026-08-30T12:00:00Z'
};

const calls=[];
let duplicate=false;
const originalFetch=globalThis.fetch;

globalThis.fetch=async (input,init={})=>{
  const url=String(input);
  const method=(init.method||'GET').toUpperCase();
  let body=null;
  if(init.body){
    try{body=JSON.parse(String(init.body))}catch{body=String(init.body)}
  }
  calls.push({url,method,body});

  if(url.startsWith('https://api.github.com/repos/FreesoSaiFared/life/contents/r/singularity/data/submissions/') && method==='GET'){
    return new Response(duplicate?'{}':'not found',{status:duplicate?200:404});
  }
  if(url==='https://api.github.com/repos/FreesoSaiFared/life/issues' && method==='POST'){
    return Response.json({number:77,html_url:'https://github.com/FreesoSaiFared/life/issues/77'},{status:201});
  }
  if(url.startsWith('https://api.github.com/repos/FreesoSaiFared/life/contents/r/singularity/data/submissions/') && method==='PUT'){
    return Response.json({content:{sha:'fixture-sha'}},{status:201});
  }
  if(url==='https://api.resend.com/emails' && method==='POST'){
    return Response.json({id:'email_fixture_1'},{status:200});
  }
  throw new Error('unexpected network call '+method+' '+url);
};

try{
  const env={
    GITHUB_TOKEN:'fixture-github-token',
    RESEND_API_KEY:'fixture-resend-key',
    MODERATOR_EMAIL:'moderator@example.test',
    MODERATOR_FROM:'Transductive <moderation@transductive.org>',
    GITHUB_REPO:'FreesoSaiFared/life',
    GITHUB_BRANCH:'master',
    ASSETS:{
      fetch:async()=>Response.json([{
        reddit_id:'abc123',
        source_bytes:777,
        summary_status:'missing',
        summary_refresh_needed:false
      }])
    }
  };

  const first=await mod.default.fetch(new Request('https://fixture/r/singularity/api/contribute',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(proposal)
  }),env);
  const firstBody=await first.json();

  assert.equal(first.status,202);
  assert.equal(firstBody.status,'submitted');
  assert.equal(firstBody.moderator_email_sent,true);
  assert.equal(firstBody.moderation_issue,'https://github.com/FreesoSaiFared/life/issues/77');
  assert.match(firstBody.submission_id,/^[a-f0-9]{24}$/);

  const issueCall=calls.find(c=>c.url.endsWith('/issues')&&c.method==='POST');
  const putCall=calls.find(c=>c.method==='PUT'&&c.url.includes('/contents/r/singularity/data/submissions/'));
  const emailCall=calls.find(c=>c.url==='https://api.resend.com/emails'&&c.method==='POST');
  assert(issueCall,'moderation issue was not created');
  assert(putCall,'durable submission was not written');
  assert(emailCall,'moderator email was not requested');

  const queued=JSON.parse(Buffer.from(putCall.body.content,'base64').toString('utf8'));
  assert.equal(queued.status,'pending');
  assert.equal(queued.issue_number,77);
  assert.equal(queued.proposal.reddit_id,'abc123');
  assert.equal(queued.proposal.source_bytes_observed,777);
  assert.equal(new Date(queued.auto_publish_at)-new Date(queued.submitted_at),48*60*60*1000);

  assert.deepEqual(emailCall.body.to,['moderator@example.test']);
  assert.match(emailCall.body.subject,/Successful contribution contract fixture/);

  const issueCountBefore=calls.filter(c=>c.url.endsWith('/issues')&&c.method==='POST').length;
  duplicate=true;
  const second=await mod.default.fetch(new Request('https://fixture/r/singularity/api/contribute',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(proposal)
  }),env);
  const secondBody=await second.json();
  assert.equal(second.status,200);
  assert.equal(secondBody.status,'already-submitted');
  assert.equal(calls.filter(c=>c.url.endsWith('/issues')&&c.method==='POST').length,issueCountBefore);

  console.log(JSON.stringify({
    success_status:first.status,
    duplicate_status:second.status,
    submission_id:firstBody.submission_id,
    issue_created:true,
    durable_write:true,
    email_requested:true
  }));
} finally {
  globalThis.fetch=originalFetch;
}
