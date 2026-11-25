# PurchaseFlow Software Requirements Specification (SRS)

PurchaseFlow: Equipment Purchase Approval System. Theme 5: Workflow and Approval System.
Document version 2.0. Version 1.0 described an earlier design called BuyFlow; version 2.0 realigns the whole baseline with the team's project proposal (see the change log).

## 1. Stakeholder problem and context

An organisation (a company or a university) buys equipment through messages and paper forms in several channels. Nobody can tell which step a request is in, who is responsible for approving it, whether the data was changed afterwards, or why a request was refused. People without permission may see or change data, and rejected requests are hard to follow up.

PurchaseFlow is a web application in which a requester records a purchase request, sends it for review, and an approver approves or rejects it with a recorded reason. Roles control who can do what, and every status change is written to a history.

The project covers only the purchase request workflow, so that Sprint 1 fits the time. The structure can later be extended to other request types (budget, leave, travel). All data is synthetic. No real payment, e-mail sending or external API is used.

## 2. Actors

| Actor | Role | Responsibilities in the product |
|---|---|---|
| Requester | `REQUESTER` | Logs in, creates a purchase request, edits it while it is a draft, submits it, follows its status, reads the reason for a rejection, cancels it before approval (Sprint 2). Cannot approve any request, cannot change a request after it is approved, cannot see other users' requests. |
| Approver | `APPROVER` | Reviews submitted requests, approves, or rejects with a reason, reads the approval history. Cannot change the requester's original data, cannot approve their own request, cannot delete history. An approver is also a staff member and can raise requests of their own. |
| Administrator | `ADMIN` | Manages user accounts: lists users, activates or deactivates them, sets their role, and reads all requests (read only). In Sprint 1 the Administrator is limited to user management and reading data. The Administrator cannot create or decide requests. |

## 3. Product scope

In scope for the whole product: login with seeded accounts and server-side permissions; purchase requests with item, quantity, price, reason and category; a controlled status lifecycle; approval and rejection with a reason; history of every change; user administration. Later sprints add cancel, return for editing, search and filter, dashboard, attachments, comments, in-app notifications, multi-step approval, approval by amount, departments, delegation, reports and export, audit log, hardening and deployment preparation.

## 4. Explicit exclusions (Sprint 1)

- E-mail or LINE notification, payment, digital signature, several request types.
- Multi-level approval, export to Excel or PDF.
- GCP deployment and CI/CD (Lab 5).
- Self-registration, password recovery, e-mail verification.
- Warehouse and stock management.
- Attachments, comments, cancel, dashboard, filter (Sprint 2).

## 5. Status lifecycle

```
DRAFT
  | Submit
SUBMITTED
  |-- Approve -> APPROVED
  |-- Reject  -> REJECTED
  |-- Cancel  -> CANCELLED   (Sprint 2)
```

| Status | Meaning |
|---|---|
| DRAFT | The requester is still filling in the data. |
| SUBMITTED | Sent to the approvers for review. |
| APPROVED | Approved by an approver. |
| REJECTED | Rejected by an approver; a reason is stored. |
| CANCELLED | Cancelled by the request owner before approval; the transition is specified by F-06 in Sprint 2. |

## 6. Functional requirements (FR)

FR-01 to FR-15 are those of the team's proposal. FR-16 was added because login is needed by every actor but was not numbered in the proposal. FR-17 to FR-28 come from the proposal's Sprint 2 and Sprint 3 lists.

| ID | Requirement | Sprint |
|---|---|---|
| FR-01 | A requester can create a purchase request. It is stored as a DRAFT with a request number. | 1 |
| FR-02 | The owner can edit a request while it is a DRAFT. | 1 |
| FR-03 | The owner can submit a request when its data is complete. | 1 |
| FR-04 | A user can see their own requests. | 1 |
| FR-05 | The owner can cancel a request before it is approved. | 2 |
| FR-06 | An approver can see submitted requests. | 1 |
| FR-07 | An approver can approve a submitted request. | 1 |
| FR-08 | An approver can reject a submitted request. | 1 |
| FR-09 | The system stores the reason when a request is rejected. | 1 |
| FR-10 | The system shows the latest status of a request. | 1 |
| FR-11 | The system records an approval history. | 1 |
| FR-12 | A requester cannot see other users' requests. | 1 |
| FR-13 | A requester cannot approve a request. | 1 |
| FR-14 | An approver cannot change the original data of a requester. | 1 |
| FR-15 | An administrator manages users: list, activate or deactivate, set the role. | 1 |
| FR-16 | A user can log in with e-mail and password, log out, and read their own identity (name, e-mail, role). | 1 |
| FR-17 | Users can search and filter requests (by status, text, category). | 2 |
| FR-18 | A dashboard shows counts of requests by status for the user's role. | 2 |
| FR-19 | A request can carry attachments. | 2 |
| FR-20 | Users can write comments on a request. | 2 |
| FR-21 | An approver can send a request back to the requester for editing. | 2 |
| FR-22 | Users receive in-app notifications about their requests. | 2 |
| FR-23 | A request can need several approval steps. | 3 |
| FR-24 | The approval route depends on the total amount. | 3 |
| FR-25 | Users belong to departments. | 3 |
| FR-26 | An approver can delegate approval to another approver. | 3 |
| FR-27 | Users can see reports and export them. | 3 |
| FR-28 | The system keeps an audit log of important actions. | 3 |

