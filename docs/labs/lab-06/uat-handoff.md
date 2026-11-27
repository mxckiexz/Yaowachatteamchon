# PurchaseFlow Sprint 1 — Independent UAT Handoff

## 1. Purpose

This document is the handoff package for an independent UAT team. The partner team must test the released Sprint 1 application as a real user, without using the implementation team as a step-by-step guide. The partner team records the actual result, evidence and any defect found.

This handoff covers Sprint 1 only: authentication, purchase requests, approval/rejection, lists and history, administrator user management, and the released UI. Sprint 2 and Sprint 3 features are out of scope.

## 2. Product and release under test

| Item | Value |
|---|---|
| Team | Yaowachatteamchon |
| Product | PurchaseFlow equipment purchase approval system |
| Repository | https://github.com/mxckiexz/Yaowachatteamchon |
| Release tag | `sprint-1-release` |
| Release commit | `1fa292ce9169a98f57d6cfbab710b3a8cbbfc282` |
| Deployed commit | `06d290a1f1578b5ebcc1826d388c60027f522e72` (shown by `/api/version`) |
| Cloud Run revision | `sad61263d-00005-rqz` (100% traffic) |
| Production URL | `https://sad61263d-4d7hbszvwq-as.a.run.app` |
| Test date/time | **TO FILL by the UAT tester** |

The deployed commit differs from `sprint-1-release` only in the Lab 5 deployment files: `server/src/app.ts` (`/api/version` and `/api/ready`), `server/src/seedData.ts` (portal secret names), and `server/src/staticSite.ts` (built-client serving). Sprint 1 functionality is unchanged. Test only the deployed commit above; if `/api/version` shows anything else, stop and tell the product team. If the deployed revision or URL changes, update this table before testing.

## 3. People and test accounts

### Product team

- Thanwarat Chanthana (`Thanwarat1303`), student ID 67070501025
- Aphisaimai (`mxckiexz`), student ID 67070501077

### Independent UAT team

Record the partner team and testers here before execution:

| Name | GitHub account | Role in UAT |
|---|---|---|
| **TO FILL** | **TO FILL** | UAT tester |
| **TO FILL** | **TO FILL** | UAT tester/reviewer |

### Accounts used during UAT

The passwords are shared privately and must never be committed to Git, put in this file, or included in the PDF.

| Account | Email | Application role | Used for |
|---|---|---|---|
| Requester 1 | `ploy@purchaseflow.test` | REQUESTER | Create, edit and submit own requests |
| Requester 2 | `nattapong@purchaseflow.test` | REQUESTER | Ownership and visibility checks |
| Approver 1 | `somchai@purchaseflow.test` | APPROVER | Review, approve and reject |
| Approver 2 | `malee@purchaseflow.test` | APPROVER | Optional second-approver check |
| Administrator | `admin@purchaseflow.test` | ADMIN | User management and read-only all-requests view |

Send the password for each account through a private channel only. Do not paste passwords into GitHub Issues, pull requests, screenshots, Markdown or the submission PDF.

## 4. Test setup and safety

1. Open the Production URL in a private browser window.
2. Confirm the page loads and the login screen is displayed.
3. Use only the supplied test accounts. Do not use personal accounts or real purchase information.
4. Prefix newly created test data with `[UAT]` so it can be identified later.
5. Take a screenshot after each important expected result. Do not include passwords, cookies or secret values in screenshots.
6. Record the exact account, time, URL and release commit for every case.
7. Do not change or delete existing seeded data unless the case explicitly requires it.
8. If a case fails, stop changing that test record, record the expected and actual result, and create a defect with reproduction steps.

### Reset and cleanup

- Do not delete seeded records. Leave records whose item name starts with `[UAT]` for audit, unless the partner team is explicitly asked to remove them; if removed, record their IDs and a screenshot.
- After UAT-05, reactivate Requester 2 and verify that Requester 2 can log in. Leave the administrator active and unchanged.
- Log out every account, close the private window, and do not retain passwords in screenshots or notes committed to the repository.

### Test order and dependencies

Run the cases in this order: **UAT-01 → UAT-02 → UAT-03 → UAT-04 → UAT-05**. UAT-04 uses the decided request created in UAT-01. UAT-03 must create or use an approver-owned submitted request before checking self-approval. UAT-05 is last because it temporarily deactivates Requester 2.

