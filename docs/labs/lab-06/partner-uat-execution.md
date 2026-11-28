# Part B: Independent UAT of the partner team's Sprint 1 release

- **Product Team:** SerWongSerWay / PastelPulse (repo `Khanatip112/SerWongSerWay`)
- **UAT Team:** (our team, add both names)
- **Tested URL:** https://serwongserway-vs56b635aq-as.a.run.app
- **Tested version:** `main` @ `752a76a`. No release tag has been confirmed yet; ask the Product Team for the tag and Cloud Run revision.
- **Sprint 1 contract:** `docs/sprints/sprint-1/contracts.md` (AC-01 to AC-12) in the partner repo
- **Accounts used (labels only, no secrets):** Creator A (james), Creator B (william), Respondent A (amelia), Respondent B (daniel)

## Execution log

| Case ID | AC | Tester | Date/time (+07) | Input | Actual result | Result | Evidence |
|---|---|---|---|---|---|---|---|
| B-SYS-01 | AC-12 (readiness) | UAT Team (API, manual) | 2026-11-26 22:35 | `GET /api/ready` | 200 `{"status":"ready","database":"connected"}` | PASS | b-ev01-api-ready.jpg |
| B-AUTH-03 | AC-03 | UAT Team (API, manual) | 2026-11-26 22:35 | `GET /api/campaigns` with no cookie | 401 `UNAUTHENTICATED`, no campaign data in body | PASS | b-ev02-campaigns-unauth-401.jpg |
| B-AUTH-02a | AC-02 | UAT Team (curl) | 2026-11-26 | `POST /api/auth/login` with an unknown email | 401 `INVALID_CREDENTIALS` | PASS | curl output (log) |
| B-CAM-06a | AC-06 | UAT Team (UI + API, signed in as Creator A) | 2026-11-26 22:38 | `GET /api/campaigns` as Creator A | 8 campaigns listed, every one owned by Creator A (UI shows "My Surveys (8)") | PASS | b-ev03-creatorA-list-own-only.jpg |
| B-CAM-04 | AC-04 | UAT Team (API) | 2026-11-26 22:39 | `POST /api/campaigns` "UAT-Claude Main (EX)" with RATING_5 + TEXT questions, closes in 7 days | 201, id `2d1715e8…`, appears in the UI list with "2 Questions" | PASS | b-ev04-creatorA-campaigns-created.jpg |
| B-CAM-05a | AC-05 | UAT Team (API) | 2026-11-26 22:39 | title `"   "` (spaces only) | 400 `VALIDATION_ERROR` "Title is required" | PASS | API output (log) |
| B-CAM-05b | AC-05 | UAT Team (API) | 2026-11-26 22:39 | `questions: []` | 400 "At least one question is required to publish a campaign." | PASS | API output (log) |
| EX-04a | BR (deadline) | UAT Team (API) | 2026-11-26 22:39 | `closesAt` set 1 minute in the past | 400 "Closing deadline must be in the future." | PASS | API output (log) |
| B-CAM-05c | AC-05 (UI) | UAT Team (UI) | 2026-11-26 22:40 | Publish Survey pressed with an empty title | Form blocks it with "Please fill out this field."; nothing is created | PASS | b-ev05-ui-empty-title-blocked.jpg |
| B-OWN-11a | AC-11 | UAT Team (UI + API, signed in as Creator A) | 2026-11-26 22:41 | Results for Creator B's campaigns `…03`, `…06`, `…09` | 403 `FORBIDDEN_OWNER_ACCESS`, no `data` in the body; the UI shows a red alert "Only the campaign owner can access detailed results." | PASS | b-ev06, b-ev07 |
| EX-08 / B-AUTH-02b | AC-02 | UAT Team (UI) | 2026-11-26 22:42 | Clicked Log out, then browser Back | Sent to the login page. Back shows "Please sign in to access that page." and `/api/auth/me` returns 401 | PASS | b-ev09, b-ev10 |
| B-CAM-06b | AC-06 | UAT Team (UI + API, signed in as Respondent A) | 2026-11-26 22:46 | Respondent's survey list | 7 PUBLISHED surveys. The closed EX-03 survey and DRAFTs are not listed, and submitted ones show "✓ SUBMITTED" | PASS | b-ev11 |
| EX-03 / B-SUB-09a | AC-09, BR-02 | UAT Team (API) | 2026-11-26 22:46 | Submit to EX-03 survey after its deadline | 422 `CAMPAIGN_NOT_OPEN` | PASS | b-ev14 |
| EX-02 / B-SUB-09b | AC-09, BR-03 | UAT Team (API) | 2026-11-26 22:46 | Rating 0, 6 and 4.5 | 400 for all three | PASS | b-ev14 |
| B-SUB-03 | BR-03 | UAT Team (API) | 2026-11-26 22:46 | Required TEXT answer missing | 400 | PASS | b-ev14 |
| B-SUB-07 | AC-07 | UAT Team (API + UI) | 2026-11-26 22:46 | Valid rating 5 + text | 201. "Your Submitted Responses" shows 5/5 and the text after reload | PASS | b-ev13, b-ev14 |
| EX-09 / B-SUB-08 | AC-08, BR-01 | UAT Team (API + UI) | 2026-11-26 22:46 | Two simultaneous submissions, then a third | One 201 and one 409, then 409 again. The UI shows "You have already submitted a response to this survey." | PASS | b-ev13, b-ev14 |
| B-OWN-11b | AC-11 | UAT Team (UI + API) | 2026-11-26 22:46 | Respondent opens results | 403 with no data. The UI shows "Access denied: RESPONDENT accounts are not permitted…" Error code is `FORBIDDEN`, while TEST-11 in the STS expects `FORBIDDEN_OWNER_ACCESS` | PASS (status), see O-2 | b-ev12, b-ev14 |
| B-CAM-05d | AC-05 | UAT Team (API) | 2026-11-26 22:46 | Respondent `POST /api/campaigns` | 403 `FORBIDDEN` | PASS | b-ev14 |
| B-SUB-07b | AC-07 | UAT Team (API + UI, signed in as Respondent B) | 2026-11-26 22:57 | Rating 4 + "Daniel UAT answer" on MAIN | 201 (submission `23094b1d…`). The UI shows 4/5 and the text, and results return 403 for this respondent | PASS | b-ev15 |
| B-RES-10 | AC-10 | UAT Team (UI + API, signed in as Creator A) | 2026-11-26 23:04 | Results of MAIN after 2 responses (5 and 4) | 200. Total 2, average 4.5 (expected (5+4)/2 = 4.5), both respondents' answers listed | PASS | b-ev16, b-ev17 |
| EX-06 | AC-10 (persisted answers) | UAT Team (UI + API) | 2026-11-26 23:05 | Opened `/campaigns/:id/edit` on the PUBLISHED MAIN (2 responses), removed Question 2 "What can we improve?", pressed Publish Survey | Saved with no warning. Both respondents' text answers ("Daniel UAT answer", "Amelia concurrent A") are permanently gone from results, though the submissions still count as 2 | **FAIL** → UAT-SWSW-01 | b-ev18 to b-ev22 |
| EX-06 retest (Part D) | AC-10, AC-07 | UAT Team (UI + API, signed in as Creator A) | 2026-11-28 14:31 | On `main` @ `9c7b9eb` (revision `serwongserway-00012-x7s`, as reported): open `/campaigns/<MAIN>/edit`; `PUT` MAIN with a replacement question; `PUT` MAIN with status DRAFT and `questions: []`; `PUT` the CLOSED EX-03 survey; regression: create a DRAFT and edit it | Edit page shows "Survey Cannot Be Edited". All three `PUT`s return 409 `CAMPAIGN_NOT_EDITABLE`. MAIN results are unchanged (2 submissions, average 4.5, ratings 4 and 5). DRAFT: `POST` returns 201, `PUT` returns 200, and the edit form still opens. Unauthenticated `PUT` returns 401 | **PASS**, UAT-SWSW-01 verified fixed | d-ev01 to d-ev06 |
| Round 4 (Creator B) | AC-11 | | | | Skipped on purpose: creator-to-creator denial is already covered by B-OWN-11a | N/A | |

