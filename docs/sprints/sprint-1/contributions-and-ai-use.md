# Contribution table, AI-use declaration and known limitations (Sprint 1)

## Contribution table

Fill in from the real Issues and pull requests before submitting. Equal commit counts are not required; pair work is recorded in the Issue or PR. The course requires both students to take part in every area, so the table must show each student in several rows. The areas that the proposal assigned to each student at the start are only a starting point (SRS D-09).

| Item | Student 1 (name, ID, GitHub) | Student 2 (name, ID, GitHub) | Notes |
|---|---|---|---|
| SRS and decisions | | | |
| Feature inventory and traceability | | | |
| System SDS | | | |
| Feature contracts and STS | | | |
| F-01 implementation and review | | | |
| F-02 implementation and review | | | |
| F-03 implementation and review | | | |
| F-04 implementation and review | | | |
| F-05 implementation and review | | | |
| UI | | | |
| Browser tests | | | |
| Quality checks | | | |

## How the branches are organised

The features depend on each other, so the feature branches were built one on top of the other (each starts from the previous one) instead of each starting from the staging tip. Every pull request targets `sprint-1/staging` and they are merged in order with merge commits, so after each merge the next pull request shows only its own commits. The first pull request carries the version 2.0 documents, which were written before any code.

## AI-use declaration

An AI coding assistant (Claude Code) was used to help with: turning the team's proposal into the SRS, SDS and feature contracts; writing the tests first and the implementation of F-01 to F-05; writing the React screens, the browser tests and the security, accessibility and performance checks; running the suites and building the results table and the PDF. The students supplied the proposal and the decisions listed in the SRS, read the generated code and documents, and are responsible for them. Test results in this submission come from the commands recorded in `results.md`, not from a statement by the assistant.

## Known limitations and incomplete work

- Sprint 2 and Sprint 3 features (FR-05, FR-17 to FR-28, BR-19, BR-20, NFR-12 formal measurement) are planned and not implemented. The status CANCELLED exists but nothing sets it yet.
- There are no attachments or comments, and a request has one item only.
- The UI has no pagination; lists show every request of the user.
- The estimate on the form is a hint calculated in the browser; the server total is the real one.
- A deactivated user keeps their old requests; the administrator cannot reset passwords (not in Sprint 1).
- Accessibility is checked only by automated rules (axe-core), keyboard and three-width tests; there is no screen reader or user test. Other limits (no login rate limiting, no real load test, no professional penetration test, no UAT yet) are in `docs/qa-defect-log.md`.
- Docker, CI and GCP deployment are not part of Deliverable 1 (Lab 5).
- Pull request reviews, Issues and the final board status are produced on GitHub by the two students; this repository's local history shows the commit order only.
