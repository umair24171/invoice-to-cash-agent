# Recorded demo output

All data synthetic. Cloud command: `TEST_PGLITE=1 npm run demo`. This is a real embedded PostgreSQL run, not native Docker evidence.

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

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
  { job: 'reminder:demo-invoice', name: 'drafted' }
]
```
