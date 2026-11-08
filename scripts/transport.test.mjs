import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {git,stem,verifyTransport} from './transport.mjs';

const root=mkdtempSync(join(tmpdir(),'heb-transport-tests-')),trusted=join(root,'trusted');
mkdirSync(trusted);git(['init','--bare','--quiet','--template=','.'],trusted);
const text=(args,input)=>git(args,trusted,input).toString().trim();
const blob=s=>text(['hash-object','-w','--stdin'],s);
function tree(changes,from) {
  git(from?['read-tree',from]:['read-tree','--empty'],trusted);
  for(const [path,mode,value] of changes) git(['update-index','--add','--cacheinfo',mode,blob(value),path],trusted);
  return text(['write-tree']);
}
function commit(t,parents=[]) {
  return text(['hash-object','-w','-t','commit','--stdin'],
    'tree '+t+'\n'+parents.map(p=>'parent '+p+'\n').join('')+
    'author Synthetic <synthetic@example.invalid> 1700000000 +0000\ncommitter Synthetic <synthetic@example.invalid> 1700000000 +0000\n\nSynthetic transport fixture\n');
}
const source='export const validateBudget = () => null;\n';
const base=commit(tree([['src/budget.mjs','100644',source],['README.md','100644','Synthetic fixture\n']]));
git(['update-ref','refs/heads/main',base],trusted);git(['symbolic-ref','HEAD','refs/heads/main'],trusted);
const goodTree=tree([['src/budget.mjs','100644',source+'// candidate\n']],base);
const goodHead=commit(goodTree,[base]);
function fixture({head=goodHead,patchHead=goodHead,ref='heb-budget-001',extraRef=false}={}) {
  const artifact=mkdtempSync(join(root,'artifact-'));
  git(['update-ref','refs/heads/'+ref,head],trusted);
  const args=['bundle','create',join(artifact,stem+'.bundle'),base+'..refs/heads/'+ref];
  if(extraRef){git(['update-ref','refs/heads/extra',head],trusted);args.push('refs/heads/extra');}
  git(['-c','pack.window=0',...args],trusted);
  let patch=text(['format-patch','-1',patchHead,'--stdout'])+'\n';
  patch=patch.replace('\n','\nX-GH-AW-Base-Commit: '+base+'\n');
  writeFileSync(join(artifact,stem+'.patch'),patch);
  writeFileSync(join(artifact,'agent_output.json'),JSON.stringify({items:[{type:'create_pull_request',branch:'heb-budget-001',draft:true}]}));
  return artifact;
}
function verify(artifact){return verifyTransport({artifact,trusted,base});}
function change(artifact,name,fn){const p=join(artifact,name);writeFileSync(p,fn(readFileSync(p)));}
function reject(name,mutate,pattern){test('reject '+name,()=>{const a=fixture();mutate(a);assert.throws(()=>verify(a),pattern);});}
after(()=>rmSync(root,{recursive:true,force:true}));

