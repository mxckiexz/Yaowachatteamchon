# BuyFlow Software Requirements Specification (SRS)

Theme 5: Workflow and Approval System. Context: internal purchase requests in a small company.
Document version 1.1. Version 1.0 was written before Sprint 1 implementation; 1.1 adds NFR-08 and NFR-09 (see the change log).

## 1. Stakeholder problem and context

A fictional company with about 30 employees buys office supplies and small equipment. Today employees ask for purchases by chat or by email. Nobody can tell which requests are waiting, who decided what, or why a request was refused. The finance contact asks the same questions again when a purchase is queried months later.

BuyFlow is a web application where an employee records a purchase request, sends it to one named approver, and the approver approves or rejects it with a recorded reason. Every request keeps a history of what happened, who did it, and when.

The context is a company, not a university department. All data is synthetic. No real payment, no email sending and no external API are used.

## 2. Actors

| Actor | Role in the system | Responsibilities |
|---|---|---|
| Employee | Role `EMPLOYEE` | Creates purchase requests, submits them to an approver, tracks their own requests. |
| Approver | Role `APPROVER` | Reviews requests assigned to them, approves or rejects with a reason. An approver is also an employee and can create their own requests. |

An Approver can raise their own purchase requests. This is deliberate: it makes the rule "nobody approves their own request" a real rule that must be enforced and tested, not a rule that no one can break.

Out of scope actors for Sprint 1: Finance viewer, Administrator (account administration).

## 3. Product scope

In scope for the whole product:

- Login with seeded accounts, two roles, server-side permission checks.
- Purchase requests with line items, server-calculated totals and a controlled status lifecycle.
- Assignment of a request to one approver, approve or reject with a reason, immutable decisions.
- Return for revision and resubmission, withdrawal of a pending request, editing and deleting drafts.
- Filtering requests by status, a decision summary report, in-app notifications.
- Two-level approval for high-value requests.
- Full history for every request.

## 4. Explicit exclusions

- Real payment, real purchase ordering, supplier integration, invoices.
- Sending e-mail, SMS or chat messages. Notifications are in-app only.
- Self-registration, password recovery, e-mail verification, advanced account administration, multiple roles per account.
- Budget accounting per department and currency conversion. All amounts are in Thai baht.
- File attachments to requests.
- Mobile native application.

## 5. Functional requirements (FR)

| ID | Requirement | Sprint |
|---|---|---|
| FR-01 | A user can log in with e-mail and password, log out, and retrieve their current identity (name, e-mail, role). | 1 |
| FR-02 | An authenticated user can create a purchase request draft with a title, a justification and one or more line items (item name, quantity, unit price). The system stores the request with status DRAFT. | 1 |
| FR-03 | The owner of a DRAFT request can submit it to one chosen approver. The status becomes PENDING. | 1 |
| FR-04 | A user can list their own requests and open one to see its status, items, total and history. | 1 |
| FR-05 | An approver can list the PENDING requests assigned to them and open one to see its details. | 1 |
| FR-06 | The assigned approver can approve or reject a PENDING request. A rejection requires a reason. The decision is stored with the approver, time and comment. | 1 |
| FR-07 | Each request shows an ordered history of events (created, submitted, approved, rejected, and later returned, resubmitted, withdrawn). | 1 |
| FR-08 | The approver can return a PENDING request to the requester with a reason, and the requester can edit and resubmit it. | 2 |
| FR-09 | The owner can withdraw a PENDING request before a decision. | 2 |
| FR-10 | The owner can edit or delete a DRAFT request. | 2 |
| FR-11 | A user can filter their requests, and an approver can filter their queue, by status and by text in the title. | 2 |
| FR-12 | A request with total above the high-value threshold requires a second approver after the first approval. | 3 |
| FR-13 | An approver can see a summary of decisions (counts by outcome, total approved amount, average decision time) for a date range. | 3 |
| FR-14 | A user sees in-app notifications when a request they own is decided or returned, and when a request is assigned to them. | 3 |

## 6. Business rules (BR)

