import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const suiteHash='ac100cdc9a9b8c9626dfbffec4a60ccf743ceec60c4deb125a1f08cb2070b4c2';
export const image='node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function assertPatch(patch,base) {
  assert(Buffer.byteLength(patch)<=16384,'Patch size');
  assert.match(base,/^[a-f0-9]{40}$/);
  const header=patch.split(/\r?\n\r?\n/,1)[0];
  assert.equal(header.match(/^X-GH-AW-Base-Commit: ([a-f0-9]{40})$/m)?.[1],base,'Patch base');
  const headers=patch.match(/^diff --git .*$/gm)||[];
  assert.deepEqual(headers,['diff --git a/src/budget.mjs b/src/budget.mjs'],'Exactly one regular-file diff');
  assert(!/^(?:old mode|new mode|new file mode|deleted file mode|rename |copy |GIT binary patch|Binary files|Submodule )/m.test(patch),'Forbidden patch metadata');
  assert.equal((patch.match(/^--- a\/src\/budget\.mjs$/gm)||[]).length,1);
  assert.equal((patch.match(/^\+\+\+ b\/src\/budget\.mjs$/gm)||[]).length,1);
}
export function assertOutput(value) {
  assert(Array.isArray(value.items));
  assert.equal(value.items.length,1,'Exactly one output');
  const item=value.items[0];
  assert.equal(item.type,'create_pull_request');
  assert.equal(item.branch,'heb-budget-001');
  assert(!item.repo || item.repo==='margo1005/flonci-gh-aw-lab');
  assert(!item.base || item.base==='main');
  return item;
}
