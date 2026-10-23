# Invoice to cash agent plan

## Scope
Reconcile explicit invoice references against synthetic bank lines, conserve amounts, show exceptions, draft and approve reminders, then dispatch through a transactional local mailbox. Persist reminders and step checkpoints in PostgreSQL. Support retries and crashes without duplicate allocation or delivery.

## Data model
Customers with late-payment history; invoices with due date and dispute state; bank lines with immutable source IDs; allocations joining payments and invoices; reconciliation review records; durable jobs with run time; approved outbox drafts; transactional mailbox; step events. Unique keys protect imports, allocations, job creation and delivery.

## Tools
TypeScript CLI, pg, PostgreSQL 16, Docker Compose, Claude Messages HTTP adapter behind a provider interface, deterministic mock, Node test runner, PGlite for supplemental host tests, GitHub Actions PostgreSQL service. No paid calls in demo or tests.

## Edge cases and test contract
1. Partial payment leaves balance and reminder.
2. Overpayment preserves unapplied remainder.
3. One payment covers multiple explicitly referenced invoices.
4. Multiple payments settle one invoice.
5. Duplicate bank IDs are idempotent; conflicting IDs rejected; duplicate content flagged.
6. Duplicate invoices are idempotent; conflicting payload rejected.
7. Missing, wrong, mixed-owner or ambiguous references go to review.
8. Fees and rounding differences flagged without writeoff.
9. Currency mismatch allocates nothing.
10. A dispute during workflow blocks approval and dispatch.
11. Process failure before checkpoint rolls back; worker restarts from persisted job.
12. Reminder dispatched once under retries and concurrent workers.
13. Approval required, dry run sends nothing, full payment blocks dispatch.
14. Invalid and unsafe monetary input rejected; provider failure does not create approval.
15. Changed draft invalidates approval; overdue-history escalation uses stored history.
16. Day-14 job survives database close and reopen; a child worker killed mid-transaction leaves no partial allocation.

Each numbered requirement maps to named tests in tests. Native PostgreSQL-only process/concurrency checks must not be described as locally passed if the host cannot run them.