| ID | Rule | Sprint |
|---|---|---|
| BR-01 | Status lifecycle: DRAFT to PENDING (submit); PENDING to APPROVED or REJECTED (decision). No other transition is allowed in Sprint 1. An illegal transition is rejected and changes nothing. | 1 |
| BR-02 | The server calculates the total as the sum of quantity times unit price over all items. A total sent by the client is ignored. A request needs at least one item. Quantity is a whole number from 1 to 1000. Unit price is greater than 0, at most 1,000,000 baht, with at most two decimals. The title is 3 to 120 characters. | 1 |
| BR-03 | A user can see only the requests they own. An approver can additionally see requests assigned to them. A request that a user may not see is reported as not found. | 1 |
| BR-04 | Nobody may approve or reject their own request. A request cannot be assigned to its own requester. | 1 |
| BR-05 | Only the approver assigned to a request can decide it. The approver must be an active user with role APPROVER. | 1 |
| BR-06 | A rejection must include a reason of at least 5 characters. | 1 |
| BR-07 | A decision is final. APPROVED and REJECTED requests cannot be decided again. Two simultaneous decisions on the same request produce exactly one decision. | 1 |
| BR-08 | Every status change writes exactly one history entry with actor, from status, to status, comment and time. History is never edited or deleted. | 1 |
| BR-09 | Only the owner can submit their DRAFT. Only a DRAFT is submitted. Submitted content (title, justification, items) cannot be changed in Sprint 1. | 1 |
| BR-10 | A returned request keeps its full history; resubmission goes to the same or a newly chosen approver. | 2 |
| BR-11 | A request with total above 50,000 baht needs two different approvers, neither of whom is the requester. | 3 |

## 7. Non-functional requirements (NFR)

| ID | Requirement and measurable target | Verification method | Sprint |
|---|---|---|---|
| NFR-01 | An unauthenticated request to any protected endpoint is rejected with status 401 and a body that contains no request, item or user data. | API test over every protected route. | 1 |
| NFR-02 | Passwords are stored only as bcrypt hashes with cost 10 or higher. No plaintext password in the database, logs or responses. | Unit test of the hash function and an API test that reads stored values. | 1 |
| NFR-03 | A session expires after 8 hours and is destroyed on logout. After logout the old session cookie gives 401. | API tests with an expired and a logged-out session. | 1 |
| NFR-04 | Errors return a JSON message without stack traces or database details. | API test with malformed input. | 1 |
| NFR-05 | A new developer can run the product locally from a fresh clone by following the README in at most 8 commands. | Documented procedure run on a clean database. | 1 |
| NFR-06 | The product reads all configuration (database URL, port, allowed origin) from environment variables, exposes `GET /api/health`, and keeps all durable data in the database so it can be packaged with Docker later. | API test for the health route; design review against the SDS. | 1 |
| NFR-07 | The request list for one user with 200 requests responds in under 500 ms on a local machine (median of 20 calls). | Early smoke check in Sprint 1 (TEST-59); the formal measurement script is Sprint 2. | 2 |
| NFR-08 | Text typed by users is treated as data: SQL metacharacters never change a query, HTML or script in text is shown as text and never executed, fields owned by the server cannot be set by the client, and the API does not announce its technology and sends basic protective headers. | API tests (TEST-50 to 55) and a browser test (TEST-56). | 1 |
| NFR-09 | The main screens have no serious or critical automated accessibility violations (WCAG 2.1 A and AA rules of axe-core), work at 375 px width without horizontal scrolling, and the login works by keyboard alone. | Browser tests (TEST-57, 58). | 1 |

## 8. Assumptions

- A1. One approver per request in Sprint 1. The requester chooses the approver from a list.
- A2. Seeded demo accounts are enough. Users do not register.
- A3. Money is in Thai baht, stored as integer satang to avoid rounding errors.
- A4. Time is stored in UTC.
- A5. The product runs as a modular monolith: one API process, one React client, one PostgreSQL database.

## 9. Decisions and resolved questions

| ID | Question | Decision and reason |
|---|---|---|
| D-01 | Which context for the Workflow and Approval theme? | Purchase requests in a small company. The lifecycle is clear and the amounts give natural business rules and a later high-value rule. |
| D-02 | Can an approver raise their own requests? | Yes. This makes the self-approval rule meaningful and testable. |
| D-03 | Who is the approver of a request? | The requester picks one approver at submission. The server checks the choice (BR-04, BR-05). |
| D-04 | Is a rejection reason required? | Yes (BR-06). Rejections without a reason are hard to understand later. |
| D-05 | Can a submitted request be edited? | No in Sprint 1 (BR-09). Return for revision arrives in Sprint 2 (FR-08). |
| D-06 | How does a user learn that a request they cannot see exists? | They do not. It is reported as not found (BR-03). |
| D-07 | Session design? | Opaque session id in an HttpOnly cookie, stored in the database, 8 hour expiry. Logout and deactivation take effect immediately. |
| D-08 | Approach to rules taken from real systems? | Common practice in commercial approval tools was used as guidance (routing to a named approver, approve or reject with comment, history trail, return for change, withdraw). The self-approval rule and the reason rule are our own decisions. |

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | Sprint 1 planning | First complete baseline. |
| 1.1 | Sprint 1, before the quality tests were written | Added NFR-08 (input handling and basic hardening) and NFR-09 (accessibility, narrow screen, keyboard) after the team decided to add security and accessibility checks. NFR-07 now has an early smoke check in Sprint 1. Contract: `docs/sprints/sprint-1/Q-quality-checks.md`. |
