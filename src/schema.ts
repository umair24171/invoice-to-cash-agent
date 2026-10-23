import type { Query } from "./db.js";
export async function migrate(db: Query) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS customers(id text PRIMARY KEY, late_count integer NOT NULL DEFAULT 0 CHECK(late_count>=0))`,
    `CREATE TABLE IF NOT EXISTS invoices(id text PRIMARY KEY, customer text NOT NULL REFERENCES customers(id), reference text NOT NULL, amount bigint NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), due_at timestamptz NOT NULL, disputed boolean NOT NULL DEFAULT false, UNIQUE(customer,reference))`,
    `CREATE TABLE IF NOT EXISTS bank_lines(id text PRIMARY KEY, customer text NOT NULL REFERENCES customers(id), amount bigint NOT NULL CHECK(amount>0), currency text NOT NULL, refs jsonb NOT NULL, fingerprint text NOT NULL, reconciled boolean NOT NULL DEFAULT false)`,
    `CREATE TABLE IF NOT EXISTS allocations(payment text REFERENCES bank_lines(id), invoice text REFERENCES invoices(id), amount bigint NOT NULL CHECK(amount>0), PRIMARY KEY(payment,invoice))`,
    `CREATE TABLE IF NOT EXISTS reviews(payment text REFERENCES bank_lines(id), reason text NOT NULL, PRIMARY KEY(payment,reason))`,
    `CREATE TABLE IF NOT EXISTS jobs(id text PRIMARY KEY, invoice text UNIQUE NOT NULL REFERENCES invoices(id), run_at timestamptz NOT NULL, escalated boolean NOT NULL DEFAULT false, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','drafted','suppressed')))`,
    `CREATE TABLE IF NOT EXISTS outbox(id text PRIMARY KEY REFERENCES jobs(id), body text NOT NULL, balance bigint NOT NULL, approved_by text, approved_at timestamptz, delivered_at timestamptz)`,
    `CREATE TABLE IF NOT EXISTS mailbox(id text PRIMARY KEY REFERENCES outbox(id), body text NOT NULL, received_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS steps(job text REFERENCES jobs(id), name text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(job,name))`,
  ];
  for (const s of statements) await db.query(s);
}
