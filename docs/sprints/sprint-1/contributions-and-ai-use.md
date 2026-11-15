# Contribution table, AI-use declaration and known limitations (Sprint 1)

## Contribution table

Built from the real Issues and pull requests. Both students took part in every area: one led the work and the other took part in the decisions and reviewed, tested and verified it. Commit counts are not equal; the review history is in the pull requests.

| Item | Student 1: Thanwarat Chantana, 670701025, Thanwarat1303 | Student 2: Aphisaimai, 67070501077, mxckiexz | Evidence |
|---|---|---|---|
| SRS and decisions | Took part in the requirements and design decisions; reviewed the SRS and decision log in PR #21. | Led and wrote the SRS and the decision log (D-01 to D-12). | PR #21 |
| Feature inventory and traceability | Took part in the scope decisions; checked the features, acceptance criteria and traceability in PR #21. | Led and wrote the feature inventory and the traceability table. | PR #21 |
| System SDS | Reviewed the SDS against the SRS and the feature contracts in PR #21. | Led and wrote the system SDS (roles, permissions, data, security). | PR #21 |
| Feature contracts and STS | Checked acceptance criteria, authorization and negative cases of the contracts before the code was written. | Led and wrote the contracts F-01 to F-05 and Q-01 and the software test specification. | PR #21 |
| F-01 implementation and review | Reviewed PR #22: password hashing, session creation and invalidation after logout or deactivation, safe errors. | Implemented authentication, sessions, health route and seed, tests first. | PR #22, Issue #14 |
| F-02 implementation and review | Reviewed PR #23 against AC-13 to AC-23: ownership, server-calculated totals, request numbers. | Implemented create, edit and submit with validation, tests first. | PR #23, Issue #15 |
| F-03 implementation and review | Reviewed PR #24: server-side approval and rejection behavior; checked self-approval and negative cases. | Implemented approve and reject with the concurrency rule, tests first. | PR #24, Issue #16 |
| F-04 implementation and review | Reviewed PR #25 against AC-33 to AC-38: owner scope, review queue for approvers, administrator scope. | Implemented lists, detail, history and visibility rules, tests first. | PR #25, Issue #17 |
| F-05 implementation and review | Reviewed PR #26 against AC-39 to AC-44: administrator-only routes, no password hash in responses, self-change rule, session of an inactive user. | Implemented administrator user management, tests first. | PR #26, Issue #18 |
| UI | Reviewed PR #27 against AC-12, AC-23, AC-32, AC-38 and AC-44; inspected the screens and the responsive evidence. | Implemented the React screens for the three roles. | PR #27, Issue #19 |
| Browser tests | Ran the test suites and builds; checked the journeys and the evidence pictures. | Wrote the Playwright journeys, accessibility checks and the evidence generator. | PR #27, PR #28 |
| Quality checks | Reviewed PR #28; requested two fixes (results table missing TEST-80 to TEST-92; TEST-81 did not exercise approve) and verified them. | Wrote the security, accessibility, layout, performance and regression checks; made the two fixes. | PR #28, Issue #20 |
| Planning, board and release | Took part in planning and AI supervision; reviewed and merged PR #21 to #28; reviewed the release PR #29 and requested the metadata corrections. | Took part in planning and AI supervision; prepared the Issues, the board, the results, the PDF and the release PR #29. | PR #29 |

Aphisaimai led the implementation of the SRS, feature contracts, backend and API, database, UI, browser tests and quality checks. Thanwarat took part in the requirements and design decisions, reviewed every feature pull request, checked the implementation against the lab sheet and the acceptance criteria, verified authorization and negative cases, ran tests and builds, inspected the UI and the responsive evidence, and requested and verified fixes. Both students contributed to planning, testing, review, AI supervision and final release preparation.

## How the branches are organised

The features depend on each other, so the feature branches were built one on top of the other (each starts from the previous one) instead of each starting from the staging tip. Every pull request targets `sprint-1/staging` and they are merged in order with merge commits, so after each merge the next pull request shows only its own commits. The first pull request carries the version 2.0 documents, which were written before any code.

## AI-use declaration

An AI coding assistant (Claude Code) was used to help with: turning the team's proposal into the SRS, SDS and feature contracts; writing the tests first and the implementation of F-01 to F-05; writing the React screens, the browser tests and the security, accessibility and performance checks; running the suites and building the results table and the PDF. The students supplied the proposal and the decisions listed in the SRS, read the generated code and documents, and are responsible for them. Both students supervised the use of the assistant: they set the requirements and decisions, read and checked the generated code, documents and tests, ran the suites, and requested and verified fixes in the reviews. Test results in this submission come from the commands recorded in `results.md`, not from a statement by the assistant.

## Known limitations and incomplete work

- Sprint 2 and Sprint 3 features (FR-05, FR-17 to FR-28, BR-19, BR-20, NFR-12 formal measurement) are planned and not implemented. The status CANCELLED exists but nothing sets it yet.
- There are no attachments or comments, and a request has one item only.
- The UI has no pagination; lists show every request of the user.
- The estimate on the form is a hint calculated in the browser; the server total is the real one.
- A deactivated user keeps their old requests; the administrator cannot reset passwords (not in Sprint 1).
- Accessibility is checked only by automated rules (axe-core), keyboard and three-width tests; there is no screen reader or user test. Other limits (no login rate limiting, no real load test, no professional penetration test, no UAT yet) are in `docs/qa-defect-log.md`.
- Docker, CI and GCP deployment are not part of Deliverable 1 (Lab 5).
- Pull request reviews, Issues and the final board status are produced on GitHub by the two students; this repository's local history shows the commit order only.
