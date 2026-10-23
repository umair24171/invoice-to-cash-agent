import {createHash} from 'node:crypto';
import type {Database,Query} from './db.js'; import type {Provider} from './provider.js';
export interface Invoice {id:string;customer:string;reference:string;amount:number;currency:string;due:string}
export interface Payment {id:string;customer:string;amount:number;currency:string;refs:string[]}
function amount(n:number){if(!Number.isSafeInteger(n)||n<=0)throw new Error('Positive safe minor-unit amount required');}
function code(s:string){if(!/^[A-Z]{3}$/.test(s))throw new Error('ISO currency required');}
function id(s:string){if(!s||s.length>200)throw new Error('Invalid identifier');}
export class InvoiceAgent {
 constructor(public db:Database,private provider:Provider){}
 async customer(customer:string,late=0){id(customer);if(!Number.isSafeInteger(late)||late<0)throw new Error('Invalid history');await this.db.query('INSERT INTO customers VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET late_count=EXCLUDED.late_count',[customer,late]);}
 async invoice(i:Invoice){amount(i.amount);code(i.currency);[i.id,i.customer,i.reference].forEach(id);if(!Number.isFinite(Date.parse(i.due)))throw new Error('Invalid date');
 return this.db.tx(async q=>{
  await q.query('INSERT INTO invoices(id,customer,reference,amount,currency,due_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[i.id,i.customer,i.reference,i.amount,i.currency,i.due]);
  const [r]=await q.query('SELECT * FROM invoices WHERE id=$1',[i.id]);
  if(!r||r.customer!==i.customer||r.reference!==i.reference||Number(r.amount)!==i.amount||r.currency!==i.currency||new Date(r.due_at).getTime()!==Date.parse(i.due))throw new Error('Conflicting duplicate invoice');
  await q.query("INSERT INTO jobs(id,invoice,run_at) VALUES($1,$2,$3::timestamptz + interval '14 days') ON CONFLICT DO NOTHING",['reminder:'+i.id,i.id,i.due]);
 });}
 async payment(p:Payment){amount(p.amount);code(p.currency);[p.id,p.customer,...p.refs].forEach(id);if(new Set(p.refs).size!==p.refs.length)throw new Error('Repeated reference');
 const fingerprint=createHash('sha256').update(JSON.stringify([p.customer,p.amount,p.currency,[...p.refs].sort()])).digest('hex');
 return this.db.tx(async q=>{
  await q.query('SELECT id FROM customers WHERE id=$1 FOR UPDATE',[p.customer]);
  await q.query('INSERT INTO bank_lines(id,customer,amount,currency,refs,fingerprint) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[p.id,p.customer,p.amount,p.currency,JSON.stringify(p.refs),fingerprint]);
  const [r]=await q.query('SELECT * FROM bank_lines WHERE id=$1',[p.id]);
  if(!r||r.fingerprint!==fingerprint)throw new Error('Conflicting duplicate statement ID');
  const dup=await q.query('SELECT id FROM bank_lines WHERE fingerprint=$1 AND id<>$2',[fingerprint,p.id]);
  if(dup.length)await q.query("INSERT INTO reviews VALUES($1,'possible duplicate content') ON CONFLICT DO NOTHING",[p.id]);
 });}
 async balance(invoice:string,q:Query=this.db){const [r]=await q.query('SELECT i.amount-COALESCE(SUM(a.amount),0) AS balance FROM invoices i LEFT JOIN allocations a ON a.invoice=i.id WHERE i.id=$1 GROUP BY i.id',[invoice]);if(!r)throw new Error('Unknown invoice');return Number(r.balance);}
 async reconcile(payment:string,failBeforeCommit=false){return this.db.tx(async q=>{
  // Global lock order prevents lost allocations when two bank lines target one invoice.
  await q.query('SELECT id FROM invoices ORDER BY id FOR UPDATE');
  const [p]=await q.query('SELECT * FROM bank_lines WHERE id=$1 FOR UPDATE',[payment]);if(!p)throw new Error('Unknown payment');if(p.reconciled)return;
  const review=async(reason:string)=>{await q.query('INSERT INTO reviews VALUES($1,$2) ON CONFLICT DO NOTHING',[payment,reason]);};
  const existing=await q.query('SELECT * FROM reviews WHERE payment=$1',[payment]);if(existing.length)return;
  const refs=p.refs as string[];
  if(!refs.length){await review('missing reference');return;}
  const invoices=[];
  for(const ref of refs){const rows=await q.query('SELECT * FROM invoices WHERE reference=$1 AND customer=$2',[ref,p.customer]);if(rows.length!==1){await review('wrong or ambiguous reference');return;}const i=rows[0]!;if(i.currency!==p.currency){await review('currency mismatch');return;}if(i.disputed){await review('disputed');return;}invoices.push(i);}
  let available=Number(p.amount);let total=0;
  for(const i of invoices)total+=await this.balance(i.id,q);
  if(Math.abs(available-total)>0&&Math.abs(available-total)<=2)await review('fee or rounding difference');
  for(const i of invoices){const used=Math.min(available,await this.balance(i.id,q));if(used>0){await q.query('INSERT INTO allocations VALUES($1,$2,$3)',[payment,i.id,used]);available-=used;}}
  if(available>0)await review('unapplied overpayment');
  if(failBeforeCommit)throw new Error('Simulated crash before checkpoint');
  await q.query('UPDATE bank_lines SET reconciled=true WHERE id=$1',[payment]);
 });}
 async dispute(invoice:string){await this.db.tx(async q=>{await q.query('SELECT id FROM invoices WHERE id=$1 FOR UPDATE',[invoice]);await q.query('UPDATE invoices SET disputed=true WHERE id=$1',[invoice]);await q.query('UPDATE outbox SET approved_by=NULL,approved_at=NULL WHERE id=$1',['reminder:'+invoice]);});}
 async work(now:string){
  const jobs=await this.db.query("SELECT id FROM jobs WHERE state='pending' AND run_at<=$1 ORDER BY id",[now]);
  for(const job of jobs)await this.db.tx(async q=>{
   const [pre]=await q.query('SELECT invoice FROM jobs WHERE id=$1',[job.id]);
   await q.query('SELECT id FROM invoices WHERE id=$1 FOR UPDATE',[pre!.invoice]);
   const [j]=await q.query("SELECT * FROM jobs WHERE id=$1 AND state='pending' FOR UPDATE",[job.id]);if(!j)return;
   const [i]=await q.query('SELECT i.*,c.late_count FROM invoices i JOIN customers c ON c.id=i.customer WHERE i.id=$1',[j.invoice]);
   const balance=await this.balance(j.invoice,q);
   if(i!.disputed||balance===0){await q.query("UPDATE jobs SET state='suppressed' WHERE id=$1",[j.id]);return;}
   const body=await this.provider.draft({reference:i!.reference,balance,currency:i!.currency,escalate:i!.late_count>=3});
   if(!body.trim()||body.length>10000)throw new Error('Invalid provider draft');
   await q.query('INSERT INTO outbox(id,body,balance) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[j.id,body,balance]);
   await q.query("INSERT INTO steps(job,name) VALUES($1,'drafted') ON CONFLICT DO NOTHING",[j.id]);
   await q.query("UPDATE jobs SET state='drafted' WHERE id=$1",[j.id]);
  });return jobs.length;
 }
 async edit(job:string,body:string){if(!body.trim()||body.length>10000)throw new Error('Invalid draft');await this.db.query('UPDATE outbox SET body=$2,approved_by=NULL,approved_at=NULL WHERE id=$1 AND delivered_at IS NULL',[job,body]);}
 async approve(job:string,actor:string){id(actor);return this.db.tx(async q=>{
  const [j]=await q.query('SELECT invoice FROM jobs WHERE id=$1',[job]);if(!j)throw new Error('Unknown job');
  const [i]=await q.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[j.invoice]);
  const [o]=await q.query('SELECT * FROM outbox WHERE id=$1 FOR UPDATE',[job]);
  if(!o||i!.disputed||await this.balance(j.invoice,q)!==Number(o.balance))throw new Error('Stale or disputed draft');
  await q.query('UPDATE outbox SET approved_by=$2,approved_at=now() WHERE id=$1',[job,actor]);
 });}
 async dispatch(job:string,dryRun=true,failBeforeCommit=false){return this.db.tx(async q=>{
  const [j]=await q.query('SELECT invoice FROM jobs WHERE id=$1',[job]);if(!j)throw new Error('Unknown job');
  const [i]=await q.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[j.invoice]);
  const [o]=await q.query('SELECT * FROM outbox WHERE id=$1 FOR UPDATE',[job]);
  if(!o?.approved_by)throw new Error('Approval required');
  const balance=await this.balance(j.invoice,q);
  if(i!.disputed||balance===0||balance!==Number(o.balance))throw new Error('Stale or disputed draft');
  if(dryRun)return 'dry-run';
  await q.query('INSERT INTO mailbox(id,body) VALUES($1,$2) ON CONFLICT DO NOTHING',[job,o.body]);
  if(failBeforeCommit)throw new Error('Simulated dispatch crash');
  await q.query('UPDATE outbox SET delivered_at=COALESCE(delivered_at,now()) WHERE id=$1',[job]);
  await q.query("INSERT INTO steps(job,name) VALUES($1,'delivered') ON CONFLICT DO NOTHING",[job]);return 'delivered';
 });}
}
