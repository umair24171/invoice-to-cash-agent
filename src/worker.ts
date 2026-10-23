import { connect } from "./db.js";
import { migrate } from "./schema.js";
import { InvoiceAgent } from "./agent.js";
import { MockProvider, ClaudeProvider } from "./provider.js";
const db = await connect();
await migrate(db);
const provider =
  process.env.LLM_PROVIDER === "claude"
    ? new ClaudeProvider()
    : new MockProvider();
const a = new InvoiceAgent(db, provider);
let stop = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stop = true;
  });
console.log(
  "Draft worker started. Outgoing delivery still requires explicit approval and dispatch.",
);
try {
  while (!stop) {
    try {
      await a.work(new Date().toISOString());
    } catch (e) {
      console.error(
        "Worker iteration failed; durable pending jobs will retry.",
        e instanceof Error ? e.message : "unknown error",
      );
    }
    if (!stop) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  await db.close();
}
