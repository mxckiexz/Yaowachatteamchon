# Feature contract F-10: Comments

Contract version 1.0, 27 November 2026. Contract only, for review before implementation. Tracks Issue #59 and implements FR-20.

Linked requirements: FR-20, BR-12, BR-24, BR-25, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-04 for the visibility rules. It does not depend on F-09.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 27 November 2026 | Initial F-10 contract proposed for review. |

## 1. Feature design

People who work on a request can write short messages on it, for example a question from an approver and the answer of the owner.

New business rules:

- **BR-24:** A requester or an approver who may see a request (BR-12) can add a comment to it in any status. The administrator reads comments and cannot write them. A comment is 1 to 1000 characters after trimming.
- **BR-25:** A comment cannot be edited or deleted. Adding a comment does not change the request status or its history.

A comment is separate from the optional text of an approval and from the rejection reason. Those stay in the request history (BR-11) and are not copied into comments.

Out of scope: editing and deleting, replies and threads, mentions, files on comments, formatting, notifications about comments (F-12 covers submission, decision and return only; adding comments to it would need a revision), and paging. Without paging, a request with very many comments gives a long list; this is a known limitation.

## 2. UI specification

The request detail page has a section with the heading **Comments**.

| Element | Specification |
|---|---|
| List | Oldest first. Each entry shows the author name, the time and the text. Line breaks are kept. Long words wrap. The text is shown as text, never as HTML. |
| Form (requester and approver) | A text area labelled **Add a comment** with the help text `Up to 1000 characters.` and a **Post comment** button. The button is disabled while the text is blank after trimming and while a post is running. The text area does not cut the text off; the server decides the length. |
| Read only (administrator) | The list only. No form is rendered. |
| Loading | `Loading comments...` |
| Empty | `No comments yet.` |
| Load error | `Unable to load comments.` and a **Retry** button. The rest of the request page stays usable. |
| Post success | The new comment appears at the end without a page reload, and the text area is cleared. |
| Post error | The text stays in the text area. The server message and the `text` field message are shown in a `role="alert"` element connected to the text area with `aria-describedby`. |
| Announcements | A mounted polite `role="status"` region announces `Comment posted`. |

Everything works with the keyboard in reading order. Enter in the text area makes a new line; the button posts. After a successful post the focus stays on the text area. At 375, 768 and 1280 px there is no horizontal page scrolling, also with a 1000-character word.

## 3. API specification

Both routes require a session. `comment` in a response has exactly these fields:

```json
{
  "id": 12,
  "text": "Which model do you need?",
  "author": { "id": 3, "name": "Somchai" },
  "createdAt": "2026-11-27T10:00:00.000Z"
}
```

| Method and path | Request | Success |
|---|---|---|
| `GET /api/requests/:id/comments` | none | 200 `{ "comments": [comment] }`, oldest first (`createdAt`, then `id`) |
| `POST /api/requests/:id/comments` | JSON `{ "text": "..." }` | 201 `{ "comment": comment }` |

There is no route that changes or removes a comment. Only `text` is read from the body; the author, time and request are set by the server.

Text rules: `text` is a string. It is trimmed at both ends; inner spaces and line breaks are kept. After trimming it has 1 to 1000 characters, counted as the other text fields are counted (JavaScript string length, so one emoji can count as 2). The character U+0000 is refused, because the database cannot store it.

### Errors and order of checks

Checks run in the order below. The first failure answers.

| Order | Applies to | Condition | Response |
|---|---|---|---|
| 1 | POST | `Origin` is not the client origin | 403 `{ "error": "Request origin not allowed." }` (existing behaviour) |
| 2 | both | No valid session | 401 (existing body) |
| 3 | POST | The caller is an administrator | 403 `FORBIDDEN`, the same body as other wrong-role calls |
| 4 | both | The request does not exist or the caller may not see it (BR-12) | 404 `NOT_FOUND` |
| 5 | POST | `text` is missing, not a string, blank, longer than 1000 or contains U+0000 | 422 `VALIDATION_ERROR` with `fields.text`: `Enter a comment of 1 to 1000 characters.` |

Malformed JSON and a body over the existing 100 KB limit keep their existing answers, which can come before check 2. Error bodies follow NFR-04 and contain no comment text and no data of a request the caller may not see.

## 4. Data and migration

One new table `Comment`:

| Column | Type | Rule |
|---|---|---|
| id | integer | primary key |
| requestId | integer | foreign key to PurchaseRequest, delete cascades, indexed |
| authorId | integer | foreign key to User, delete restricted |
| text | text | not null, CHECK `char_length` between 1 and 1000 |
| createdAt | timestamp | default now |

The database check counts code points, which is never more than the JavaScript length, so every text the API accepts passes it. The application never deletes a purchase request; the cascade only serves database cleanup such as test fixtures. Posting is one insert and needs no transaction or lock, and it does not update the request row.

