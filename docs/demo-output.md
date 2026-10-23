# Recorded native and Docker demo output

All data synthetic. [Verified Actions run](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866). No hosting deployment.

## Native PostgreSQL demo

```text
##[group]Run npm run demo
npm run demo
shell: /usr/bin/bash -e {0}
env:
  DATABASE_URL: ***localhost:5432/portfolio
##[endgroup]

> buildzn-invoice-to-cash-agent@0.1.0 demo
> node --import tsx src/demo.ts

All data synthetic. Transport: transactional demo mailbox.
Invoice 10000 USD minor units. Partial payment 4000. Remaining: 6000
Dry run: dry-run
Approved delivery: delivered
Retry: delivered
Mailbox records: 1
Persisted steps: [
  { job: 'reminder:demo-invoice', name: 'delivered' },
  { job: 'reminder:demo-invoice', name: 'drafted' },
  { job: 'reminder:demo-invoice', name: 'escalated' }
]
```

## Docker Compose demo

```text
app-1  |
app-1  | > buildzn-invoice-to-cash-agent@0.1.0 demo
app-1  | > node --import tsx src/demo.ts
app-1  |
app-1  | All data synthetic. Transport: transactional demo mailbox.
app-1  | Invoice 10000 USD minor units. Partial payment 4000. Remaining: 6000
app-1  | Dry run: dry-run
app-1  | Approved delivery: delivered
app-1  | Retry: delivered
app-1  | Mailbox records: 1
app-1  | Persisted steps: [
app-1  |   { job: 'reminder:demo-invoice', name: 'delivered' },
app-1  |   { job: 'reminder:demo-invoice', name: 'drafted' },
app-1  |   { job: 'reminder:demo-invoice', name: 'escalated' }
app-1  | ]
```
