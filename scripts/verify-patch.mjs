import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,copyFileSync,mkdtempSync,appendFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {hash,suiteHash,image} from './policy.mjs';
import {verifyTransport} from './transport.mjs';
const trusted=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const artifact=resolve(process.argv[2]);
const test=readFileSync(resolve(trusted,'tests/budget.test.mjs'));
assert.equal(hash(test),suiteHash);
const transport=verifyTransport({artifact,trusted,base:process.env.GITHUB_SHA});
const scratch=mkdtempSync(resolve(tmpdir(),'heb-independent-'));
mkdirSync(resolve(scratch,'candidate/src'),{recursive:true});
function run(exe,args,cwd=scratch) {
 const r=spawnSync(exe,args,{cwd,encoding:'utf8',timeout:90000,maxBuffer:1024*1024,env:{PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}});
 for(const line of ((r.stdout||'')+(r.stderr||'')).split('\n')) if(line) console.log('[verifier] '+line);
 assert.equal(r.status,0,exe+' failed');return r;
}
const candidate=resolve(scratch,'candidate');
const source=resolve(candidate,'src/budget.mjs');
writeFileSync(source,transport.source,{flag:'wx'});
const sourceHash=hash(readFileSync(source));
const proxy=resolve(scratch,'proxy/src');mkdirSync(proxy,{recursive:true});
copyFileSync(resolve(trusted,'scripts/acceptance-proxy.mjs'),resolve(proxy,'budget.mjs'));
// The unchanged frozen suite imports ../candidate/src/budget.mjs. Put its trusted
// adapter there, and keep the untrusted implementation mounted separately.
const testRoot=mkdtempSync(resolve(tmpdir(),'heb-assertions-'));
mkdirSync(resolve(testRoot,'tests'),{recursive:true});mkdirSync(resolve(testRoot,'candidate/src'),{recursive:true});
copyFileSync(resolve(trusted,'tests/budget.test.mjs'),resolve(testRoot,'tests/budget.test.mjs'));
copyFileSync(resolve(trusted,'scripts/acceptance-proxy.mjs'),resolve(testRoot,'candidate/src/budget.mjs'));
const dockerArgs=['run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--memory','128m','--cpus','1','--user','65534:65534','--mount','type=bind,src='+source+',dst=/implementation/budget.mjs,readonly','--mount','type=bind,src='+resolve(trusted,'scripts/evaluate.mjs')+',dst=/runner/evaluate.mjs,readonly',image,'node','--experimental-vm-modules','/runner/evaluate.mjs'];
run('docker',['pull',image]);
const accepted=spawnSync(process.execPath,['--test',resolve(testRoot,'tests/budget.test.mjs')],{encoding:'utf8',timeout:180000,maxBuffer:1024*1024,env:{PATH:process.env.PATH,HEB_DOCKER_ARGS:JSON.stringify(dockerArgs)}});
for(const line of ((accepted.stdout||'')+(accepted.stderr||'')).split('\n'))if(line)console.log('[trusted-test] '+line);
assert.equal(accepted.status,0,'Independent acceptance failed');
if(process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,'source_sha256='+sourceHash+'\n');
if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## בדיקה עצמאית\n\n16 בדיקות קבלה עברו על הקוד המוצע במכל מבודד ללא רשת או אישורים.\n\nSHA256: '+sourceHash+'\n\nסביבת staging וייצור: לא נבדקו.\n');