### Sprint 1 references

The cases below use the Sprint 1 requirements and acceptance criteria: F-01 (AC-01 to AC-12), F-02 (AC-13 to AC-23), F-03 (AC-24 to AC-32), F-04 (AC-33 to AC-38), and F-05 (AC-39 to AC-44).

## 5. Executable UAT cases

### UAT-01 — Normal request and decision journey

**Goal:** A requester can create and submit a purchase request, and an approver can make a final decision.

**References:** FR-01, FR-02, FR-03, FR-07, FR-08, FR-10, FR-11; BR-01 to BR-09, BR-11, BR-12; AC-13, AC-16, AC-18, AC-24, AC-35, AC-38.

**Preconditions:** Production URL is reachable; Requester 1 and Approver 1 credentials are available.

**Steps:**

1. Sign in as Requester 1.
2. Open **New request**.
3. Enter item name `[UAT] Laptop stand`, description `Laptop stand for office use`, quantity `3`, unit price `450.50`, reason `Ergonomic setup`, and category `EQUIPMENT`.
4. Save the request as a draft.
5. Check that a request number is shown, the total is calculated by the server, and the status is `DRAFT`.
6. Open the draft, change one field, save it, and confirm the request number stays the same.
7. Submit the completed request.
8. Confirm the status becomes `SUBMITTED` and the history contains `CREATED` and `SUBMITTED`.
9. Log out and sign in as Approver 1.
10. Open the review queue and open the submitted request.
11. Approve the request.
12. Log out and sign in again as Requester 1.
13. Open the request detail.

**Expected result:** The server-calculated total is **1,351.50 THB** (3 × 450.50), the request number has the `PR-YYYY-NNNN` format, the request is approved, the ordered history contains `CREATED`, `SUBMITTED` and `APPROVED`, and the approver is recorded as the decision actor. No edit or submit action is available after approval.

**Evidence:** Screenshots of the draft, submitted detail/history, review queue, approval result and final requester view.

### UAT-02 — Validation and boundary rules

**Goal:** Invalid or incomplete data is refused with a useful message.

**References:** FR-01, FR-02, FR-03, FR-08; BR-01 to BR-06, BR-09; AC-14, AC-19, AC-25.

**Preconditions:** Requester 1 is available; use a new `[UAT]` draft.

**Steps:**

1. Open **New request** and try to save with each required text field empty.
2. Try quantity values `0`, `-1`, `2.5`, `1000` (valid boundary) and `1001` (invalid).
3. Try unit prices `0`, `-1`, `10.999`, `1000000` (valid boundary) and `1000000.01` (invalid).
4. Save a draft without a reason or category.
5. Try to submit that incomplete draft.
6. Fill the reason and category and submit again.
7. As an approver, open a submitted request and choose **Reject**.
8. Try an empty rejection reason and then a reason shorter than five characters.
9. Enter a reason of at least five characters and reject the request.

**Expected result:** Invalid values are refused without creating a partial request. An incomplete draft cannot be submitted and the message names the missing fields. A rejection without a valid reason is refused; a valid reason changes the request to `REJECTED` and is stored in history.

**Evidence:** Screenshots of each validation message and the final rejected request/history.

### UAT-03 — Role, ownership and forbidden access

**Goal:** Users can access only the requests and actions allowed by their role.

**References:** FR-04, FR-06, FR-10, FR-12, FR-13, FR-15, FR-16; BR-12, BR-13, BR-16, BR-17; AC-34, AC-35, AC-37, AC-39, AC-44.

**Preconditions:** Requester 1 owns a request; Requester 2 and Approver 1 credentials are available. First create and submit a separate `[UAT]` request while signed in as Approver 1; this is the approver-owned request used in step 6.

**Steps:**

1. Sign in as Requester 2 and confirm there is no review queue or administrator user-management control.
2. Open the URL of Requester 1's request directly.
3. Confirm the request is not revealed.
4. Sign in as Approver 1 and open the review queue.
5. Confirm drafts are not shown in the queue; only submitted requests of other users are shown.
6. As an approver, try to open and approve the approver's own submitted request.
7. Sign in as the Administrator and open **All requests** and **Users**.
8. Confirm the administrator can read all requests but cannot create, edit, approve or reject a request.
9. Log out and open a protected URL without a session.

