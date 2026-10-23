import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {connect} from '../src/db.js';import {migrate} from '../src/schema.js';import {InvoiceAgent} from '../src/agent.js';import {MockProvider} from '../src/provider.js';
test('16 disk-backed PostgreSQL survives close and reopen with day-14 job',async()=>{
 if(process.env.DATABASE_URL)return;const dir=await mkdtemp(join(tmpdir(),'invoice-db-'));process.env.PGLITE_PATH=dir;
 let db=await connect();try{await migrate(db);let a=new InvoiceAgent(db,new MockProvider());await a.customer('persist');await a.invoice({id:'persist',reference:'SYN-PERSIST',customer:'persist',amount:100,currency:'USD',due:'2026-01-01Z'});await db.close();db=await connect();a=new InvoiceAgent(db,new MockProvider());await a.work('2026-01-15Z');assert.equal((await db.query('SELECT * FROM outbox')).length,1);}finally{await db.close();delete process.env.PGLITE_PATH;await rm(dir,{recursive:true,force:true});}
});
test('16 native PostgreSQL rolls back a SIGKILLed child transaction', {skip:!process.env.DATABASE_URL},async()=>{
 const db=await connect();try{await migrate(db);await db.query("DELETE FROM customers WHERE id='killed-worker'");
 const child=spawn(process.execPath,['--import','tsx','tests/crash-worker.ts'],{env:process.env,stdio:['ignore','pipe','pipe','ipc']});
 const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw new Error('Child exited before transaction');}),new Promise<never>((_,reject)=>{const t=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Child timeout'));},15000);t.unref();})]);assert.deepEqual(ready,[{ready:true}]);const exited=once(child,'exit');child.kill('SIGKILL');await exited;
 assert.equal((await db.query("SELECT * FROM customers WHERE id='killed-worker'")).length,0);
 }finally{await db.close();}
});
