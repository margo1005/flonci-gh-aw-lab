// One-shot replay preparation/execution. No inference or publication capability.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const binding=Object.freeze({
  repo:'margo1005/flonci-gh-aw-lab',repoId:1444728381,
  verifier:'85ea853102765077f3a0d86a97403bff0c8b43c0',
  base:'a52a4e50361a73afdbc6b6dd4b287d565b81b297',
  candidate:'44ab08274cbacd698db84dd3689ba8d174a76db8',
  source:'52d764cda4fd59923e480cff7974669dedbc8227154a80cc52700a8db81cc924',
  run:42472768514,artifact:13613728567,
  archive:'c2b3b21a6f248a5d13c56583310e5569f110bc100538d833db3473d6db7bec0c',
  files:{
    'scripts/transport.mjs':'7db949093527fe27cb2b13c0c32da8f361619cfbe660d72ccc976453fe2edcdc',
    'scripts/verify-patch.mjs':'ab7f8ea08281242c1dd50349a076fa97ffd2ff993f0eb78e89003f4f94f71b35',
    'scripts/policy.mjs':'c2329ff69a05c2bbe15f033d803974305824175d56a807bb3a69069b27d3f2db',
    'scripts/evaluate.mjs':'771ea2a550162387404656aac1b8cfc36298c70df7b9e1187b52bd6de2deb405',
    'scripts/acceptance-proxy.mjs':'68061f39c2af75c342b6113c258d37f3f7ace487ea1617151ce737d2d59fbf13',
    'tests/budget.test.mjs':'ac100cdc9a9b8c9626dfbffec4a60ccf743ceec60c4deb125a1f08cb2070b4c2'
  },
  transport:{
    'agent_output.json':'55082c7962b8c0be8a8a96d59f0d3d360caa17800a54dbc4fb0e01a9678024eb',
    'aw-margo1005-flonci-gh-aw-lab-heb-budget-001.patch':'b3bf7ee9e6be7bc9cfc39925d34de2205452828b4da4afc2b915113b033d34ea',
    'aw-margo1005-flonci-gh-aw-lab-heb-budget-001.bundle':'8330429d618ac1100b7c269f2983f4b2402cf5426c03eda81b326e0e637790e5'
  }
});
const hash=b=>createHash('sha256').update(b).digest('hex');
const evidence=resolve('evidence');
function record(name,data){mkdirSync(evidence,{recursive:true});writeFileSync(resolve(evidence,name),JSON.stringify(data,null,2)+'\n');}
function checkContext(){
  const e=process.env;
  assert.equal(e.GITHUB_REPOSITORY,binding.repo);assert.equal(e.GITHUB_ACTOR,'margo1005');
  assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(e.GITHUB_REF,'refs/heads/verify/gh-aw-transport-01');
  assert.match(e.APPROVED_RUNNER_SHA,/^[a-f0-9]{40}$/);assert.equal(e.GITHUB_SHA,e.APPROVED_RUNNER_SHA);
  const left=Date.parse(e.APPROVAL_EXPIRES)-Date.now();assert(left>0&&left<=3600000,'Approval window');
}
export function checkMetadata(run,artifact){
  assert.equal(run.id,binding.run);assert.equal(run.repository.id,binding.repoId);
  assert.equal(run.head_repository.id,binding.repoId);assert.equal(run.head_sha,binding.base);
  assert.equal(run.head_branch,'main');assert.equal(run.run_attempt,1);
  assert.equal(run.path,'.github/workflows/feature.lock.yml');assert.equal(run.event,'workflow_dispatch');
  assert.equal(run.status,'completed');assert.equal(run.conclusion,'cancelled');
  assert.equal(artifact.id,binding.artifact);assert.equal(artifact.name,'agent');assert.equal(artifact.expired,false);
  assert.equal(artifact.workflow_run.id,binding.run);assert.equal(artifact.workflow_run.repository_id,binding.repoId);
  assert.equal(artifact.workflow_run.head_repository_id,binding.repoId);assert.equal(artifact.workflow_run.head_sha,binding.base);
  assert.equal(artifact.digest,'sha256:'+binding.archive);assert.equal(artifact.size_in_bytes,88664);
  assert(Date.parse(artifact.expires_at)>Date.now(),'Original artifact expired');
}
async function acquire(){
  checkContext();assert(process.env.API_TOKEN,'Ephemeral read-only GitHub token required');
  const api='https://api.github.com/repos/'+binding.repo;
  const headers={Authorization:'Bearer '+process.env.API_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function get(path){const r=await fetch(api+path,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});assert(r.ok,'GitHub metadata read failed');return r.json();}
  const run=await get('/actions/runs/'+binding.run),artifact=await get('/actions/artifacts/'+binding.artifact);
  checkMetadata(run,artifact);
  const pr=await get('/pulls/2');assert.equal(pr.draft,true);assert.equal(pr.state,'open');
  assert.equal(pr.head.sha,binding.verifier);assert.equal(pr.base.sha,binding.base);
  const history=await get('/actions/workflows/laboratory-qa.yml/runs?event=workflow_dispatch&head_sha='+process.env.GITHUB_SHA+'&per_page=100');
  assert.equal(history.total_count,1,'Exactly one dispatch on this runner SHA');
  assert.equal(String(history.workflow_runs[0].id),process.env.GITHUB_RUN_ID);
  const redirect=await fetch(api+'/actions/artifacts/'+binding.artifact+'/zip',{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.equal(redirect.status,302,'Expected signed artifact download');
  const signed=new URL(redirect.headers.get('location'));assert.equal(signed.protocol,'https:');assert(!signed.username&&!signed.password);
  // Never forward Authorization to object storage or log the signed URL.
  const response=await fetch(signed,{redirect:'error',signal:AbortSignal.timeout(20000)});assert(response.ok,'Artifact download failed');
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;assert(size<=131072,'Archive size');chunks.push(chunk);}
  const zip=Buffer.concat(chunks);assert.equal(hash(zip),binding.archive,'Archive digest mismatch');
  writeFileSync(resolve(evidence,'original-agent.zip'),zip,{flag:'wx'});
  record('binding.json',{...binding,runner_sha:process.env.GITHUB_SHA,replay_run_id:process.env.GITHUB_RUN_ID,archive_bytes:zip.length,artifact_expires_at:artifact.expires_at,source_run_conclusion:'cancelled',source_threat_detection:'NOT ACCEPTED'});
  console.log('Exact run/artifact/archive binding PASS; no candidate execution in acquisition.');
}
function local(exe,args,cwd,env={}){
  const r=spawnSync(exe,args,{cwd,env:{PATH:process.env.PATH,...env},encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024});
  return r;
}
async function replay(){
  checkContext();assert.equal(process.platform,'linux','Disposable Linux runner required');
  assert(!process.env.API_TOKEN&&!process.env.GH_TOKEN&&!process.env.OPENAI_API_KEY&&!process.env.CODEX_API_KEY,'No API credentials in replay process');
  const prior=JSON.parse(readFileSync(resolve(evidence,'binding.json')));assert.equal(prior.runner_sha,process.env.GITHUB_SHA);
  const trusted=resolve('trusted'),base=resolve('base'),artifact=resolve('artifact');
  for(const [path,digest] of Object.entries(binding.files))assert.equal(hash(readFileSync(resolve(trusted,path))),digest,'Trusted file '+path);
  for(const [path,digest] of Object.entries(binding.transport))assert.equal(hash(readFileSync(resolve(artifact,path))),digest,'Transport file '+path);
  // Bind old-base Git objects separately from the new, pinned trusted verifier.
  assert.equal(local('git',['rev-parse','HEAD'],trusted).stdout.trim(),binding.verifier);
  assert.equal(local('git',['rev-parse','HEAD'],base).stdout.trim(),binding.base);
  for(const path of ['scripts/policy.mjs','scripts/evaluate.mjs','scripts/acceptance-proxy.mjs','tests/budget.test.mjs'])
    assert.equal(hash(readFileSync(resolve(base,path))),binding.files[path],'Original frozen dependency '+path);
  for(const path of ['scripts/transport.mjs','scripts/verify-patch.mjs'])copyFileSync(resolve(trusted,path),resolve(base,path));
  const output=resolve(evidence,'verifier-output.txt'),summary=resolve(evidence,'verifier-summary.md');
  // GITHUB_SHA below is an explicit verifier input for the original candidate base;
  // runner SHA is retained separately, never presented as the base commit.
  const r=local(process.execPath,[resolve(base,'scripts/verify-patch.mjs'),artifact],base,{GITHUB_SHA:binding.base,GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:summary});
  const log=(r.stdout||'')+(r.stderr||'');writeFileSync(resolve(evidence,'acceptance.log'),log);
  process.stdout.write(log);
  const complete=r.status===0&&/\[trusted-test\] # tests 16\r?\n/.test(log)&&/\[trusted-test\] # pass 16\r?\n/.test(log)&&/\[trusted-test\] # fail 0\r?\n/.test(log)&&/\[trusted-test\] # skipped 0\r?\n/.test(log)&&/\[trusted-test\] # cancelled 0\r?\n/.test(log);
  let source='UNVERIFIED';if(r.status===0)source=readFileSync(output,'utf8').match(/^source_sha256=([a-f0-9]{64})$/m)?.[1];
  const result={status:complete&&source===binding.source?'PASS':'FAIL',exit_code:r.status,signal:r.signal,log_sha256:hash(Buffer.from(log)),source_sha256:source,binding:prior,threat_detection:'NOT RUN by this replay',feature_pr:'NOT CREATED',human_security_approval:'NOT SUPPLIED'};
  record('result.json',result);
  console.log('ACCEPTANCE_EVIDENCE_JSON='+JSON.stringify(result));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## קבלה עצמאית חד־פעמית\n\nתוצאה: '+result.status+'\n\n'+(complete?'16/16 בדיקות עברו.':'אין קבלה מלאה.')+' זיהוי איומים ואישור אבטחה אנושי לא הושלמו בהרצה זו. אין אישור merge, פריסה או inference.\n');
  assert.equal(result.status,'PASS','Frozen independent acceptance did not pass completely');
}
if(process.argv[2]==='acquire'||process.argv[2]==='replay'){
  mkdirSync(evidence,{recursive:true});
  try{await(process.argv[2]==='acquire'?acquire():replay());}
  catch{record('failure.json',{stage:process.argv[2],status:'FAIL',run:process.env.GITHUB_RUN_ID});console.error('Replay gate failed; no retry authorized. Inspect the bounded preceding evidence.');process.exitCode=1;}
}
