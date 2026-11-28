# Feature contract F-05: Administrator, user management

Contract version 2.1. Written before implementation.

Linked requirements: FR-15. Rules: BR-13, BR-16. Depends on: F-01.

## Change log
| Version | Date | Change |
|---|---|---|
| 2.0 | Before implementation | Initial administrator contract. |
| 2.1 | 28 November 2026 | F-13 revision: a current or waiting step of a submitted request protects its approver from deactivation or role change; cancelled requests do not block users. |

## 1. Feature design

Behavior: the administrator lists the user accounts, deactivates or reactivates an account, and changes its role. A deactivated user cannot log in, and an existing session of that user stops working at once. The administrator cannot change their own account, so the system cannot lose its last way of administration by accident.

Rules:
- Only role ADMIN may use these routes (403 for others).
- `isActive` must be a boolean; `role` must be REQUESTER, APPROVER or ADMIN (422 otherwise). At least one of them is required.
- Changing the administrator's own account (any field) gives 409 `SELF_CHANGE`.
- A user id that does not exist gives 404.
- Passwords are not managed here (no reset in Sprint 1) and the response never contains `passwordHash`.

Errors:

| Case | Status | Code |
|---|---|---|
| Not an administrator | 403 | `FORBIDDEN` |
| Unknown user id | 404 | `NOT_FOUND` |
| Invalid `isActive` or `role`, or no field | 422 | `VALIDATION_ERROR` |
| The administrator changes their own account | 409 | `SELF_CHANGE` |

## 2. UI specification

`/admin/users` (administrator only; others are redirected): a table of users (name, e-mail, role, status Active or Inactive). Each row except the administrator's own has a role selector and an Activate or Deactivate button. The administrator's own row shows that it cannot be changed. The navigation bar of an administrator shows Users and All requests.

## 3. API specification

`GET /api/admin/users` response 200: `{ "users": [ { "id", "name", "email", "role", "isActive", "createdAt" } ] }` ordered by name.

`PATCH /api/admin/users/:id` request: `{ "isActive": false }` or `{ "role": "APPROVER" }`. Response 200: `{ "user": { ... } }`.

## 4. Data

Updates `User.isActive` and `User.role`. No schema change. Deactivation needs no session deletion because every protected route checks `isActive`.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-39 | The administrator lists the users without any password hash. A requester or an approver gets 403 and no data. |
| AC-40 | After the administrator deactivates a user, that user cannot log in, and the session they already had returns 401 on the next call. |
| AC-41 | The administrator can reactivate a user, who can then log in; and can change a role to a valid value; an invalid role gives 422. A user assigned to a `CURRENT` or `WAITING` step of an F-13 request that is `SUBMITTED` cannot be deactivated or moved out of APPROVER (`409 APPROVER_IN_USE`); cancelled requests do not block. |
| AC-42 | The administrator cannot deactivate or change the role of their own account (409 `SELF_CHANGE`); nothing changes. |
| AC-43 | An unknown user id gives 404; an empty or invalid body gives 422. |
| AC-44 | In the browser: the administrator sees the users, deactivates one and the status changes, and cannot change their own row; a requester who opens `/admin/users` is redirected and the API gives 403. |
| AC-45 | F-13 protection: deactivation or role change is refused for CURRENT and WAITING approvers of a SUBMITTED request, and is allowed after cancel, reject, final approval or return. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-61 | AC-39 | API integration | Logged-in administrator | GET admin users | 200; each user has id, name, e-mail, role, isActive; no `passwordHash` anywhere in the body |
| TEST-62 | AC-39 | API integration | Logged in as a requester, then an approver | GET admin users; PATCH a user | 403; no `users`; the user is unchanged |
| TEST-63 | AC-40 | API integration | A user who is logged in | The administrator deactivates them; they call me; they try to log in | 200 on the PATCH; 401; 401 |
| TEST-64 | AC-41 | API integration | A deactivated user | The administrator reactivates them; they log in | 200; login works |
| TEST-65 | AC-41 | API integration | A requester | Change role to APPROVER; then to `BOSS`, to `""`, and send `{}` | 200 with the new role; 422 for the invalid ones; role unchanged |
| TEST-66 | AC-42 | API integration | Logged-in administrator | PATCH own id with `isActive: false` and with `role: "REQUESTER"` | 409 `SELF_CHANGE`; the administrator can still use the API |
| TEST-67 | AC-43 | API integration | Logged-in administrator | PATCH id 999999 and `abc`; PATCH with `isActive: "yes"` | 404; 404; 422 |
| TEST-68 | AC-45 | API integration | Users assigned to CURRENT/WAITING steps and requests in each later state | PATCH active/role | 409 `APPROVER_IN_USE` while submitted; 200 after cancel, reject, final approval or return |
| TEST-75 | AC-44 | UI end to end | Seeded accounts | The administrator deactivates a requester (status changes); the requester can no longer log in; the administrator's own row is locked; a requester opens `/admin/users` | Status text changes; login refused; no controls on the own row; redirect and 403 |