The migration only adds a table. Existing rows are not changed, and an earlier application revision keeps working with the new table present. The migration is independent of the F-09 migration.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-141 | The owner adds a comment and gets 201 with the comment fields; it is stored with the owner as author. |
| AC-142 | An approver can comment on another user's non-draft request and on their own draft. |
| AC-143 | Comments are accepted on requests in DRAFT, SUBMITTED, APPROVED, REJECTED and CANCELLED. |
| AC-144 | Missing, non-string, blank, 1001-character or U+0000 text gives 422 with `fields.text` and stores nothing; 1 and 1000 characters are accepted. |
| AC-145 | The stored text is trimmed at the ends and keeps inner spaces, line breaks and Thai text. |
| AC-146 | An administrator who posts gets 403, whether or not the request exists, and nothing is stored. |
| AC-147 | For a request that does not exist or that the caller may not see, including an approver on another user's draft, both routes give 404 with no request or comment data, and nothing is stored. |
| AC-148 | Without a session both routes give 401 without data; a POST from another origin gives 403 and stores nothing. |
| AC-149 | The list returns only the comment fields, oldest first, and an empty array when there are none; the owner, a permitted approver and the administrator can read it. |
| AC-150 | The list of a request contains only that request's comments. |
| AC-151 | The client cannot set the author, time, id or request; HTML and SQL characters in the text are stored unchanged and run nothing. |
| AC-152 | `PATCH`, `PUT` and `DELETE` on a comment address answer 404, and the comment is unchanged. |
| AC-153 | Adding a comment changes no request field and adds no history entry. |
| AC-154 | Comments are still there after a new session and after the request is submitted, approved, rejected or cancelled. |
| AC-155 | In the UI an owner and a permitted approver post a comment; it appears at once, the text area is cleared, and it is still there after a reload. |
| AC-156 | The administrator sees the comments and no form. |
| AC-157 | The UI shows the loading, empty and load-error with Retry states; a failed post keeps the text and shows the error; activating the button twice quickly creates one comment. |
| AC-158 | The section works with the keyboard, the text area has its label and error connection, success is announced in the mounted status region, and focus is handled as in section 2. |
| AC-159 | At 375, 768 and 1280 px, with a 1000-character word and line breaks, there is no horizontal page scrolling, and axe-core reports no serious or critical violation on the section. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-172 | AC-141 | API integration | Owner posts on their request | 201, exact response fields, one database row with the owner as author |
| TEST-173 | AC-142 | API integration | An approver posts on a submitted request of another user and on their own draft | Both 201 |
| TEST-174 | AC-143 | API integration | Owner posts on one request in each of the five statuses | All 201 |
| TEST-175 | AC-144 | Unit and API integration | No `text`, a number, an array, spaces and line breaks only, 1001 characters, text with U+0000; then 1 and 1000 characters | The bad inputs give 422 with `fields.text` and add no row; the last two give 201 |
| TEST-176 | AC-145 | API integration | Text with outer spaces, double inner spaces, line breaks and Thai | Stored and returned with only the outer white space removed |
| TEST-177 | AC-146 | API integration | Administrator posts on an existing request and on an id that does not exist | Both 403 `FORBIDDEN`; no row |
| TEST-178 | AC-147 | API integration | Another requester and an approver (on another user's draft) call both routes; any user calls an id that does not exist | 404 `NOT_FOUND`, no data, no new row |
| TEST-179 | AC-148 | API integration | Both routes without a session; POST with a foreign Origin | 401 with no data; 403; no new row |
| TEST-180 | AC-149 | API integration | List with none and with three comments from two authors, read by owner, approver and administrator | Empty array; three entries oldest first with only the listed fields |
| TEST-181 | AC-150 | API integration | Two requests visible to the same caller, each with its own comments | Each list contains only its own |
| TEST-182 | AC-151 | API and browser | Send `authorId`, `createdAt`, `id`, `requestId` in the body; use the text `<img src=x onerror=alert(1)>';--` | Server values are used; the text is returned and shown as text; no dialog opens |
| TEST-183 | AC-152 | API integration | `PATCH`, `PUT` and `DELETE` on `/api/requests/:id/comments/:commentId` by the author, sent with the client origin | 404; the row is unchanged |
| TEST-184 | AC-153 | API integration | Read the request row and history before and after a comment | Identical, including `updatedAt` |
| TEST-185 | AC-154 | API integration | Comment, then submit and approve one request, reject one, cancel one; read with a new session | The same comments are returned |
| TEST-186 | AC-155 | Browser end to end | Owner posts on a submitted request; approver replies | Both appear at once and after reload, in order; the text area is empty |
| TEST-187 | AC-156 | Browser end to end | Administrator opens a request with comments | The comments are visible; no text area or Post button |
| TEST-188 | AC-157 | Browser end to end | Delay and fail the list call, then Retry; fail a post; send a 1001-character text; activate Post twice quickly with a delayed response | Each state shows its text; failed text stays; one comment is created |
| TEST-189 | AC-158 | Browser end to end | Use only the keyboard to write a two-line comment and post it; cause an error | Reading-order focus, Enter adds a line, announcement, error connected to the text area, focus stays |
| TEST-190 | AC-159 | Browser responsive and accessibility | A 1000-character word and many lines at 375, 768 and 1280 px, with the form and read only; run axe on the section | No horizontal page overflow; no serious or critical violation |

## 7. Definition of Done

- This contract is reviewed and approved before implementation. A later change gets a new version and a change-log entry.
- Tests are written first. The red output (against the code without the feature) and the green output are stored under `docs/sprints/sprint-2/tdd/`; a test that guards a new rule fails without the feature.
- Every AC has its test, and the server suite, client tests, type check and build pass.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-2/test-output/`. Browser tests are run locally because CI does not run Playwright.
- The migration is additive and applies to a database that already has data.
- The SRS, feature inventory, traceability matrix and System SDS agree with the implementation, and the Sprint 2 results table records every AC, test, actual result and commit.
- The implementation Pull Request closes the F-10 Issue, is reviewed and approved by Thanwarat before merge, and is merged into `staging`.
