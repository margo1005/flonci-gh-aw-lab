// Trusted adapter: assertions run in the parent; candidate code runs in a separate
// networkless container. Candidate code cannot replace the parent assertion library.
import {spawnSync} from 'node:child_process';
export function validateBudget(min,max) {
 const args=JSON.parse(process.env.HEB_DOCKER_ARGS);
 const r=spawnSync('docker',[...args,min,max],{encoding:'utf8',timeout:15000,maxBuffer:32768,env:{PATH:process.env.PATH}});
 if(r.status!==0) throw new Error('Candidate process failed or timed out');
 return JSON.parse(r.stdout);
}
