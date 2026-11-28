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

## Independent retest by the partner team

After PR #70 was merged and deployed, the partner team retested the three defects on the live service. Their screenshots are copied unchanged from the shared UAT Drive folder (`UAT/RET`, uploaded 2026-11-28, 18:52 to 19:07 ICT).

| Item | Value |
|---|---|
| URL | https://sad61263d-4d7hbszvwq-as.a.run.app |
| Deployed commit | `2922c474fb38bde6719676c3f23fee1354beab66` (merge of PR #70; fix commit `ce99e7b`) |
| Cloud Run revision | `sad61263d-00006-9c4`, 100% of traffic |
| Version check | The screenshots load `index-CeRyV5iL.js` and `index-QDGkDLLU.css`, the same bundle the service serves at this commit; `/api/version` returns `2922c47…` |

| Defect | Screenshot | What it shows | Result |
|---|---|---|---|
| DEF-01 (#67) | [`retest/EV-RET01-mobile-wrap.png`](retest/EV-RET01-mobile-wrap.png) | 375 px viewport. The 100-character `W…` item name of PR-2026-0006 wraps over seven lines inside the page; no horizontal overflow | PASS |
| DEF-02 (#68) | [`retest/EV-RET02-zwsp-422.png`](retest/EV-RET02-zwsp-422.png) | The approver pastes `"​".repeat(5)` as the rejection reason for PR-2026-0008. `POST /api/requests/8/reject` returns 422 and the page says a rejection needs a reason of at least 5 characters; the request stays Submitted | PASS |
| DEF-03 (#69) | [`retest/EV-RET03-admin-readonly.png`](retest/EV-RET03-admin-readonly.png) | The account was promoted to ADMIN while its draft PR-2026-0009 was open in an old tab. Saving the draft sends `PATCH /api/requests/9`, which returns 404 ("Request not found."), so nothing changes | PASS |

Note on EV-RET03: the header still says "(Approver)" and the edit form is still shown because that tab was loaded before the promotion and was not refreshed. The server reads the role from the database on every request, so it refuses the change (the same case as the old-session check in `TEST-L6-06`). After a reload an ADMIN gets no edit form or Submit button (`CT-L6-01`).

Decision: the three defects are fixed and independently verified. The partner team still records the fix commit, retest result and final decision in sections 7 and 9 of `uat-handoff.md`.
