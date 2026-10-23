# Assumptions

All fixtures are synthetic. GitHub owner is umair24171 and site is umair24171/dev_umair, verified through the GitHub connector. No hosting deployment is authorized.

CLI only; no UI. Currency amounts use integer minor units. No currency conversion. References must identify invoices from the same customer and currency; ambiguous matches go to review. Fees up to two minor units are flagged, never silently forgiven. Bank transaction identity is the source transaction ID; duplicate content under another ID is flagged. Invoice identity is supplier/customer/reference plus immutable amount and currency; conflicting duplicates are rejected.

Day 14 means fourteen UTC days after the invoice due date. Disputes suppress reminders. An operator identity is supplied by the local trusted CLI, not internet authentication. This is a showcase, not an exposed multi-user service.

Exactly-once external delivery needs a transport with idempotency support. The demonstration uses a Postgres mailbox whose delivery and workflow checkpoint commit atomically. No real mail transport is included. Dry run never writes to that mailbox. Claude drafts text only and cannot authorize or send.

The authoring host lacks Docker and native Postgres, so local supplemental tests use PGlite. Native PostgreSQL and Docker were separately verified on GitHub-hosted Actions; docs/TEST-REPORT.md distinguishes both environments.

Source code is provided under the MIT license. Public repository names and topics are proposed until GitHub creation succeeds.