**Observation O-1 (UI, to confirm):** after the 403 alert on another creator's results page, the list below showed "My Surveys (0)" with "Loading surveys..." (b-ev06). Not reproduced: opening /campaigns again loaded all 10 surveys normally (b-ev08). The gap was a brief load, so it is not reported as a defect.

**Observation O-2 (minor contract deviation, candidate for a report):** for a RESPONDENT, `GET /api/campaigns/:id/results` returns 403 with code `FORBIDDEN` (from the role guard), while the partner's STS TEST-11 expects `FORBIDDEN_OWNER_ACCESS` for "creator2 and respondent1". The status and the non-disclosure are correct.

**Observation O-3 (privacy, possible enhancement):** `GET /api/campaigns/:id` as a RESPONDENT includes `creator.email` (b-ev14). The Sprint 1 contract does not forbid it, so the Product Team decides whether it is a defect or an enhancement.

**EX-03 setup:** "UAT-Claude Closing Soon (EX-03)" (id `db4f5be9…`) closes at 2026-11-26 22:44:53 (+07). In round 2, Respondent A submits to it after that time and should get 422.

## Exploratory cases still to run

EX-01 smoke test, EX-02 rating boundaries (0/1/5/6/4.5), EX-03 closing deadline, EX-04 invalid campaign, EX-05 a second creator opening another creator's results, EX-06 deleting a question after responses exist (suspected data loss, AC-10), EX-07 setting a campaign back to DRAFT after responses, EX-08 logout followed by Back, EX-09 double submit.

