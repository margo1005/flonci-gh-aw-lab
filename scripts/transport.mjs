// Narrow gh-aw v1.0.1 transport profile for HEB-BUDGET-001. Never executes candidate code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {readSync,writeFileSync,readdirSync,lstatSync,mkdtempSync,mkdirSync,rmSync,openSync,closeSync,fstatSync,constants} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {assertPatch,assertOutput,hash} from './policy.mjs';

export const stem='aw-margo1005-flonci-gh-aw-lab-heb-budget-001';
const diagnostics=new Set(['agent_execution_exit_code.txt','agent_execution.json','agent_usage.json','agent-errors.jsonl','agent-session.jsonl','agent-stdio.log','awf-config.json','github_rate_limits.jsonl','otel.jsonl','pre-agent-audit.txt','safeoutputs.jsonl','skill_inventory.json']);
const directories=new Set(['agent','aw-prompts','mcp-logs','sandbox']);
const required=new Set(['agent_output.json',stem+'.patch',stem+'.bundle']);
const sha=/^[a-f0-9]{40}$/;
const nullFile=process.platform==='win32'?'NUL':'/dev/null';

// Do not inherit GitHub/OpenAI tokens, SSH agents, Git config, alternates or proxy settings.
export function git(args,cwd,input) {
  const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot||'',TMP:tmpdir(),TEMP:tmpdir(),
    GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullFile,GIT_TERMINAL_PROMPT:'0',
    GIT_NO_REPLACE_OBJECTS:'1',GIT_ALLOW_PROTOCOL:'',GIT_NO_LAZY_FETCH:'1',LC_ALL:'C'};
  const r=spawnSync('git',['-c','core.hooksPath='+nullFile,'-c','credential.helper=',
    '-c','protocol.allow=never','-c','core.autocrlf=false','-c','core.attributesFile='+nullFile,...args],
    {cwd,input,env,timeout:15000,maxBuffer:8*1024*1024,windowsHide:true});
  assert.equal(r.status,0,'Offline Git operation failed: '+args[0]);
  return r.stdout;
}

