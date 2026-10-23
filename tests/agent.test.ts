import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connect, type Database } from "../src/db.js";
import { migrate } from "../src/schema.js";
import { InvoiceAgent, type Payment } from "../src/agent.js";
import { MockProvider, ClaudeProvider } from "../src/provider.js";
let db: Database;
let a: InvoiceAgent;
const due = "2026-01-01T00:00:00Z",
  now = "2026-01-15T00:00:00Z",
  job = "reminder:i1";
before(async () => {
  db = await connect();
  await migrate(db);
});
after(async () => db.close());
beforeEach(async () => {
  await db.query(
    "TRUNCATE steps,mailbox,outbox,jobs,reviews,allocations,bank_lines,invoices,customers CASCADE",
  );
  a = new InvoiceAgent(db, new MockProvider());
  await a.customer("c1", 3);
  await a.customer("c2");
  await invoice();
});
async function invoice(
  id = "i1",
  reference = "INV-1",
  amount = 10000,
  customer = "c1",
  currency = "USD",
) {
  await a.invoice({ id, reference, amount, customer, currency, due });
}
async function payment(
  amount: number,
  id = "p1",
  refs = ["INV-1"],
  customer = "c1",
  currency = "USD",
) {
  const p: Payment = { id, customer, amount, currency, refs };
  await a.payment(p);
  await a.reconcile(id);
}
async function drafted() {
  await a.work(now);
}
async function approved() {
  await drafted();
  await a.approve(job, "synthetic-operator");
}
async function count(table: string) {
  return Number((await db.query(`SELECT COUNT(*) AS n FROM ${table}`))[0]!.n);
}
test("01 partial payment leaves exact balance and reminder", async () => {
  await payment(4000);
  assert.equal(await a.balance("i1"), 6000);
  await drafted();
  assert.equal(
    Number((await db.query("SELECT balance FROM outbox"))[0]!.balance),
    6000,
  );
});
test("02 overpayment is conserved as unapplied review", async () => {
  await payment(12000);
  assert.equal(await a.balance("i1"), 0);
  assert.equal(
    Number((await db.query("SELECT SUM(amount) AS n FROM allocations"))[0]!.n),
    10000,
  );
  assert.match(
    JSON.stringify(await db.query("SELECT * FROM reviews")),
    /overpayment/,
  );
});
test("03 one line covers several invoices in explicit reference order", async () => {
  await invoice("i2", "INV-2", 5000);
  await payment(15000, "p1", ["INV-1", "INV-2"]);
  assert.equal(await a.balance("i1"), 0);
  assert.equal(await a.balance("i2"), 0);
});
test("04 several payments settle one invoice", async () => {
  await payment(3000);
  await payment(7000, "p2");
  assert.equal(await a.balance("i1"), 0);
});
test("05 duplicate statement ID allocates once", async () => {
  await payment(4000);
  await payment(4000);
  assert.equal(await count("allocations"), 1);
  assert.equal(await a.balance("i1"), 6000);
});
test("05 conflicting bank ID rejected", async () => {
  await payment(4000);
  await assert.rejects(payment(5000), /Conflicting/);
});
test("05 same content under different source ID quarantined", async () => {
  await payment(4000);
  await payment(4000, "p2");
  assert.equal(await a.balance("i1"), 6000);
  assert.match(
    JSON.stringify(await db.query("SELECT * FROM reviews")),
    /duplicate/,
  );
});
test("06 duplicate invoice imports once and conflicting amount rejected", async () => {
  await invoice();
  assert.equal(await count("invoices"), 1);
  await assert.rejects(invoice("i1", "INV-1", 20000), /Conflicting/);
  await assert.rejects(invoice("i2", "INV-1"), /Conflicting/);
});
for (const refs of [[], ["WRONG"], ["INV-1", "WRONG"]])
  test(`07 references ${JSON.stringify(refs)} allocate nothing`, async () => {
    await payment(10000, "p1", refs);
    assert.equal(await count("allocations"), 0);
    assert.equal(await count("reviews"), 1);
  });