## Findings (outgoing defect reports)

### UAT-SWSW-01: Editing a published survey permanently deletes respondents' submitted answers

| Field | Value |
|---|---|
| Issue ID | UAT-SWSW-01 |
| Product owner/team | SerWongSerWay (Khanatip112/SerWongSerWay) |
| Reporter | UAT Team (Thanwarat Chanthana, Aphisaimai); executed with an AI coding assistant |
| Tested version | `main` @ `752a76a`, https://serwongserway-vs56b635aq-as.a.run.app |
| Linked case / requirement | EX-06; AC-10 ("all persisted respondent answers"), AC-07 ("durably stored") |
| Severity | **Major**. Respondents' submitted data is destroyed for good, with no warning and no undo. The creator's results stop showing answers that respondents did submit. The rating average still looks fine, so the loss is easy to miss |
| Preconditions / data | Creator A owns a PUBLISHED survey with Q1 RATING_5 (required) and Q2 TEXT (required). Respondent A and Respondent B have each submitted (5 + text, 4 + text) |
| Steps | 1. Sign in as Creator A. 2. Open `/campaigns/<id>/results` and note 2 submissions, each with a text answer. 3. Open `/campaigns/<id>/edit` (the page is titled "Edit Survey Draft" even though the survey is published). 4. Press Remove on Question 2. 5. Press Publish Survey. 6. Open the results again |
| Expected | Answers already submitted stay intact and visible. Alternatively, a survey that already has responses cannot have questions removed, or the creator gets a clear warning and must confirm |
| Actual | Saved silently. Results still show "Total Submissions 2", but both text answers are gone. Server: `PUT /api/campaigns/:id` runs `question.deleteMany`, and `Answer.question` uses `onDelete: Cascade` |
| Evidence | b-ev17 (before), b-ev18, b-ev19, b-ev20, b-ev21 (after), b-ev22 (API before/after and source lines) |
| Defect or feature? | Defect. It breaks the Sprint 1 persistence contract (AC-07, AC-10); it is not a request for new behaviour |
| Notified partner | (record date, channel and their reply) |
| Triage / fix | Accepted defect. Fixed in `fbbcd07` (PR #40, merged as `9c7b9eb`): the edit page is locked for non-DRAFT surveys, and `PUT /api/campaigns/:id` returns 409 `CAMPAIGN_NOT_EDITABLE`. Regression test: `server/src/test/uat-swsw-01.test.ts` |
| Status | **Closed: fixed and verified** by retest on 2026-11-28 (see EX-06 retest row). Text answers lost in round 1 cannot be recovered; they were UAT test data only |

### Minor observations sent to the Product Team for triage

- **O-2:** a respondent opening results gets error code `FORBIDDEN` instead of `FORBIDDEN_OWNER_ACCESS` (STS TEST-11). Status 403 and non-disclosure are correct. Suggested severity: minor.
- **O-3:** `GET /api/campaigns/:id` exposes `creator.email` to respondents. The contract does not forbid it. Possibly an enhancement or privacy hardening.

## Test data left on the partner deployment

DRAFT "UAT-Claude Retest Draft (regression) v2" (`9883b735…`) from the retest. Campaigns "UAT-Claude Main (EX)" (`2d1715e8…`) and "UAT-Claude Closing Soon (EX-03)" (`db4f5be9…`) owned by Creator A, plus submissions from Respondent A and Respondent B on MAIN. The Product Team can delete them after retest.