**Expected result:** Forbidden records are not disclosed. The requester gets the normal own-request view only; another user's request is treated as unavailable. Self-approval is refused. The administrator is read-only for requests, and an anonymous user is sent to login/refused.

**Evidence:** Screenshots of the missing/blocked controls, review queue, forbidden-access message and anonymous login redirect.

### UAT-04 — Draft editing, history and persistence

**Goal:** A request and its audit history remain correct after navigation and a new session.

**References:** FR-02, FR-04, FR-10, FR-11; BR-11, BR-12; AC-17, AC-20, AC-35, AC-36, AC-38.

**Preconditions:** Requester 1 has a request that has been decided by an approver.

**Steps:**

1. Open the decided request and record its status, total, reason, category and history order.
2. Reload the page.
3. Navigate away and open the request again.
4. Log out and log in again as the same requester.
5. Open the request detail.
6. Try to edit or submit the decided request.
7. Check the history timestamps and actors.

**Expected result:** The same status, total, fields and ordered history are shown after reload and a new session. The decided request cannot be edited or submitted, and no history row is lost or duplicated.

**Evidence:** Before/after reload screenshots, re-login screenshot, detail/history screenshot and the unavailable edit/submit controls.

### UAT-05 — Administrator account management

**Goal:** The administrator can manage other accounts without exposing password hashes or locking themselves out.

**References:** FR-15, FR-16; BR-13, BR-16; AC-39, AC-40, AC-41, AC-42, AC-44.

**Preconditions:** Administrator and Requester 2 credentials are available.

**Steps:**

1. Sign in as the Administrator and open **Users**.
2. Confirm users are listed without password hashes.
3. Deactivate Requester 2.
4. Log out and try to sign in as Requester 2.
5. Sign in as the Administrator again and reactivate Requester 2.
6. Confirm Requester 2 can sign in again.
7. Try to deactivate or change the role of the administrator's own account.

**Expected result:** The deactivated user cannot log in and an existing session is refused. Reactivation allows login again. The administrator's own account cannot be changed, and no password hash is shown.

**Evidence:** Users screen, failed login, successful reactivation login and the self-change refusal.

## 6. Result record

The partner UAT team must complete this table. Do not mark a case PASS without evidence.

| UAT ID | Actual result | PASS/FAIL/BLOCKED | Tester | Date/time | Evidence file or screenshot | Defect link |
|---|---|---|---|---|---|---|
| UAT-01 | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |
| UAT-02 | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |
| UAT-03 | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |
| UAT-04 | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |
| UAT-05 | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |

## 7. Defect and retest record

For each FAIL, record the expected result, actual result, exact steps, severity, screenshot and issue link. After a fix, record the fixed commit and repeat the same steps. Do not silently change a FAIL to PASS.

| Defect ID | UAT case | Severity | Expected | Actual | Reproduction/evidence | Fix commit | Retest result |
|---|---|---|---|---|---|---|---|
| **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** | **TO FILL** |

## 8. Handoff message

Send the partner team the repository URL, the real deployed URL, the release commit/revision, this file, and the test-account passwords through a private channel. Never send passwords in a public Issue or commit them to the repository.

Suggested message:

> Please perform the independent Sprint 1 UAT using `docs/labs/lab-06/uat-handoff.md`. Test UAT-01 to UAT-05 on the stated release only, record PASS/FAIL/BLOCKED with screenshots and date/time, and report every failure with reproduction steps. Test-account passwords will be sent privately. Please do not add credentials to GitHub or the PDF.

## 9. Acceptance decision

| Decision | Value |
|---|---|
| Independent UAT completed | **TO FILL** |
| All required cases passed | **TO FILL** |
| Open defects accepted by both teams | **TO FILL** |
| Final UAT decision | **TO FILL: Accepted / Accepted with explicitly documented minor limitations / Not accepted** |
| Product-team acknowledgement | **TO FILL** |
| UAT-team acknowledgement | **TO FILL** |

Critical or major defects cannot be accepted; they must be fixed and retested. Only explicitly documented minor limitations may be accepted by both teams. Execution results and tester-specific fields remain blank until the partner team performs the test; filling those without evidence would be inaccurate.
