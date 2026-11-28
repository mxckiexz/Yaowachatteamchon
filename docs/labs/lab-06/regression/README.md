# Lab 6 Part D: RED/GREEN regression evidence

Defects reported by the partner team's independent UAT of Sprint 1, fixed on branch `fix/lab6-uat-defects` from the deployed commit `06d290a`.

| Defect | Issue | Severity | Regression tests | Fix |
|---|---|---|---|---|
| DEF-01: a 100-character unbroken item name widens the request detail page at 375 px | #67 | Minor | `CT-L6-02` (client), `TEST-L6-E2E-01` (Playwright, 375 px) | `client/src/RequestDetail.tsx`: heading gets `text-break` |
| DEF-02: zero-width characters (`​`, `‌`, `‍`, `﻿`, `⁠`) pass the required-text and 5-character rejection-reason rules | #68 | Major | `TEST-L6-01` to `TEST-L6-05` (server) | `server/src/validation.ts`: `cleanText` strips white space and invisible format characters (Unicode `Cf`) at both ends; `visibleLength` ignores them in the minimum-length checks. Used for item name, description, reason, the submit completeness check and the approve/reject text |
| DEF-03: a user promoted to ADMIN can still edit and submit their old draft | #69 | Major | `TEST-L6-06`, `TEST-L6-07` (server), `CT-L6-01` (client) | `server/src/requestRoutes.ts`: `PATCH /requests/:id` and `POST /requests/:id/submit` return 404 for an ADMIN (AC-17, BR-18); `client/src/RequestDetail.tsx`: no edit form or Submit button for an ADMIN |

## Files

- `red-server.txt`, `red-client.txt`, `red-e2e.txt`, `red-e2e-375px.png`: the new tests run against the unfixed code at `06d290a`. They fail for the reported reason.
- `green-server.txt`, `green-client.txt`, `green-e2e.txt`: the same tests after the fix. They pass.
- `green-full.txt`: the full suites after the fix (server, client, typecheck, builds and all Playwright tests).

Run them with:

```bash
npm --prefix server test -- tests/lab6
npm --prefix client test -- tests/requests/uat-defects.test.tsx
npx playwright test e2e/quality/long-item-name.spec.ts
```