test("07 reference owned by another customer allocates nothing", async () => {
  await payment(10000, "p1", ["INV-1"], "c2");
  assert.equal(await count("allocations"), 0);
});
test("07 SQL injection is treated as a literal reference", async () => {
  await payment(10000, "p1", ["INV-1' OR 1=1 --"]);
  assert.equal(await count("allocations"), 0);
  assert.equal(await count("invoices"), 1);
});
test("08 fees and rounding flagged without hidden writeoff", async () => {
  await payment(9999);
  assert.equal(await a.balance("i1"), 1);
  assert.match(
    JSON.stringify(await db.query("SELECT * FROM reviews")),
    /rounding/,
  );
});
test("09 currency mismatch refuses allocation", async () => {
  await payment(10000, "p1", ["INV-1"], "c1", "EUR");
  assert.equal(await a.balance("i1"), 10000);
  assert.match(
    JSON.stringify(await db.query("SELECT * FROM reviews")),
    /currency/,
  );
});
test("10 dispute after approval suppresses send", async () => {
  await approved();
  await a.dispute("i1");
  await assert.rejects(a.dispatch(job, false));
  assert.equal(await count("mailbox"), 0);
});
test("10 dispute before drafting suppresses workflow", async () => {
  await a.dispute("i1");
  await drafted();
  assert.equal(await count("outbox"), 0);
  assert.equal(
    (await db.query("SELECT state FROM jobs"))[0]!.state,
    "suppressed",
  );
});
test("11 reconcile crash rolls back allocation and checkpoint then resumes", async () => {
  await a.payment({
    id: "p1",
    customer: "c1",
    amount: 4000,
    currency: "USD",
    refs: ["INV-1"],
  });
  await assert.rejects(a.reconcile("p1", true));
  assert.equal(await count("allocations"), 0);
  assert.equal(
    (await db.query("SELECT reconciled FROM bank_lines"))[0]!.reconciled,
    false,
  );
  await a.reconcile("p1");
  assert.equal(await a.balance("i1"), 6000);
});
test("11 dispatch crash rolls back mailbox and retries safely", async () => {
  await approved();
  await assert.rejects(a.dispatch(job, false, true));
  assert.equal(await count("mailbox"), 0);
  await a.dispatch(job, false);
  assert.equal(await count("mailbox"), 1);
});
test("12 dispatch and worker retries do not duplicate reminders", async () => {
  await approved();
  await drafted();
  await a.dispatch(job, false);
  await a.dispatch(job, false);
  assert.equal(await count("mailbox"), 1);
  assert.equal(await count("outbox"), 1);
  assert.equal(await count("steps"), 3);
});
test("12 concurrent dispatchers serialize delivery", async () => {
  await approved();
  await Promise.all([
    a.dispatch(job, false),
    a.dispatch(job, false),
    a.dispatch(job, false),
  ]);
  assert.equal(await count("mailbox"), 1);
});
test("13 approval required; dry run has no mailbox effect", async () => {
  await drafted();
  await assert.rejects(a.dispatch(job, false), /Approval/);
  await a.approve(job, "synthetic-operator");
  assert.equal(await a.dispatch(job), "dry-run");
  assert.equal(await count("mailbox"), 0);
});
test("13 full settlement blocks previously approved reminder", async () => {
  await approved();
  await payment(10000);
  await assert.rejects(a.dispatch(job, false), /Stale/);
  assert.equal(await count("mailbox"), 0);
});
for (const n of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
  test(`14 unsafe amount ${n} rejected`, async () => {
    await assert.rejects(invoice("bad", "BAD", n));
    await assert.rejects(payment(n));
  });
test("14 provider failure leaves pending retry with no draft or approval", async () => {
  a = new InvoiceAgent(db, {
    draft: async () => {
      throw new Error("timeout");
    },
  });
  await assert.rejects(drafted(), /timeout/);
  assert.equal(await count("outbox"), 0);
  assert.equal((await db.query("SELECT state FROM jobs"))[0]!.state, "pending");
});
test("14 Claude configuration fails closed without credentials", async () => {
  await assert.rejects(
    new ClaudeProvider("", "").draft({
      reference: "x",
      balance: 1,
      currency: "USD",
      escalate: false,
    }),
    /required/,
  );
});
test("15 editing a draft invalidates approval", async () => {
  await approved();
  await a.edit(job, "Updated synthetic draft");
  await assert.rejects(a.dispatch(job, false), /Approval/);
});
test("15 customer history escalates draft; day 14 is not early", async () => {
  await a.work("2026-01-14T23:59:59Z");
  assert.equal(await count("outbox"), 0);
  await drafted();
  assert.match(
    (await db.query("SELECT body FROM outbox"))[0]!.body,
    /human account review/,
  );
  assert.equal(
    (await db.query("SELECT escalated FROM jobs"))[0]!.escalated,
    true,
  );
});
test("15 partial payment after approval invalidates stale amount", async () => {
  await approved();
  await payment(1000);
  await assert.rejects(a.dispatch(job, false), /Stale/);
});
test("16 reconnect preserves scheduled day-14 job", async () => {
  if (process.env.TEST_PGLITE === "1") {
    // Memory host engine cannot reopen; durable case has its own disk-backed test.
    assert.equal(
      new Date(
        (await db.query("SELECT run_at FROM jobs"))[0]!.run_at,
      ).toISOString(),
      new Date(now).toISOString(),
    );
    return;
  }
  await db.close();
  db = await connect();
  a = new InvoiceAgent(db, new MockProvider());
  await drafted();
  assert.equal(await count("outbox"), 1);
});
test("12 concurrent payments never overallocate an invoice", async () => {
  await a.payment({
    id: "x1",
    customer: "c1",
    amount: 7000,
    currency: "USD",
    refs: ["INV-1"],
  });
  await a.payment({
    id: "x2",
    customer: "c1",
    amount: 6000,
    currency: "USD",
    refs: ["INV-1"],
  });
  await Promise.all([a.reconcile("x1"), a.reconcile("x2")]);
  assert.equal(await a.balance("i1"), 0);
  assert.equal(
    Number((await db.query("SELECT SUM(amount) AS n FROM allocations"))[0]!.n),
    10000,
  );
});
