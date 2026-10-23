# Invoice to cash agent

Synthetic portfolio project for BuildZn. Reconciles bank lines with explicitly referenced invoices, flags exceptions, checkpoints reminders, and requires operator approval before delivery to a transactional demo mailbox. No real messages or financial accounts.

```mermaid
flowchart TD
  A[Bank lines and invoices] --> B[Transactional reconciliation]
  B --> C[Allocations and review queue]
  C --> D[Persistent day-14 job]
  D --> E[Provider drafts reminder]
  E --> F[Operator approval]
  F --> G[Transactional demo mailbox]
```

## Run

Node 24 and Docker Compose required for the intended local path:

```sh
git clone https://github.com/umair24171/invoice-to-cash-agent.git
cd invoice-to-cash-agent
docker compose up -d db
npm ci
DATABASE_URL=postgres://portfolio:synthetic-local-only@localhost:55432/portfolio npm run demo
```

Alternatively `docker compose up --build --abort-on-container-exit --exit-code-from app` builds and runs the demo in containers. The fixed password is public synthetic local configuration, never a production credential. `docker compose down -v` deletes local demo data. Demo imports are idempotent and safe to repeat on their own database. Tests truncate tables; use a separate disposable database.

```sh
npm run build
DATABASE_URL=postgres://portfolio:synthetic-local-only@localhost:55432/portfolio npm test
npm run scan
```

For supplemental embedded PostgreSQL testing: `TEST_PGLITE=1 npm test` and `TEST_PGLITE=1 npm run demo`. This is not Docker verification.

## Results and limits

Initial embedded host run: 39 tests, 37 passed, zero failed, two native-only tests skipped. The native CI run below executed both SIGKILL cases and concurrency checks. Recorded native and Docker output is in docs/demo-output.md. TypeScript passed. Money is stored in integer minor units. References select allocations; no fuzzy automatic allocation or FX. Conservative duplicate-content detection may flag legitimate identical payments. Reconciliation locks all invoices to keep this small demonstration simple; this limits throughput. Failed jobs remain pending. `npm run worker` polls durable jobs every second and retries errors; it drafts only and never sends. Run it under a supervisor to resume after a host restart. Use LLM_PROVIDER=claude to opt in to paid drafting only when credentials and a model are supplied. Day-14 dates and checkpoint state persist in PostgreSQL. Claude drafting currently holds a database lock during its bounded request; a production implementation should lease jobs and generate outside the transaction with version checks.

Approval is a trusted local CLI operation. Editing or payment changes invalidate sending authorization. There is no public auth layer. The demo mailbox and checkpoint share a transaction, so retry never duplicates mailbox entries. This is not a claim of exactly-once email delivery. A real transport must offer durable idempotency. Dispute and delivery serialize on the invoice row; a dispute committed before dispatch blocks delivery.

Claude adapter is opt-in by constructing `ClaudeProvider`, with ANTHROPIC_API_KEY and CLAUDE_MODEL from the environment. Demo and CI use MockProvider. Provider text is untrusted, reviewable draft content only. No live API calls were tested. See docs/PLAN.md and docs/ASSUMPTIONS.md.

## Verified native CI

[Public source](https://github.com/umair24171/invoice-to-cash-agent) and [successful Actions run](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866), code commit `d3e973044a42f6f374a0f7a7882b49a0b5b1f09b`. Native PostgreSQL: 39 discovered, 38 passed, 1 environment-specific skipped, zero failed. Embedded complement: 37 passed, 2 environment-specific skipped, zero failed. All 39 distinct cases executed successfully in at least one appropriate environment. Docker Compose built and ran the demo from the runner’s fresh checkout. No hosting deployment. Real logs: docs/native-ci-output.txt.
