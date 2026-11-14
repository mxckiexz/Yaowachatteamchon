# Feature contract F-01: Authentication and session (with R-01, R-02)

Contract version 1.1. Version 1.0 was written before implementation.

Revision 1.1 (before F-01 implementation): TEST-12 now uses POST logout instead of POST create request, because the create route does not exist until F-02. The check is the same: a foreign Origin is rejected with 403. The anonymous check of every protected route (AC-08, TEST-11) is written when the last protected route exists, in the F-04 branch.

Linked requirements: FR-01, NFR-01, NFR-02, NFR-03, NFR-04, NFR-05, NFR-06. Rules: none of BR-01 to BR-11 apply directly. Depends on: R-01 (database, seed, configuration).

## 1. Feature design

Behavior: a seeded user logs in with e-mail and password. The server verifies the password against a bcrypt hash, creates a session row and sets a cookie. The user can read their identity and log out. Every protected route requires a valid session.

Workflow:
1. User submits e-mail and password.
2. Server looks up the user by lower-cased e-mail and always runs one bcrypt comparison (against a dummy hash if the user does not exist).
3. If the user exists, is active, and the password matches, the server creates a session (8 hours) and returns the user.
4. Later requests carry the cookie; protected routes load the session and user, or respond 401.
5. Logout deletes the session and clears the cookie.

Validation and errors:

| Case | Status | Body |
|---|---|---|
| Missing e-mail or password | 422 | `{ error, fields }` |
| Wrong password, unknown e-mail, or inactive user | 401 | `{ error: "Invalid email or password." }` (identical for all three) |
| Expired, unknown or missing session on a protected route | 401 | `{ error: "Authentication required." }` |
| Foreign or missing Origin on a state-changing request | 403 | `{ error: "Request origin not allowed." }` |
| Malformed JSON body | 400 | `{ error: "Malformed request body." }` |
| Unexpected failure | 500 | `{ error: "Something went wrong." }` (no stack trace) |

Permissions: login is public. `me` and `logout` need a session. `GET /api/health` is public and returns no private data.

## 2. UI specification

Screen `/login`: fields E-mail and Password, a Log in button, an error message area. On success go to `/requests`. On failure show "Invalid email or password." and keep the e-mail. While waiting disable the button. The navigation bar (all other screens) shows the user's name, role and a Logout button. Logout returns to `/login`. Visiting a protected route without a session redirects to `/login`.

## 3. API specification

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | 200 `{ user: { id, name, email, role } }` and `Set-Cookie: buyflow_session=...; HttpOnly; SameSite=Lax; Path=/` | 401, 403, 422 |
| `POST /api/auth/logout` | none | 204, cookie cleared | 403 |
| `GET /api/auth/me` | none | 200 `{ user: { id, name, email, role } }` | 401 |
| `GET /api/health` | none | 200 `{ status: "ok" }` | none |

The response never contains `passwordHash`.

## 4. Data

`User` and `Session` as in the System SDS section 2. Migration `init` creates both. Seed creates four accounts with bcrypt hashes.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-01 | Login with correct credentials returns 200, the user (id, name, email, role), sets an HttpOnly session cookie, and the body has no password hash. |
| AC-02 | Login with a wrong password, and login with an unknown e-mail, both return 401 with the same message. |
| AC-03 | `GET /api/auth/me` with a valid session returns the current user; without a session it returns 401. |
| AC-04 | After logout the old cookie gives 401 on `me`. Logging out twice does not fail. |
| AC-05 | A session past its expiry time gives 401. |
| AC-06 | Passwords are stored as bcrypt hashes with cost 10 or higher; the stored value differs from the plaintext; verification accepts the right password and rejects a wrong one. |
| AC-07 | An inactive user cannot log in (same 401 message as AC-02). |
| AC-08 | Every protected route (`/api/auth/me`, `/api/approvers`, `/api/requests` GET and POST, `/api/requests/:id`, `/api/requests/:id/submit`, `/api/requests/:id/decision`, `/api/reviews`) returns 401 without a session and the body contains no data. |
| AC-09 | A state-changing request with a foreign Origin returns 403 even with a valid session. |
| AC-10 | In the browser: a valid login reaches the request list; an invalid login shows the error; logout returns to the login screen. |
| AC-33 | Malformed JSON returns 400 with a JSON error that contains no stack trace. |
| AC-34 | `GET /api/health` returns 200 `{ status: "ok" }` without a session. |

## 6. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-01 | AC-01 | API integration | Seeded active user | POST login with correct credentials | 200; body user fields; cookie HttpOnly; no `passwordHash` in body |
| TEST-02 | AC-02 | API integration | Seeded user | POST login with wrong password | 401, message "Invalid email or password." |
| TEST-03 | AC-02 | API integration | No such e-mail | POST login | 401 with exactly the same body as TEST-02 |
| TEST-04 | AC-03 | API integration | Logged in | GET me | 200 with the same user |
| TEST-05 | AC-03 | API integration | No cookie | GET me | 401 |
| TEST-06 | AC-04 | API integration | Logged in | POST logout, GET me with the old cookie, POST logout again | 204; 401; 204 |
| TEST-07 | AC-05 | API integration | Session row whose expiresAt is in the past | GET me | 401 |
| TEST-08 | AC-06 | Unit | none | hashPassword then verifyPassword (right, wrong) | Hash starts with `$2`, cost at least 10, differs from plaintext; right true, wrong false |
| TEST-09 | AC-06 | API integration | Seeded users | Read stored `passwordHash` values | None equals the demo password; all start with `$2` |
| TEST-10 | AC-07 | API integration | User with isActive false | POST login with correct password | 401, same message as TEST-02 |
| TEST-11 | AC-08 | API integration | No cookie | Call every protected route (table of method and path) | Each returns 401; body has only the `error` field |
| TEST-12 | AC-09 | API integration | Logged in | POST logout with Origin `http://evil.example` | 403 and the session is still valid (me returns 200) |
| TEST-41 | AC-33 | API integration | none | POST login with a malformed JSON body | 400; body is JSON with an `error` string; no `stack`; no "at " trace text |
| TEST-42 | AC-34 | API integration | No cookie | GET health | 200 `{ status: "ok" }` |
| TEST-45 | AC-10 | UI end to end | Seeded accounts | Log in wrongly, then correctly, then log out | Error text shown; list page shown; login page shown |
