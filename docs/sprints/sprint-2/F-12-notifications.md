# Feature contract F-12: In-app notifications

Contract version 1.2, 28 November 2026. Contract and implementation are merged into `staging`. Tracks Issue #71 and FR-22.

Linked requirements: FR-22, BR-12, BR-17, BR-27, BR-28, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-03 (decisions) and F-11 (return for editing, Issue #64), and uses the visibility rules of F-04. It follows F-11 contract v1.1 and implementation PR #66, both merged. If F-11 changes its transition, history action or visibility, this contract must be revised.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 28 November 2026 | Initial F-12 contract proposed for review. |
| 1.1 | 28 November 2026 | After review: AC-186 and TEST-217 include the return; TEST-211 counts the rows of one request against the active approvers; the effect of status and role changes on earlier notifications is stated, and AC-189 and TEST-220 cover it, including cancel; AC-192 and TEST-223 cover unread notifications beyond the 50; the answer to an unknown route and the administrator path `/admin/users` are named; the F-11 contract and implementation Pull Requests are distinguished. |
| 1.2 | 28 November 2026 | F-13 revision: restored recipient/actor guarantees and added stepped notification behavior. |

## 1. Feature design

The system tells a user inside the application when a request needs their attention or when something was decided about their own request.

| Event | Who is notified | Type |
|---|---|---|
| A request is submitted, also again after a return | Every active approver except the requester | `SUBMITTED` |
| A request is approved | The requester | `APPROVED` |
| A request is rejected | The requester | `REJECTED` |
| A request is returned for editing (F-11) | The requester | `RETURNED` |

New business rules:

- **BR-27:** Recipients are chosen at the time of the event; no other action creates a notification. For an unconfigured request, submit notifies every active approver except the requester. For a configured F-13 chain, submit notifies only the current step approver and each intermediate approval notifies the next step approver; final approval, rejection and return notify the requester. Notifications are created in the same transaction as the status change and its history entry. A refused or failed change creates none. Of simultaneous changes (BR-17) only successful changes create notifications.
- **BR-28:** A user reads and marks only their own notifications, and only those of requests they may see now (BR-12). Any other notification is not listed, not counted and answers as not found.

BR-28 changes only what a user can see. A change of status or role never edits or deletes an existing notification row, and its `readAt` is kept. Only the events in the table above add rows. For an approver's earlier `SUBMITTED` notification of a request:

| What happens | The earlier notification |
|---|---|
| The request is returned, so it is a draft again | Hidden: not listed, not counted, marking it answers 404, and **Mark all as read** leaves it unchanged |
| The owner submits it again | Visible again, beside the new `SUBMITTED` notification |
| The owner cancels the returned draft | Visible again, because approvers may see a cancelled request. Cancelling adds no notification |
| The recipient becomes a requester | Hidden, because the request belongs to another user |
| The recipient becomes an approver again | Visible again if the request is not a draft |
| The recipient becomes an administrator | Every notification route answers 403 (check 3) |

Out of scope: e-mail, push or browser notifications, live updates without a page change, user settings, notifications for cancellation, comments or attachments, deleting notifications, and paging. The list shows the 50 newest visible notifications. Older ones cannot be opened, but unread ones are still counted and **Mark all as read** includes them. This is a known limitation.

## 2. UI specification

Requesters and approvers get a **Notifications** link in the main navigation. When there are unread notifications, it shows the number and its accessible name is `Notifications, N unread`. With none, no number is shown and the name is `Notifications`. The number is loaded when the signed-in layout opens, on every page change and after marking. The navigation number is not a live region, so list and dashboard pages keep one status region. If loading the number fails, the link has no number and the rest of the page stays usable.

The page `/notifications` has the heading **Notifications**.

| Element | Specification |
|---|---|
| List | Newest first. Each entry shows the message, the time and a link to the request. An unread entry shows the word `Unread` and a **Mark as read** button; colour or weight alone is not enough. |
| Messages | `{actor} submitted {number}: {item} for review.`, `{actor} approved {number}: {item}.`, `{actor} rejected {number}: {item}.`, `{actor} returned {number}: {item} for editing.` Shown as text, never as HTML. |
| Request link | Its accessible name contains the request number. Following the link of an unread entry also marks it as read; the request page opens even if marking fails. |
| Mark all | A **Mark all as read** button, shown while the unread count is above zero. |
| Loading | `Loading notifications...` |
| Empty | `No notifications.` |
| Load error | `Unable to load notifications.` and a **Retry** button. |
| Action error | The server message in a `role="alert"` element. The entry stays unread. |
| Announcements | A mounted polite `role="status"` region announces `Notification marked as read` or `All notifications marked as read`. |

The buttons are disabled while their call runs. Everything works with the keyboard in reading order. After **Mark as read** the focus moves to the request link of that entry. After **Mark all as read** the focus moves to the page heading. At 375, 768 and 1280 px there is no horizontal page scrolling, including the navigation and a 100-character item name.

The administrator has no link. If the administrator opens `/notifications`, the app redirects to `/admin/users`, the administrator's first screen, as it does for other pages of other roles.

## 3. API specification

All routes require a session of a requester or an approver. A `notification` in a response has exactly these fields:

```json
{
  "id": 31,
  "type": "APPROVED",
  "createdAt": "2026-11-28T03:00:00.000Z",
  "readAt": null,
  "actor": { "id": 3, "name": "Somchai" },
  "request": { "id": 12, "requestNumber": "PR-2026-0012", "itemName": "Laser printer" }
}
```

The item name is the current one. Reasons and comments are not copied into notifications; the request page shows them.

| Method and path | Request | Success |
|---|---|---|
| `GET /api/notifications` | none | 200 `{ "notifications": [notification], "unreadCount": 0 }` |
| `POST /api/notifications/:id/read` | no body needed | 200 `{ "notification": notification }` |
| `POST /api/notifications/read-all` | no body needed | 200 `{ "unreadCount": 0 }` |

- The list holds at most the 50 newest notifications the caller may see, newest first (`createdAt`, then `id`, both descending). `unreadCount` counts every unread notification the caller may see, also beyond the 50.
- Marking sets `readAt` to the server time. Marking an already read notification succeeds and keeps the first `readAt`.
- Mark all changes only the caller's unread notifications that the caller may see. A hidden one stays unread.
- A request body is ignored. No route creates, changes the content of, or deletes a notification.
- A method and path that are not in the table above keep the application's existing answer to an unknown route: status 404 with the framework's default body, not the JSON body of check 4. The application does not answer 405. Check 1 still comes first.

### Errors and order of checks

| Order | Applies to | Condition | Response |
|---|---|---|---|
| 1 | POST | `Origin` is not the client origin | 403 `{ "error": "Request origin not allowed." }` (existing behaviour) |
| 2 | all | No valid session | 401 (existing body) |
| 3 | all | The caller is an administrator | 403 `FORBIDDEN`, the same body as other wrong-role calls |
| 4 | mark one | The id is not a number, the notification does not exist, belongs to another user, or its request is not visible to the caller | 404 `{ "error": "Notification not found.", "code": "NOT_FOUND" }` |

Malformed JSON and a body over the existing 100 KB limit keep their existing answers, which can come before check 2. Error bodies follow NFR-04 and contain no request data.

The existing routes for submit, approve and reject, and the F-11 return route, keep their responses and error order.

## 4. Data and migration

One new table `Notification` and one new enum `NotificationType` (`SUBMITTED`, `APPROVED`, `REJECTED`, `RETURNED`):

| Column | Type | Rule |
|---|---|---|
| id | integer | primary key |
| recipientId | integer | foreign key to User, delete restricted |
| requestId | integer | foreign key to PurchaseRequest, delete cascades, indexed |
| actorId | integer | foreign key to User, delete restricted |
| type | NotificationType | not null |
| createdAt | timestamp | default now |
| readAt | timestamp | null while unread |

An index on `(recipientId, createdAt)` serves the list. The message text is built from `type`, the actor and the request, and is not stored.

The migration only adds the enum and the table. It creates no notifications for existing requests and changes no existing row. An earlier application revision keeps working with the new table present, but creates no notifications.

The `RETURNED` notification needs the F-11 route. The F-12 implementation therefore starts from a `staging` that contains F-11.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-180 | An unconfigured submit creates exactly one `SUBMITTED` notification, with the requester as actor, for each active approver except the requester, and none for the requester, administrator, another requester or inactive approver; a configured submit creates exactly one for the current step approver. |
| AC-181 | When an approver submits their own request, the other active approvers are notified and the submitter is not. |
| AC-182 | Final approval creates exactly one `APPROVED` notification and rejection exactly one `REJECTED` notification for the requester, with the deciding approver as actor; an intermediate F-13 approval notifies only the next step approver. |
| AC-183 | A return creates exactly one `RETURNED` notification for the requester, and submitting again creates new `SUBMITTED` notifications. |
| AC-184 | A refused or invalid submit, decision or return creates no notification. |
| AC-185 | Of simultaneous decisions and returns on one request, only the successful one creates a notification. |
| AC-186 | If creating the notifications fails during a submit, a decision or a return, the status and the history are unchanged. |
| AC-187 | Creating or editing a draft, cancelling, commenting and adding or removing an attachment create no notification. |
| AC-188 | The list returns only the caller's notifications with exactly the listed fields, newest first, at most 50, and `unreadCount` counts all visible unread ones. |
| AC-189 | A notification of a request the caller may not see is not listed, counted or changed. It is listed again, with the same `readAt`, when the request becomes visible again. |
| AC-190 | Marking sets `readAt` and lowers the count; marking again keeps the first `readAt`. |
| AC-191 | Marking another user's, a hidden, a missing or a non-numeric id gives 404 without data and changes nothing. |
| AC-192 | Mark all changes only the caller's visible unread notifications, including those beyond the 50 listed. |
| AC-193 | Without a session every route gives 401, the administrator gets 403, a POST from another origin gets 403, and nothing changes. |
| AC-194 | No route creates or deletes a notification, and values in a request body change nothing. |
| AC-195 | Notifications and their read state are still there after a new session. The migration creates none for existing requests and changes no existing row. |
| AC-196 | In the UI an approver sees the count after a requester submits, follows the link and sees the count fall; the requester later sees the decision. An item name with HTML characters is shown as text. |
| AC-197 | The UI shows the loading, empty and load-error with Retry states; a failed mark shows the error and keeps the entry unread; a failed count leaves the page usable. |
| AC-198 | The link has the accessible name with the unread count, unread is shown in words, the page works with the keyboard, marking is announced and focus is handled as in section 2. |
| AC-199 | At 375, 768 and 1280 px with a 100-character item name there is no horizontal page scrolling, and axe-core reports no serious or critical violation on the navigation and the page. |
| AC-200 | The administrator has no Notifications link, and opening `/notifications` redirects to `/admin/users`. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-211 | AC-180 | API integration | Two active approvers, one inactive approver, another requester and an administrator exist; a requester submits | Looking only at the rows of that request: their recipients are exactly the users who are active approvers at the time of the submit, read from the database, without the requester. Each recipient has exactly one row, of type `SUBMITTED`, with the requester as actor. Both active fixture approvers are among them; the inactive approver, the other requester, the administrator and the requester are not |
| TEST-212 | AC-181 | API integration | An approver submits their own request | The other fixture approver has a row; the submitter has none |
| TEST-213 | AC-182 | API integration | Approve one submitted request and reject another | One row of the right type for the requester each |
| TEST-214 | AC-183 | API integration | Return a submitted request, then submit it again | One `RETURNED` row for the requester, then new `SUBMITTED` rows for the approvers |
| TEST-215 | AC-184 | API integration | Incomplete submit, second submit, self-approval, decision on a decided request, rejection and return with a short reason, calls by wrong roles | Each is refused as before and adds no row |
| TEST-216 | AC-185 | API integration | At the same time, several times each: approve against reject, and return against approve | One succeeds each time; exactly one notification for the requester, of the winning type |
| TEST-217 | AC-186 | API integration | Force the notification insert to fail during a submit, during a decision and during a return | Each call fails with the safe 500 body; the status, `submittedAt`, `decidedAt`, the history and the notification rows of the request are unchanged |
| TEST-218 | AC-187 | API integration | Create, edit, comment, add and remove an attachment, cancel | The number of notification rows does not change |
| TEST-219 | AC-188 | API integration | A user with 55 notifications, some read, and another user with their own | 50 newest of the caller only, in order, with exact fields; `unreadCount` counts the unread among all 55 |
| TEST-220 | AC-189 | API integration | A request is submitted, so approvers A and B each have a notification, and B marks theirs as read. Then, in order: return; submit again; change B to requester and back to approver; return again; the owner cancels the draft | After each return: the approvers' rows are not listed or counted, and marking one answers 404. After submitting again: the earlier and the new rows are listed. While B is a requester: B sees none of them; as approver again: B sees them. After cancelling: the earlier rows are listed and no row was added by cancelling. In every step no existing row is edited or deleted, and B's `readAt` is kept |
| TEST-221 | AC-190 | API integration | Mark one notification twice | `readAt` is set once and kept; the count falls by one |
| TEST-222 | AC-191 | API integration | Another user's id, a hidden one, an unknown id and `abc` | 404 with the notification body; no row changes |
| TEST-223 | AC-192 | API integration | The caller has 55 visible unread notifications and one hidden unread one; another user has unread ones; call mark all | All 55, including the 5 not listed, get `readAt`; `unreadCount` is 0 in the response and in the next list; the hidden one and the other user's rows stay unread |
| TEST-224 | AC-193 | API integration | All three routes without a session and as administrator; both POSTs with a foreign Origin | 401, 403, 403; no row changes |
| TEST-225 | AC-194 | API integration | `POST /api/notifications` and `DELETE /api/notifications/:id` with the client origin; mark with `recipientId`, `readAt` and `type` in the body | The first two answer status 404, the existing answer to an unknown route (only the status is checked), and add or remove no row; the mark uses server values only |
| TEST-226 | AC-195 | API integration and migration check | Read with a new session; apply the migration to a database that already has requests | Same data; no notification created; existing row counts and checksums unchanged |
| TEST-227 | AC-196 | Browser end to end | Requester submits an item with HTML characters in its name; approver reads it, then approves; requester looks | Counts, links, read state and messages as stated; the name is text and no dialog opens |
| TEST-228 | AC-197 | Browser end to end | Delay and fail the list, then Retry; fail a mark; fail the count call on another page | Each state shows its text; the entry stays unread; the other page works |
| TEST-229 | AC-198 | Browser end to end | Use only the keyboard to open the page, mark one and mark all | Accessible names, the word Unread, announcements and focus as specified |
| TEST-230 | AC-199 | Browser responsive and accessibility | A 100-character item name at 375, 768 and 1280 px; run axe on the navigation and the page | No horizontal page overflow; no serious or critical violation |
| TEST-231 | AC-200 | Browser end to end | Sign in as administrator and open `/notifications` | No Notifications link; the address becomes `/admin/users` |

## 7. Definition of Done

- This contract is reviewed and approved before implementation. A later change gets a new version and a change-log entry.
- Tests are written first. The red output (against the code without the feature) and the green output are stored under `docs/sprints/sprint-2/tdd/`; a test that guards a new rule fails without the feature.
- Every AC has its test, and the server suite, client tests, type check and build pass.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-2/test-output/`. Browser tests are run locally because CI does not run Playwright.
- The migration is additive and applies to a database that already has data.
- The SRS, feature inventory, traceability matrix and System SDS agree with the implementation, and the Sprint 2 results table records every AC, test, actual result and commit.
- The implementation Pull Request closes the F-12 Issue, is reviewed and approved by Thanwarat before merge, and is merged into `staging`.
