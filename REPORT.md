# BuildZn portfolio report

Built and verified as a synthetic portfolio showcase. Public source: https://github.com/umair24171/invoice-to-cash-agent. [Successful CI, native database tests and Docker demo](https://github.com/umair24171/invoice-to-cash-agent/actions/runs/40029159866), code `d3e973044a42f6f374a0f7a7882b49a0b5b1f09b`.

39 distinct tests: native PostgreSQL 38 passed, 1 environment-specific skipped; embedded complement 37 passed, 2 environment-specific skipped; zero failed. Every distinct case passed in at least one appropriate environment. Dependency install, formatting, TypeScript, configured full-history secret scan and fresh-checkout Docker demo passed. Real output is in docs/native-ci-output.txt and docs/demo-output.md. No live Claude calls, real customer data, messaging or hosting.

Implementation scope, data model and edge-case contract are in docs/PLAN.md. Policy/identity/transport assumptions and MIT license choice are in docs/ASSUMPTIONS.md. README describes architecture and the remaining production limitations. Initial authoring-host and publishing blockers were resolved by signed-in GitHub creation, narrowly scoped connector access and hosted Actions. No credential was created or printed.

BuildZn site portfolio pages and combined PR report follow after all four projects meet their gates. No merge or deployment is authorized.
