# F-13 TDD evidence

The API test file is `server/tests/f13/multi-step-approval.test.ts` and contains one named test for each API/integration criterion TEST-232–TEST-247 and TEST-251–TEST-252. The targeted green run completed with 18 passed.

The browser cases TEST-248–TEST-250 are in `e2e/requests/multi-step-approval.spec.ts`. They cover the approval-step labels and controls, keyboard focus and status announcements, responsive widths and axe checks. Run them, and the full Playwright suite, on the final commit and redirect the unchanged terminal output to `docs/sprints/sprint-3/test-output/`.

Before merge, run the same test files against `origin/staging` (with both `server/src` and `client/src` checked out from staging), preserve the failing terminal output as the red run, then restore the implementation and preserve the passing output as the green run.
