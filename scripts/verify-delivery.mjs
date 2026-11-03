import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
import {hash} from './policy.mjs';
const repo='margo1005/flonci-gh-aw-lab';
const n=process.env.PR_NUMBER;
assert.match(n,/^[1-9][0-9]*$/);
async function get(path) {
 const r=await fetch('https://api.github.com/repos/'+repo+path,{headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 assert(r.ok,'GitHub read failed: '+r.status);return r.json();
}
const pr=await get('/pulls/'+n);
assert.equal(pr.draft,true);assert.equal(pr.state,'open');
assert.equal(pr.base.sha,process.env.GITHUB_SHA);
assert.equal(pr.base.ref,'main');
assert.equal(pr.head.repo.full_name,repo);
const files=await get('/pulls/'+n+'/files?per_page=100');
assert.equal(pr.changed_files,1);assert.equal(files.length,1);assert.equal(files[0].filename,'src/budget.mjs');assert.equal(files[0].status,'modified');
const blob=await get('/git/blobs/'+files[0].sha);
assert.equal(hash(Buffer.from(blob.content.replace(/\s/g,''),'base64')),process.env.VERIFIED_HASH);
const again=await get('/pulls/'+n);
assert.equal(again.head.sha,pr.head.sha,'PR head changed during verification');
appendFileSync(process.env.GITHUB_OUTPUT,'head_sha='+pr.head.sha+'\n');
appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## דוח מסירה בעברית\n\nהקוד ב־Draft PR זהה לבתים שעברו את 16 בדיקות הקבלה העצמאיות.\n\nבקשה: HEB-BUDGET-001. לא בוצע merge או deployment.\n\nstaging וייצור: לא נבדקו. נדרש אישור אנושי לפני כל הרחבת ניסוי.\n');
