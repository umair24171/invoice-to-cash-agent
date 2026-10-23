# Test report

All fixtures and data are synthetic. Host: Node 24.19.0, TypeScript 5.9.3, PGlite 0.3.14 (embedded PostgreSQL).

Actual commands: `npm run build`, `TEST_PGLITE=1 npm test`, `TEST_PGLITE=1 npm run demo`.

| Check                     | Result                                         |
| ------------------------- | ---------------------------------------------- |
| TypeScript                | Passed                                         |
| Tests discovered          | 39                                             |
| Passed                    | 37                                             |
| Failed                    | 0                                              |
| Skipped                   | 2                                              |
| Demo on embedded engine   | Passed                                         |
| Fresh local clone         | See docs/clean-clone-output.txt once available |
| Native PostgreSQL service | Not run                                        |
| Docker Compose demo       | Not run                                        |
| GitHub Actions            | Not run, no remote repository                  |
| Live Claude API           | Not run, no paid calls                         |

Tests include unit checks, database integration and adversarial cases. The numbered test names map to the written edge cases in docs/PLAN.md. Full stdout is in docs/test-output.txt. Embedded transactions serialize, so local concurrent-call tests do not prove native lock behavior. Two true SIGKILL workflow tests are explicitly skipped here and configured to run against the native CI service.

No tests were deleted or weakened to pass. Assertion normalization, implementation fixes and runtime runner fixes are described in PROGRESS.md and README.md. Source/policy fixture review found no real customer data. A configured credential-pattern scan includes tracked files and historical blobs; it is not a guarantee that all possible secrets are detectable.

Fresh local git clone verified: npm ci, formatting, TypeScript, embedded PostgreSQL tests and demo passed. Working tree remained clean. Evidence: docs/clean-clone-output.txt. Native Docker and GitHub Actions gates remain unverified.
