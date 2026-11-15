# PurchaseFlow Product Definition of Done (Sprint 1)

A Sprint 1 feature is done only when all of these are true and the evidence is recorded.

| # | Criterion | Evidence required |
|---|---|---|
| 1 | The behavior in the feature contract is implemented. | Demonstration by running the feature; the code on the feature branch |
| 2 | Every acceptance criterion of the feature has a planned test, and each planned test has been executed. | Results table in `docs/sprints/sprint-1/results.md` with the test file, test name and result |
| 3 | The tests are meaningful and pass: the server, client and end-to-end suites pass on the release commit. No required test is skipped, disabled or weakened. | Command, tested commit, counts of passed, failed and skipped tests |
| 4 | For rule work, the test for the intended behavior failed before the implementation and passed afterwards. | `docs/sprints/sprint-1/tdd-evidence.md` with the red and green runs and commits |
| 5 | The contract and test design were committed before the implementation. | Git history showing the specification commit before the implementation commits |
| 6 | Authentication, role and ownership checks are enforced on the server. | API tests for anonymous, wrong role and other user's record |
| 7 | The change was made on a feature branch, reviewed by the other student in a pull request with a specific comment, integrated in staging, and released to `main`. | Issue, PR, review and merge records |
| 8 | Setup and documents are current: README, `.env.example`, SRS, SDS, traceability. | A clean setup run following the README |
| 9 | Incomplete work, failed tests and skipped tests are disclosed. | "Known limitations" in the release notes and PDF |
| 10 | No secret is committed. | `.env` ignored; `git grep` for passwords finds only the documented demo placeholder |

Completion is supported by evidence, not by a statement from an AI agent.