## 7. Business rules (BR)

BR-01 to BR-14 are those of the proposal (BR-09 and BR-10 refined). BR-15 to BR-18 were added by the team. BR-19 and BR-20 belong to Sprint 3.

| ID | Rule | Sprint |
|---|---|---|
| BR-01 | Item name must not be empty (after trimming, at most 100 characters). | 1 |
| BR-02 | Description must not be empty (at most 1000 characters). | 1 |
| BR-03 | Quantity must be a whole number from 1 to 1000. | 1 |
| BR-04 | Estimated unit price must be more than 0, at most 1,000,000 baht, with at most two decimals. | 1 |
| BR-05 | Total amount is calculated by the server as quantity times unit price. A total sent by the client is ignored. | 1 |
| BR-06 | A request can be saved as a draft with the reason and the category still empty. To submit it, all data must be complete: item name, description, quantity, unit price, reason and category. | 1 |
| BR-07 | A requester must not approve or reject their own request. | 1 |
| BR-08 | Only a SUBMITTED request can be approved or rejected. | 1 |
| BR-09 | A rejection must have a rejection reason of at least 5 characters. | 1 |
| BR-10 | Only a DRAFT can be edited. A request that is SUBMITTED, APPROVED, REJECTED or CANCELLED cannot be edited. | 1 |
| BR-11 | Every status change creates a new history entry (actor, from status, to status, comment, time). History is never edited or deleted. | 1 |
| BR-12 | A user sees only the data they may access. A requester sees their own requests. An approver also sees every request that is not a draft. An administrator sees all requests, read only. A request a user may not see is reported as not found. | 1 |
| BR-13 | A deactivated user cannot log in, and an existing session of that user stops working immediately. | 1 |
| BR-14 | Request numbers are unique. | 1 |
| BR-15 | The category must be one of: EQUIPMENT, SOFTWARE, FURNITURE, STATIONERY, OTHER. | 1 |
| BR-16 | An administrator cannot change their own account (activation or role), so that the system is never left without an administrator by accident. | 1 |
| BR-17 | Two simultaneous decisions on the same request produce exactly one decision. | 1 |
| BR-18 | Only the owner can edit or submit a request. The administrator and approvers cannot. | 1 |
| BR-19 | A request that needs several steps must be approved by different approvers at each step, none of whom is the requester. | 3 |
| BR-20 | The approval route depends on the total amount; the thresholds are decided in the Sprint 3 contract. | 3 |
| BR-21 | Only the request owner can cancel a DRAFT or SUBMITTED request; APPROVED, REJECTED and CANCELLED requests cannot be cancelled. | 2 |

## 8. Non-functional requirements (NFR)

NFR-01 to NFR-08 are those of the proposal, with measurable targets and a verification method added. NFR-09 to NFR-13 were added by the team.

