import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPatch,assertOutput,hash,suiteHash} from './policy.mjs';
import {readFileSync} from 'node:fs';
const base='a'.repeat(40);
const patch='From '+base+' Mon Sep 17 00:00:00 2001\nX-GH-AW-Base-Commit: '+base+'\n\ndiff --git a/src/budget.mjs b/src/budget.mjs\n--- a/src/budget.mjs\n+++ b/src/budget.mjs\n@@ -1 +1 @@\n-old\n+new\n';
test('frozen suite digest',()=>assert.equal(hash(readFileSync(new URL('../tests/budget.test.mjs',import.meta.url))),suiteHash));
test('accept exact scoped patch',()=>assertPatch(patch,base));
for(const [name,mutate] of [
 ['wrong base',s=>s.replace('X-GH-AW-Base-Commit: '+base,'X-GH-AW-Base-Commit: '+'b'.repeat(40))],
 ['test tampering',s=>s.replaceAll('src/budget.mjs','tests/budget.test.mjs')],
 ['path traversal',s=>s.replaceAll('src/budget.mjs','../../outside')],
 ['symlink mode',s=>s+'new mode 120000\n'],
 ['extra file',s=>s+'diff --git a/other b/other\n'],
 ['binary patch',s=>s+'GIT binary patch\n'],
 ['oversize',s=>s+'x'.repeat(16384)],
]) test('reject '+name,()=>assert.throws(()=>assertPatch(mutate(patch),base)));
test('one exact output',()=>assertOutput({items:[{type:'create_pull_request',branch:'heb-budget-001'}]}));
test('reject cross repo',()=>assert.throws(()=>assertOutput({items:[{type:'create_pull_request',branch:'heb-budget-001',repo:'other/private'}]})));
test('reject duplicate output',()=>assert.throws(()=>assertOutput({items:[{type:'create_pull_request',branch:'heb-budget-001'},{type:'noop'}]})));
test('reject alternate branch',()=>assert.throws(()=>assertOutput({items:[{type:'create_pull_request',branch:'main'}]})));