test('valid native bundle and patch yield exact committed source bytes',()=>{
  const r=verify(fixture());assert.equal(r.head,goodHead);assert.equal(r.tree,goodTree);assert.equal(r.source.toString(),source+'// candidate\n');
});
test('trusted shallow checkout is sufficient',()=>{
  writeFileSync(join(trusted,'shallow'),base+'\n');try{assert.equal(verify(fixture()).head,goodHead);}finally{rmSync(join(trusted,'shallow'));}
});
reject('forged checksum',a=>change(a,stem+'.bundle',b=>{b[b.length-1]^=1;return b;}),/Pack checksum/);
reject('malformed bundle',a=>writeFileSync(join(a,stem+'.bundle'),'not a bundle'),/Bundle header/);
reject('wrong prerequisite',a=>change(a,stem+'.bundle',b=>Buffer.from(b.toString('latin1').replace('-'+base,'-'+'1'.repeat(40)),'latin1')),/Bundle prerequisite/);
reject('extra prerequisite',a=>change(a,stem+'.bundle',b=>Buffer.from(b.toString('latin1').replace('\n\n','\n-'+base+' extra\n\n'),'latin1')),/Exactly one prerequisite/);
reject('wrong patch base',a=>change(a,stem+'.patch',b=>b.toString().replace('X-GH-AW-Base-Commit: '+base,'X-GH-AW-Base-Commit: '+'1'.repeat(40))),/Patch base/);
reject('duplicate patch base',a=>change(a,stem+'.patch',b=>b.toString().replace('\n','\nX-GH-AW-Base-Commit: '+base+'\n')),/Duplicate patch base/);
reject('patch commit mismatch',a=>change(a,stem+'.patch',b=>b.toString().replace(goodHead,'2'.repeat(40))),/Patch commit/);
test('reject unauthorized branch',()=>assert.throws(()=>verify(fixture({ref:'main-alternative'})),/Bundle branch/));
test('reject multiple advertised refs',()=>assert.throws(()=>verify(fixture({extraRef:true})),/Exactly one prerequisite/));
test('reject patch and bundle tree disagreement',()=>{
  const other=commit(tree([['src/budget.mjs','100644',source+'// different\n']],base),[base]);
  const a=fixture({head:other});change(a,stem+'.patch',b=>b.toString().replace(goodHead,other));
  assert.throws(()=>verify(a),/trees differ/);
});
test('reject hidden extra tree file',()=>{
  const extra=commit(tree([['src/budget.mjs','100644',source+'// candidate\n'],['hidden.txt','100644','bad']],base),[base]);
  const a=fixture({head:extra});change(a,stem+'.patch',b=>b.toString().replace(goodHead,extra));assert.throws(()=>verify(a),/trees differ/);
});
test('reject intermediate history even with matching final tree',()=>{
  const intermediate=commit(tree([['hidden.txt','100644','bad']],base),[base]);
  const head=commit(goodTree,[intermediate]);const a=fixture({head});change(a,stem+'.patch',b=>b.toString().replace(goodHead,head));
  assert.throws(()=>verify(a),/Exactly one commit/);
});
test('reject merge history',()=>{
  const other=commit(tree([['other.txt','100644','side']],base),[base]);const head=commit(goodTree,[base,other]);
  const a=fixture({head});change(a,stem+'.patch',b=>b.toString().replace(goodHead,head));assert.throws(()=>verify(a),/Exactly one prerequisite|Exactly one commit/);
});
test('reject symlink in candidate tree',()=>{
  const head=commit(tree([['src/budget.mjs','120000','../../escape']],base),[base]);
  assert.throws(()=>verify(fixture({head,patchHead:head})),/Forbidden patch metadata|Exactly one regular-file diff/);
});
test('reject executable file mode',()=>{
  const head=commit(tree([['src/budget.mjs','100755',source+'// candidate\n']],base),[base]);
  assert.throws(()=>verify(fixture({head,patchHead:head})),/Forbidden patch metadata/);
});
reject('unexpected artifact',a=>writeFileSync(join(a,'surprise.txt'),'x'),/Unexpected artifact/);
reject('extra bundle',a=>writeFileSync(join(a,'aw-other.bundle'),'x'),/Unexpected artifact/);
reject('nested bundle',a=>{mkdirSync(join(a,'agent'));writeFileSync(join(a,'agent','evil.bundle'),'x');},/nested transport/);
reject('directory replacing patch',a=>{rmSync(join(a,stem+'.patch'));mkdirSync(join(a,stem+'.patch'));},/Unexpected artifact directory/);
reject('hard-linked transport',a=>{const p=join(a,stem+'.patch');linkSync(p,join(root,'hardlink'));},/regular file/);
test('reject symbolic-link artifact directory',()=>{
  const a=fixture(),link=join(root,'junction');symlinkSync(a,link,'junction');assert.throws(()=>verify(link),/directory type/);
});
reject('symbolic-link diagnostic directory',a=>symlinkSync(trusted,join(a,'agent'),'junction'),/Artifact symlink/);
reject('oversized patch',a=>writeFileSync(join(a,stem+'.patch'),'x'.repeat(16385)),/Artifact size/);
reject('oversized bundle',a=>writeFileSync(join(a,stem+'.bundle'),Buffer.alloc(65537)),/Artifact size/);
reject('malformed JSON',a=>writeFileSync(join(a,'agent_output.json'),'{'),/JSON/);
reject('non-draft output',a=>change(a,'agent_output.json',b=>b.toString().replace('true','false')),/Draft required/);
reject('output scope mismatch',a=>change(a,'agent_output.json',b=>b.toString().replace('heb-budget-001','main')),/strictly equal/);
reject('missing bundle',a=>rmSync(join(a,stem+'.bundle')),/Missing transport/);
function replacePack(a,pack){change(a,stem+'.bundle',b=>Buffer.concat([b.subarray(0,b.indexOf('\n\n')+2),pack,createHash('sha1').update(pack).digest()]));}
reject('excessive object count',a=>{const p=Buffer.alloc(12);p.write('PACK');p.writeUInt32BE(2,4);p.writeUInt32BE(17,8);replacePack(a,p);},/Pack object count/);
reject('truncated compressed data',a=>{const b=readFileSync(join(a,stem+'.bundle'));const p=b.subarray(b.indexOf('\n\n')+2,-21);replacePack(a,p);});
reject('decompression bomb',a=>{const p=Buffer.alloc(12);p.write('PACK');p.writeUInt32BE(2,4);p.writeUInt32BE(1,8);replacePack(a,Buffer.concat([p,Buffer.from([0x31]),deflateSync(Buffer.alloc(65537))]));});
reject('trailing pack data',a=>{const b=readFileSync(join(a,stem+'.bundle'));replacePack(a,Buffer.concat([b.subarray(b.indexOf('\n\n')+2,-20),Buffer.from('extra')]));},/Trailing pack data/);
test('reject approved-base mismatch before parsing',()=>assert.throws(()=>verifyTransport({artifact:fixture(),trusted,base:'3'.repeat(40)}),/Trusted checkout base/));

