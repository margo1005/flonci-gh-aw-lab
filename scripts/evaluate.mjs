// Trusted child protocol; never imports the assertion library or frozen tests.
import {readFileSync} from 'node:fs';
import {createContext,SourceTextModule,runInContext} from 'node:vm';
const context=createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
const module=new SourceTextModule(readFileSync('/implementation/budget.mjs','utf8'),{context});
await module.link(()=>{throw new Error('Imports are forbidden for this pure function');});
await module.evaluate({timeout:500});
context.__validate=module.namespace.validateBudget;
context.__min=process.argv[2];context.__max=process.argv[3];
const result=runInContext('__validate(__min,__max)',context,{timeout:500});
process.stdout.write(JSON.stringify(result));