function snapshot(root) {
  assert(lstatSync(root).isDirectory()&&!lstatSync(root).isSymbolicLink(),'Artifact directory type');
  let count=0,total=0;
  const data={};
  function visit(dir,depth=0) {
    assert(depth<=5,'Artifact depth');
    for(const name of readdirSync(dir)) {
      assert(++count<=256,'Artifact count');
      assert(/^[a-zA-Z0-9_.-]+$/.test(name),'Artifact name');
      const p=join(dir,name),s=lstatSync(p);
      assert(!s.isSymbolicLink(),'Artifact symlink');
      if(depth===0) assert(required.has(name)||diagnostics.has(name)||directories.has(name),'Unexpected artifact');
      else assert(!/\.(patch|bundle)$/i.test(name),'Unexpected nested transport');
      if(s.isDirectory()) {
        if(depth===0) assert(directories.has(name),'Unexpected artifact directory');
        visit(p,depth+1);continue;
      }
      assert(s.isFile()&&s.nlink===1,'Artifact regular file required');
      if(depth===0) assert(!directories.has(name),'Diagnostic directory required');
      const limit=name===stem+'.patch'?16384:name===stem+'.bundle'?65536:name==='agent_output.json'?16384:1048576;
      assert(s.size<=limit,'Artifact size');total+=s.size;assert(total<=4*1048576,'Artifact total size');
      if(depth===0&&required.has(name)) {
        const fd=openSync(p,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
        try {
          const before=fstatSync(fd);assert(before.isFile()&&before.ino===s.ino&&before.dev===s.dev&&before.size===s.size,'Artifact replaced');
          // Bounded even if the same inode grows between stat and read.
          const buffer=Buffer.alloc(limit+1);let length=0,n;
          while(length<buffer.length&&(n=readSync(fd,buffer,length,buffer.length-length,null))>0) length+=n;
          assert(length<=limit,'Artifact read size');data[name]=buffer.subarray(0,length);const after=fstatSync(fd);
          assert(after.size===s.size&&after.mtimeMs===s.mtimeMs&&data[name].length===s.size,'Artifact changed');
        } finally {closeSync(fd);}
      }
    }
  }
  visit(root);assert.deepEqual(Object.keys(data).sort(),[...required].sort(),'Missing transport');
  return data;
}

// Bound decompression before handing the pack to Git, including delta output sizes.
function boundedPack(pack) {
  assert(pack.length>=32&&pack.subarray(0,4).toString()==='PACK','Pack signature');
  assert.equal(pack.readUInt32BE(4),2,'Pack version');
  const count=pack.readUInt32BE(8);assert(count>0&&count<=16,'Pack object count');
  assert(createHash('sha1').update(pack.subarray(0,-20)).digest().equals(pack.subarray(-20)),'Pack checksum');
  let pos=12,total=0;
  function byte(){assert(pos<pack.length-20,'Truncated pack');return pack[pos++];}
  for(let i=0;i<count;i++) {
    let c=byte(),size=c&15,shift=4;const type=(c>>4)&7;
    while(c&128){assert(shift<=18,'Pack size overflow');c=byte();size+=(c&127)*2**shift;shift+=7;}
    assert([1,2,3,7].includes(type),'Unsupported pack type');assert(size<=65536,'Pack object size');
    if(type===7){assert(pos+20<pack.length-20,'Delta reference');pos+=20;}
    const inflated=inflateSync(pack.subarray(pos,-20),{maxOutputLength:65536,info:true});
    assert.equal(inflated.buffer.length,size,'Pack declared size');pos+=inflated.engine.bytesWritten;
    let expanded=size;
    if(type===7){
      let off=0;
      function number(){let value=0,b,shift=0;do{assert(off<size&&shift<=21,'Delta size encoding');b=inflated.buffer[off++];value+=(b&127)*2**shift;shift+=7;}while(b&128);return value;}
      assert(number()<=65536,'Delta source size');expanded=number();assert(expanded<=65536,'Delta target size');
    }
    total+=expanded;assert(total<=262144,'Pack expanded size');
  }
  assert.equal(pos,pack.length-20,'Trailing pack data');
}

export function verifyTransport({artifact,trusted,base}) {
  assert.match(base,sha,'Approved base required');
  assert.equal(git(['rev-parse','HEAD'],trusted).toString().trim(),base,'Trusted checkout base');
  const files=snapshot(resolve(artifact));
  const output=JSON.parse(files['agent_output.json'].toString('utf8'));
  assertOutput(output);assert.equal(output.items[0].draft,true,'Draft required');
  assert(!output.errors||output.errors.length===0,'Agent output errors');
  const patch=files[stem+'.patch'],bundle=files[stem+'.bundle'];
  assertPatch(patch.toString('utf8'),base);
  const boundary=bundle.indexOf('\n\n');assert(boundary>0&&boundary<1024,'Bundle header');
  const lines=bundle.subarray(0,boundary).toString('utf8').split('\n');
  assert.equal(lines.length,3,'Exactly one prerequisite and branch');
  assert.equal(lines[0],'# v2 git bundle','Bundle version');
  assert.match(lines[1],new RegExp('^-'+base+' [^\\r\\n\\x00]+$'),'Bundle prerequisite');
  const head=lines[2].match(/^([a-f0-9]{40}) refs\/heads\/heb-budget-001$/)?.[1];
  assert(head,'Bundle branch');
  assert.equal(patch.toString('utf8').match(/^From ([a-f0-9]{40}) Mon Sep 17 00:00:00 2001\n/)?.[1],head,'Patch commit');
  assert.equal((patch.toString('utf8').match(/^X-GH-AW-Base-Commit:/gm)||[]).length,1,'Duplicate patch base');
  const pack=bundle.subarray(boundary+2);boundedPack(pack);
  const scratch=mkdtempSync(join(tmpdir(),'heb-transport-'));
  try {
    const empty=join(scratch,'empty');mkdirSync(empty);
    git(['init','--bare','--quiet','--template='+empty,'.'],scratch);
    // Trusted base only; no clone/fetch/remotes, hooks, checkout or candidate execution.
    const baseTree=git(['rev-parse',base+'^{tree}'],trusted).toString().trim();
    const baseObjects=git(['ls-tree','-r','-t',base],trusted).toString().trim().split('\n').map(line=>line.match(/^[0-9]+ (?:tree|blob) ([a-f0-9]{40})\t/)?.[1]);
    assert(baseObjects.every(id=>id&&sha.test(id)),'Trusted base object types');
    const seed=git(['pack-objects','--stdout'],trusted,[base,baseTree,...new Set(baseObjects)].join('\n')+'\n');
    // Actions checkout is shallow. Import exactly the trusted base snapshot, not its history.
    writeFileSync(join(scratch,'shallow'),base+'\n');
    git(['index-pack','--stdin','--strict'],scratch,seed);
    git(['update-ref','refs/heads/trusted',base],scratch);
    git(['read-tree',base],scratch);
    const patchPath=join(scratch,'transport.patch');writeFileSync(patchPath,patch);
    git(['apply','--cached','--check',patchPath],scratch);
    git(['apply','--cached',patchPath],scratch);
    const patchTree=git(['write-tree'],scratch).toString().trim();
    const indexed=git(['index-pack','--stdin','--strict','--fix-thin'],scratch,pack).toString().trim();
    const packHash=indexed.match(/(?:^|\s)([a-f0-9]{40})$/)?.[1];assert(packHash,'Indexed pack');
    assert.equal(git(['cat-file','-t',head],scratch).toString().trim(),'commit','Bundle head type');
    const commit=git(['cat-file','commit',head],scratch).toString();
    assert.deepEqual(commit.split('\n\n')[0].split('\n').filter(x=>x.startsWith('parent ')),['parent '+base],'Exactly one commit on approved base');
    const tree=commit.match(/^tree ([a-f0-9]{40})$/m)?.[1];assert.equal(tree,patchTree,'Bundle and patch trees differ');
    const raw=git(['diff-tree','--no-commit-id','--raw','-r','--no-renames',base,head],scratch).toString().trim();
    assert.match(raw,/^:100644 100644 [a-f0-9]{40} [a-f0-9]{40} M\tsrc\/budget\.mjs$/,'One regular source-file change');
    const reachable=new Set(git(['rev-list','--objects',head],scratch).toString().trim().split('\n').map(x=>x.split(' ')[0]));
    const entries=git(['verify-pack','-v',join(scratch,'objects/pack/pack-'+packHash+'.idx')],scratch).toString().split('\n').filter(x=>/^[a-f0-9]{40} /.test(x));
    for(const entry of entries) assert(reachable.has(entry.split(' ')[0]),'Unreachable bundle object');
    git(['fsck','--strict','--no-reflogs',head],scratch);
    const source=git(['cat-file','blob',head+':src/budget.mjs'],scratch);
    assert(source.length<=16384,'Source size');
    return {base,head,tree,source,source_sha256:hash(source),patch_sha256:hash(patch),bundle_sha256:hash(bundle)};
  } finally {rmSync(scratch,{recursive:true,force:true});}
}
