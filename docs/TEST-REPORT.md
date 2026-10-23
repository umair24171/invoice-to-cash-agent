# Test report

All data synthetic. [Successful native CI and Docker run](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866), verified code commit `d3e973044a42f6f374a0f7a7882b49a0b5b1f09b`. Complete actual stdout: docs/native-ci-output.txt.

| Environment                    | Discovered | Passed | Failed | Skipped |
| ------------------------------ | ---------: | -----: | -----: | ------: |
| PostgreSQL service             |         39 |     38 |      0 |       1 |
| Embedded PostgreSQL complement |         39 |     37 |      0 |       2 |

All 39 distinct cases passed in at least one appropriate environment. The native SIGKILL reconciliation and delivery checks both executed and passed. Only the embedded disk-reopen test skips on native PostgreSQL; it passed in the embedded complement.

Dependency install, formatting, TypeScript, native database tests, embedded complement, configured full-history secret scan, native demo and Docker Compose build/demo passed. Docker ran from a fresh Actions checkout and isolated volume, with no deployment. Earlier fresh local-clone evidence remains in docs/clean-clone-output.txt. Live Claude requests were not made. There are no real customer fixtures.

Known platform-specific assertion/implementation fixes are in PROGRESS.md and history. No test was deleted or weakened: the invoice IPC correction inspects the readiness payload rather than an unrelated optional transport-handle argument.