| ID | Requirement and measurable target | Verification method | Sprint |
|---|---|---|---|
| NFR-01 | Every protected API checks the session and the role on the server. A call without a session gets 401 and a body with no data. A call with the wrong role gets 403. | API tests for every protected route, anonymous and wrong role. | 1 |
| NFR-02 | The API never returns a request the user may not see. A request a user may not see gives 404 and a body with no request data. | API tests with other users, other roles and drafts. | 1 |
| NFR-03 | Passwords are stored only as bcrypt hashes with cost 10 or higher, never in plain text, logs or responses. | Unit test of the hash function and an API test that reads stored values. | 1 |
| NFR-04 | Errors return a clear JSON message, with a message per invalid field, and never a stack trace or database detail. | API tests with invalid input and malformed JSON. | 1 |
| NFR-05 | The UI works on desktop, tablet and mobile: no horizontal page scrolling at 1280, 768 and 375 pixels width. | Browser tests at the three widths. | 1 |
| NFR-06 | Every status change has an automated test, including the transitions that must be refused. | The transition unit test and the API tests of F-02 and F-03. | 1 |
| NFR-07 | Data is stored in a real database and is returned after a page reload and after the API restarts. | Browser test with reload; API tests read the database. | 1 |
| NFR-08 | Changing one user's data never overwrites another user's data. Editing a draft changes only that draft. | API tests that compare other users' rows before and after. | 1 |
| NFR-09 | Text typed by users is data: SQL characters never change a query, HTML or script is shown as text and never run, fields owned by the server cannot be set by the client, and the API does not announce its technology and sends basic protective headers. | API tests and a browser test. | 1 |
| NFR-10 | The main screens have no serious or critical automated accessibility violations (WCAG 2.1 A and AA rules of axe-core) and the login works by keyboard alone. | Browser tests. | 1 |
| NFR-11 | A new developer can run the product from a fresh clone by following the README in at most 8 commands. All configuration comes from environment variables, and `GET /api/health` answers. | A documented clean run (manual check M-01) and an API test for health. | 1 |
| NFR-12 | The request list of one user with 200 requests responds in under 500 ms on a local machine (median of 20 calls). | Early smoke check in Sprint 1; the formal measurement is Sprint 2. | 2 |
| NFR-13 | A session expires after 8 hours and is destroyed at logout. Forged, empty or malformed session values are rejected with 401, never with a server error. | API tests with expired, logged-out and forged sessions. | 1 |

## 9. Assumptions

- A1. Any approver can decide any submitted request. There is no assignment to one named approver in Sprint 1 (multi-step routes come in Sprint 3).
- A2. One request has one item (the proposal's fields). Several items per request are not planned.
- A3. Seeded demo accounts are enough. Users do not register.
- A4. Money is in Thai baht and stored as integer satang to avoid rounding errors.
- A5. Time is stored in UTC.
- A6. The product is a modular monolith: one API process, one React client, one PostgreSQL database.

## 10. Decisions and resolved questions

| ID | Question | Decision and reason |
|---|---|---|
| D-01 | Which context for the Workflow and Approval theme? | Equipment purchase requests, as in the team's proposal. The lifecycle is clear and amounts give natural rules. |
| D-02 | Can an approver raise their own requests? | Yes. The proposal forbids approving one's own request, which only makes sense if approvers can have requests. |
| D-03 | Who decides a request? | Any approver, because the proposal lets approvers see submitted requests without assignment. The requester's own approver rights are blocked by BR-07. |
| D-04 | One item or several items per request? | One item, as in the proposal's fields. |
| D-05 | Which part of the proposal's lists goes into Sprint 1? | The 11 items of the proposal's Sprint 1 list, plus editing a draft (FR-02) and a minimal administrator (FR-15), because the proposal also lists them under the actors. Cancel (FR-05) and attachments are Sprint 2, as the proposal's Sprint 2 list says. |
| D-06 | Is login a requirement? | Yes: FR-16 was added. |
| D-07 | May a draft be incomplete? | Reason and category may be empty in a draft and are required to submit (BR-06). Item name, description, quantity and price are always required (BR-01 to BR-04). |
| D-08 | What can the administrator do? | List users, activate or deactivate, set the role, read all requests. Not create or decide requests, and not change their own account (BR-16). |
| D-09 | How is the work split between the two students? | The proposal lists a split of areas per student. The course requires both students to take part in every area (requirements, design, tests, AI supervision, implementation, review, maintenance), so the split is only a starting point and each Issue and PR names both people. |
| D-10 | Session design? | Opaque session id (UUID) in an HttpOnly cookie, stored in the database, 8-hour expiry. Logout and deactivation take effect at once. |
| D-11 | Request number format? | `PR-YYYY-NNNN` from a database sequence (unique, race-safe). |
| D-12 | Guidance from real approval systems? | Common practice in commercial tools was used as guidance (named statuses, approve or reject with comment, history trail, return for editing, cancel). Rules such as no self-approval and the minimum reason length are our own decisions. |

## 11. Change log

| Version | Date | Change |
|---|---|---|
| 1.0, 1.1 | Sprint 1 planning | Earlier design called BuyFlow (several items per request, one assigned approver, two roles). Kept in the repository under the tag `archive/buyflow-v1`. |
| 2.0 | 2026-11-15, before any 2.0 code | The team's proposal (PurchaseFlow) became the baseline. Differences: one item per request; status names DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED; any approver decides; request numbers and categories; an administrator role; separate approve and reject endpoints. Added FR-16, BR-15 to BR-18, NFR-09 to NFR-13. Reason: the proposal is the agreed scope of the pair. Contracts and tests were rewritten for 2.0 before the new code. |
