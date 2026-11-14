# Contribution table, AI-use declaration and known limitations (Sprint 1)

## Contribution table

Fill in from the real Issues and pull requests before submitting. Equal commit counts are not required; pair work is recorded in the Issue or PR.

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
| UI | | | |
| End-to-end tests | | | |

## AI-use declaration

An AI coding assistant (Claude Code) was used to help with: drafting the SRS, SDS and feature contracts from the group specification; writing the tests first and the implementation of F-01 to F-04; writing the React screens and the Playwright tests; running the suites and building the results table and the PDF. The students supplied the context and the decisions listed in the SRS, read the generated code and documents, and are responsible for them. Test results in this submission come from the commands recorded in `results.md`, not from a statement by the assistant.

## Known limitations and incomplete work

- Sprint 2 and Sprint 3 features (FR-08 to FR-14, BR-10, BR-11, NFR-07) are planned and not implemented.
- No draft editing or deleting, so a mistake in a DRAFT cannot be corrected yet (Sprint 2).
- A request can only go to one approver. There is no way to change the approver after submission.
- The UI has no pagination; lists show every request of the user.
- The estimate on the New request form is a hint calculated in the browser; the server total is the real one.
- There are no automated accessibility checks.
- Docker, CI and GCP deployment are not part of Deliverable 1 (Lab 5).
- Pull request reviews, Issues and the final board status are produced on GitHub by the two students; this repository's local history shows the commit order only.
