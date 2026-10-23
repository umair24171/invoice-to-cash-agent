import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { connect } from "../src/db.js";
import { migrate } from "../src/schema.js";
import { InvoiceAgent } from "../src/agent.js";
import { MockProvider } from "../src/provider.js";
test(
  "16 disk-backed PostgreSQL survives close and reopen with day-14 job",
  { skip: !!process.env.DATABASE_URL },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "invoice-db-"));
    process.env.PGLITE_PATH = dir;
    let db = await connect();
    try {
      await migrate(db);
      let a = new InvoiceAgent(db, new MockProvider());
      await a.customer("persist");
      await a.invoice({
        id: "persist",
        reference: "SYN-PERSIST",
        customer: "persist",
        amount: 100,
        currency: "USD",
        due: "2026-01-01Z",
      });
      await db.close();
      db = await connect();
      a = new InvoiceAgent(db, new MockProvider());
      await a.work("2026-01-15Z");
      assert.equal((await db.query("SELECT * FROM outbox")).length, 1);
    } finally {
      await db.close();
      delete process.env.PGLITE_PATH;
      await rm(dir, { recursive: true, force: true });
    }
  },
);
async function killWorker(kind: string) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/crash-worker.ts"],
    {
      env: { ...process.env, WORKER_KIND: kind },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      once(child, "message"),
      once(child, "exit").then(() => {
        throw new Error("Child exited before checkpoint");
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Child timeout")), 15000);
      }),
    ]);
    assert.deepEqual(ready[0], { ready: true });
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  } finally {
    if (timer) clearTimeout(timer);
    child.kill("SIGKILL");
  }
}
test(
  "16 native PostgreSQL resumes reconciliation after child SIGKILL mid-step",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = await connect();
    try {
      await migrate(db);
      const a = new InvoiceAgent(db, new MockProvider());
      await a.customer("kill-customer");
      await a.invoice({
        id: "kill-invoice",
        customer: "kill-customer",
        reference: "SYN-KILL",
        amount: 100,
        currency: "USD",
        due: "2026-01-01Z",
      });
      await a.payment({
        id: "kill-payment",
        customer: "kill-customer",
        amount: 40,
        currency: "USD",
        refs: ["SYN-KILL"],
      });
      await killWorker("reconcile");
      assert.equal(await a.balance("kill-invoice"), 100);
      assert.equal(
        (
          await db.query(
            "SELECT reconciled FROM bank_lines WHERE id='kill-payment'",
          )
        )[0]!.reconciled,
        false,
      );
      await a.reconcile("kill-payment");
      assert.equal(await a.balance("kill-invoice"), 60);
    } finally {
      await db.close();
    }
  },
);
test(
  "16 native PostgreSQL resumes reminder delivery after child SIGKILL",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = await connect();
    try {
      await migrate(db);
      const a = new InvoiceAgent(db, new MockProvider());
      await a.work("2026-01-15Z");
      await a.approve("reminder:kill-invoice", "synthetic-operator");
      await killWorker("dispatch");
      assert.equal(
        (
          await db.query(
            "SELECT * FROM mailbox WHERE id='reminder:kill-invoice'",
          )
        ).length,
        0,
      );
      await a.dispatch("reminder:kill-invoice", false);
      await a.dispatch("reminder:kill-invoice", false);
      assert.equal(
        (
          await db.query(
            "SELECT * FROM mailbox WHERE id='reminder:kill-invoice'",
          )
        ).length,
        1,
      );
    } finally {
      await db.close();
    }
  },
);
