import { connect } from "./db.js";
import { migrate } from "./schema.js";
import { InvoiceAgent } from "./agent.js";
import { MockProvider } from "./provider.js";
const db = await connect();
try {
  await migrate(db);
  const a = new InvoiceAgent(db, new MockProvider());
  await a.customer("synthetic-acme", 3);
  await a.invoice({
    id: "demo-invoice",
    customer: "synthetic-acme",
    reference: "SYN-100",
    amount: 10000,
    currency: "USD",
    due: "2026-01-01T00:00:00Z",
  });
  await a.payment({
    id: "demo-bank-line",
    customer: "synthetic-acme",
    amount: 4000,
    currency: "USD",
    refs: ["SYN-100"],
  });
  await a.reconcile("demo-bank-line");
  console.log("All data synthetic. Transport: transactional demo mailbox.");
  console.log(
    "Invoice 10000 USD minor units. Partial payment 4000. Remaining:",
    await a.balance("demo-invoice"),
  );
  await a.work("2026-01-15T00:00:00Z");
  const job = "reminder:demo-invoice";
  await a.approve(job, "synthetic-demo-operator");
  console.log("Dry run:", await a.dispatch(job));
  console.log("Approved delivery:", await a.dispatch(job, false));
  console.log("Retry:", await a.dispatch(job, false));
  console.log(
    "Mailbox records:",
    (
      await db.query("SELECT id,body FROM mailbox WHERE id=$1 ORDER BY id", [
        job,
      ])
    ).length,
  );
  console.log(
    "Persisted steps:",
    await db.query(
      "SELECT job,name FROM steps WHERE job=$1 ORDER BY job,name",
      [job],
    ),
  );
} finally {
  await db.close();
}