function packObject(type,body) {
  let size=body.length;const bytes=[(type<<4)|(size&15)];size>>>=4;
  while(size){bytes[bytes.length-1]|=128;bytes.push(size&127);size>>>=7;}
  return Buffer.concat([Buffer.from(bytes),...(type===7?[Buffer.alloc(20)]:[]),deflateSync(body)]);
}
function singlePack(type,body){const h=Buffer.alloc(12);h.write('PACK');h.writeUInt32BE(2,4);h.writeUInt32BE(1,8);return Buffer.concat([h,packObject(type,body)]);}
reject('oversized delta source',a=>replacePack(a,singlePack(7,Buffer.from([0x81,0x80,0x04,1]))),/Delta source size/);
reject('oversized delta target',a=>replacePack(a,singlePack(7,Buffer.from([1,0x81,0x80,0x04]))),/Delta target size/);
reject('invalid delta instructions',a=>replacePack(a,singlePack(7,Buffer.from([1,1,0]))),/Offline Git operation failed/);
reject('unreachable extra pack object',a=>{
  const b=readFileSync(join(a,stem+'.bundle')),p=Buffer.from(b.subarray(b.indexOf('\n\n')+2,-20));
  p.writeUInt32BE(p.readUInt32BE(8)+1,8);replacePack(a,Buffer.concat([p,packObject(3,Buffer.from('unreachable payload'))]));
},/Unreachable bundle object/);
test('Git subprocess ignores inherited config, alternates and credentials',()=>{
  const poison={GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'core.repositoryFormatVersion',GIT_CONFIG_VALUE_0:'999',GIT_OBJECT_DIRECTORY:join(root,'nonexistent'),GIT_ALTERNATE_OBJECT_DIRECTORIES:join(root,'nonexistent'),GIT_DIR:join(root,'nonexistent'),GH_TOKEN:'synthetic-never-a-credential',OPENAI_API_KEY:'synthetic-never-a-credential'};
  const old=Object.fromEntries(Object.keys(poison).map(k=>[k,process.env[k]]));
  try{Object.assign(process.env,poison);assert.equal(verify(fixture()).head,goodHead);}
  finally{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('Git network transport is denied even to loopback',()=>assert.throws(()=>git(['ls-remote','https://127.0.0.1:1/not-a-repo'],trusted),/Offline Git operation failed/));
