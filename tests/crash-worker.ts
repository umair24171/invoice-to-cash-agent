import { connect } from "../src/db.js";
import { InvoiceAgent } from "../src/agent.js";
import { MockProvider } from "../src/provider.js";
const db = await connect();
const a = new InvoiceAgent(db, new MockProvider());
const pause = async () => {
  process.send?.({ ready: true });
  await new Promise<void>(() => {});
};
if (process.env.WORKER_KIND === "reconcile")
  await a.reconcile("kill-payment", false, pause);
else await a.dispatch("reminder:kill-invoice", false, false, pause);
