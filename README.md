# Work in progress: Invoice to cash agent

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
git clone <repository-url>
cd invoice-to-cash-agent
docker compose up -d db
npm ci
DATABASE_URL=postgres://portfolio:synthetic-local-only@localhost:5432/portfolio npm run demo
```

Alternatively `docker compose up --build --abort-on-container-exit --exit-code-from app` builds and runs the demo in containers. The fixed password is public synthetic local configuration, never a production credential. `docker compose down -v` deletes local demo data. Demo imports are idempotent and safe to repeat on their own database. Tests truncate tables; use a separate disposable database.

```sh
npm run build
DATABASE_URL=postgres://portfolio:synthetic-local-only@localhost:5432/portfolio npm test
npm run scan
```

For supplemental embedded PostgreSQL testing: `TEST_PGLITE=1 npm test` and `TEST_PGLITE=1 npm run demo`. This is not Docker verification.

## Results and limits
Cloud run: 38 tests, 37 passed, zero failed, one skipped native PostgreSQL SIGKILL test. TypeScript check passed. Real embedded-engine demo output is in docs/demo-output.md. Concurrent tests execute but embedded transactions serialize; native Postgres lock behavior remains a CI check. Native Postgres CI and Docker clean-clone demo have not run. Public repository creation is blocked by missing capability and credentials; see docs/BLOCKERS.md.

Money is stored in integer minor units. References select allocations; no fuzzy automatic allocation or FX. Conservative duplicate-content detection may flag legitimate identical payments. Reconciliation locks all invoices to keep this small demonstration simple; this limits throughput. Failed jobs remain pending and require another worker invocation; this CLI does not include an always-running scheduler process. Poll `work(now)` from your own supervisor for production. Day-14 dates and checkpoint state persist in PostgreSQL. Claude drafting currently holds a database lock during its bounded request; a production implementation should lease jobs and generate outside the transaction with version checks.

Approval is a trusted local CLI operation. Editing or payment changes invalidate sending authorization. There is no public auth layer. The demo mailbox and checkpoint share a transaction, so retry never duplicates mailbox entries. This is not a claim of exactly-once email delivery. A real transport must offer durable idempotency. Dispute and delivery serialize on the invoice row; a dispute committed before dispatch blocks delivery.

Claude adapter is opt-in by constructing `ClaudeProvider`, with ANTHROPIC_API_KEY and CLAUDE_MODEL from the environment. Demo and CI use MockProvider. Provider text is untrusted, reviewable draft content only. No live API calls were tested. See docs/PLAN.md and docs/ASSUMPTIONS.md.
