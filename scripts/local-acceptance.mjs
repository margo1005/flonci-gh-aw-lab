import {mkdtempSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=mkdtempSync(resolve(tmpdir(),'heb-budget-'));
try {
  mkdirSync(resolve(scratch,'tests'),{recursive:true});
  mkdirSync(resolve(scratch,'candidate/src'),{recursive:true});
  copyFileSync(resolve(root,'tests/budget.test.mjs'),resolve(scratch,'tests/budget.test.mjs'));
  copyFileSync(resolve(root,'src/budget.mjs'),resolve(scratch,'candidate/src/budget.mjs'));
  const r=spawnSync(process.execPath,['--test',resolve(scratch,'tests/budget.test.mjs')],{encoding:'utf8',timeout:10000,env:{}});
  process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exitCode=r.status===0?0:1;
} finally {rmSync(scratch,{recursive:true,force:true});}
