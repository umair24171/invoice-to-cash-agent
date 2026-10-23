# BuildZn portfolio report

Built and verified as a synthetic portfolio showcase. Public source: https://github.com/umair24171/invoice-to-cash-agent. [Successful CI, native database tests and Docker demo](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866), code `d3e973044a42f6f374a0f7a7882b49a0b5b1f09b`.

39 distinct tests: native PostgreSQL 38 passed, 1 environment-specific skipped; embedded complement 37 passed, 2 environment-specific skipped; zero failed. Every distinct case passed in at least one appropriate environment. Dependency install, formatting, TypeScript, configured full-history secret scan and fresh-checkout Docker demo passed. Real output is in docs/native-ci-output.txt and docs/demo-output.md. No live Claude calls, real customer data, messaging or hosting.

Implementation scope, data model and edge-case contract are in docs/PLAN.md. Policy/identity/transport assumptions and MIT license choice are in docs/ASSUMPTIONS.md. README describes architecture and the remaining production limitations. Initial authoring-host and publishing blockers were resolved by signed-in GitHub creation, narrowly scoped connector access and hosted Actions. No credential was created or printed.

Portfolio pages and the combined website report are in [BuildZn PR #24](https://github.com/umair24171/dev_umair/pull/24). It is open and unmerged. Website validation status and its existing-test limitations are tracked in the PR description. No deployment or merge was performed.

## Complete project set

| Project and source                                                                                   | Distinct cases | Native passed / skipped | Embedded passed / skipped | CI and Docker                                                                                      |
| ---------------------------------------------------------------------------------------------------- | -------------: | ----------------------: | ------------------------: | -------------------------------------------------------------------------------------------------- |
| [Invoice to cash agent](https://github.com/umair24171/invoice-to-cash-agent)                         |             39 |                  38 / 1 |                    37 / 2 | [Passed](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866)             |
| [Support resolution agent](https://github.com/umair24171/support-resolution-agent)                   |             35 |                  35 / 0 |                    35 / 0 | [Passed](https://github.com/umair24171/support-resolution-agent/actions/runs/40030071043)          |
| [Permission aware knowledge search](https://github.com/umair24171/permission-aware-knowledge-search) |             24 |                  24 / 0 |                    24 / 0 | [Passed](https://github.com/umair24171/permission-aware-knowledge-search/actions/runs/40030755414) |
| [Sales call to CRM sync](https://github.com/umair24171/sales-call-to-crm-sync)                       |             30 |                  30 / 0 |                    30 / 0 | [Passed](https://github.com/umair24171/sales-call-to-crm-sync/actions/runs/40031451224)            |

- Invoice to cash agent: Match synthetic invoices and bank lines, retain exceptions, and prepare reminders that require approval.
- Support resolution agent: Resolve synthetic store tickets with guarded refund, address-change and reschedule tools.
- Permission aware knowledge search: Apply current source permissions inside the pgvector query before returning document chunks.
- Sales call to CRM sync: Turn synthetic transcripts into grounded CRM diffs and follow-up drafts, with approval required for every write.

Across the four projects, all 128 distinct cases passed in at least one appropriate environment. Native PostgreSQL passed 127 and skipped the one embedded-only case; the embedded complement passed 126 and skipped the two native-only process-kill cases. Zero failures in the linked verified runs. All four Docker demos ran from fresh checkouts. Data and fixtures are synthetic; live Claude quality and production transport/connector/authentication guarantees remain outside scope. See each repository's README and assumptions.
