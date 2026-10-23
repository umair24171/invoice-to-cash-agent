import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);const hits=[];
for(const file of files){if(/(^|\/)\.env(?:\.|$)/.test(file))hits.push(file+': env file');const text=readFileSync(file,'utf8');if(/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bsk-ant-[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b/.test(text))hits.push(file+': credential pattern');}
if(hits.length){console.error(hits.join('\n'));process.exit(1);}console.log(`Scanned ${files.length} tracked files: no configured credential patterns or env files. Synthetic fixtures reviewed separately. This pattern scan is not proof of absence.`);
