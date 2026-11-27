# Feature contract F-09: Attachments

Contract version 1.0, 27 November 2026. Contract only, for review before implementation. Tracks Issue #57 and implements FR-19.

Linked requirements: FR-19, BR-12, BR-22, BR-23, NFR-01, NFR-02, NFR-04, NFR-05, NFR-07, NFR-09 and NFR-10. Depends on F-02 (draft and ownership) and uses the F-04 visibility rules for reading. If a later feature (for example F-11) adds a request status in which the owner may edit, this contract must be revised before attachments can be changed in that status.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 27 November 2026 | Initial F-09 contract proposed for review. Attachment content is stored in PostgreSQL instead of the object storage that System SDS 2.0 expected (reason in section 4). |

## 1. Feature design

The owner of a draft attaches supporting files, for example a quotation, to the request. Everyone who may see the request may list and download its files. Files can be added or removed only while the request is a draft, so an approver decides on a fixed set of files.

New business rules:

- **BR-22:** An attachment is a PDF, PNG or JPEG file of 1 to 5,242,880 bytes (5 MB). The file name extension and the file content must agree. A request has at most 5 attachments.
- **BR-23:** Only the request owner can add or remove an attachment, and only while the request is a DRAFT. Reading attachments follows BR-12.

Attachments are optional. Adding or removing one does not change the request status and does not add a history entry (BR-11 covers status changes only).

Out of scope: virus scanning, preview or thumbnails, renaming or replacing a file, files on comments, a total storage quota, file versions and bulk download. The missing virus scan is a known limitation: the application only checks the type signature, so people who download a file must treat it as untrusted.

## 2. UI specification

The request detail page has a section with the heading **Attachments**. A new request gets attachments after it has been saved as a draft.

| Element | Specification |
|---|---|
| List | One row per file, oldest first: file name, size (KB or MB), uploader name, upload time, and a **Download** link whose accessible name includes the file name. |
| Add (owner of a draft only) | A file input labelled **Add attachment** that accepts `.pdf,.png,.jpg,.jpeg`, the help text `PDF, PNG or JPG, up to 5 MB each, at most 5 files.`, and an **Upload** button. The button is disabled while no file is chosen and while an upload runs. |
| Delete (owner of a draft only) | A **Delete** button per row whose accessible name includes the file name. It asks for confirmation, naming the file, with **Confirm delete** and **Keep file**. |
| Limit | With 5 files the input and button are disabled and the text `This request already has 5 attachments.` is shown. |
| Read only | Everyone else, and the owner of a request that is not a draft, sees the list and Download links only. No add or delete control is rendered. |
| Loading | `Loading attachments...` |
| Empty | `No attachments.` |
| Load error | `Unable to load attachments.` and a **Retry** button. The rest of the request page stays usable. |
| Action error | The server message (and the field message for 422) appears next to the control in a `role="alert"` element. The list stays as it was. |
| Announcements | A mounted polite `role="status"` region announces `Uploading`, `Attachment uploaded` and `Attachment deleted`. |

Checks in the browser (extension, size) only help the user. The server decides.

Everything works with the keyboard in reading order. After a delete, focus moves to the Attachments heading. At 375, 768 and 1280 px there is no horizontal page scrolling, also with a file name of 100 characters.

## 3. API specification

All routes require a session. `attachment` in a response has exactly these fields:

```json
{
  "id": 7,
  "fileName": "quotation.pdf",
  "fileType": "application/pdf",
  "sizeBytes": 48213,
  "uploadedBy": { "id": 1, "name": "Ploy" },
  "createdAt": "2026-11-27T10:00:00.000Z"
}
```

| Method and path | Success |
|---|---|
| `GET /api/requests/:id/attachments` | 200 `{ "attachments": [attachment] }`, oldest first (`createdAt`, then `id`). Never contains file content. |
| `POST /api/requests/:id/attachments` | 201 `{ "attachment": attachment }` |
| `GET /api/requests/:id/attachments/:attachmentId` | 200 with the stored bytes |
| `DELETE /api/requests/:id/attachments/:attachmentId` | 204, empty body |

### Upload format

The body is the raw file with `Content-Type: application/octet-stream`. The file name is sent in the header `X-File-Name`, percent-encoded UTF-8. A header is used instead of a query parameter so that file names do not appear in request URLs and URL logs. No multipart library is added. Only these two inputs are read; the type, size, uploader and time are set by the server.

File name rules, applied after decoding and trimming: 1 to 100 characters; no `/`, `\` or control characters (U+0000 to U+001F, U+007F); the extension is `.pdf`, `.png`, `.jpg` or `.jpeg`, in any letter case. Two files may have the same name.

Content rules: the stored type comes from the first bytes of the file and must agree with the extension.

| Extension | First bytes | Stored type |
|---|---|---|
| `.pdf` | `25 50 44 46 2D` (`%PDF-`) | `application/pdf` |
| `.png` | `89 50 4E 47 0D 0A 1A 0A` | `image/png` |
| `.jpg`, `.jpeg` | `FF D8 FF` | `image/jpeg` |

### Download headers

`Content-Type` is the stored type. `Content-Disposition` is always `attachment` (never `inline`), with `filename="attachment.<ext>"` as the plain fallback and `filename*=UTF-8''<percent-encoded name>` following RFC 5987 (`'`, `(`, `)` and `*` are also encoded). `Content-Length` is the stored size, `Cache-Control` is `private, no-store`, and `X-Content-Type-Options: nosniff` stays set.

### Errors and order of checks

Checks run in the order below. The first failure answers.

| Order | Applies to | Condition | Response |
|---|---|---|---|
| 1 | POST, DELETE | `Origin` is not the client origin | 403 `{ "error": "Request origin not allowed." }` (existing behaviour) |
| 2 | all | No valid session | 401 (existing body) |
| 3 | GET | The request does not exist or the caller may not see it (BR-12) | 404 `NOT_FOUND` |
| 3 | POST, DELETE | The request does not exist or the caller is not its owner | 404 `NOT_FOUND`, the same rule as editing a draft in F-02 |
| 4 | download, DELETE | The attachment does not exist or belongs to another request | 404 `NOT_FOUND` |
| 5 | POST, DELETE | The request is not a DRAFT | 409 `NOT_EDITABLE`, `Attachments can be changed only on a draft.` |
| 6 | POST | `Content-Type` is not `application/octet-stream` | 415 `UNSUPPORTED_MEDIA_TYPE`, `Send the file as application/octet-stream.` |
| 7 | POST | The body is larger than 5,242,880 bytes | 413 `FILE_TOO_LARGE`, `The file is larger than 5 MB.` |
| 8 | POST | Bad file name | 422 `VALIDATION_ERROR`, `fields.fileName` |
| 8 | POST | Empty file, type not allowed, or content does not match the extension | 422 `VALIDATION_ERROR`, `fields.file` |
| 9 | POST | The request already has 5 attachments | 409 `ATTACHMENT_LIMIT`, `A request can have at most 5 attachments.` |

The file body is read only after checks 1 to 6 pass, so an anonymous or unauthorized caller cannot make the server hold a file in memory. The existing 100 KB JSON limit applies to JSON bodies as before; the 5 MB limit applies only to the upload route. Error bodies follow NFR-04: no stack trace and no database detail. No error body contains file content or data of a request the caller may not see.

### Transactions

Upload and delete run in one database transaction that first locks the request row (`SELECT ... FOR UPDATE`), then checks again that the request is a DRAFT, then (for upload) counts the attachments and inserts. This keeps the limit of 5 under simultaneous uploads and prevents a change after a simultaneous submit or cancel.

## 4. Data and migration

One new table `Attachment`:

| Column | Type | Rule |
|---|---|---|
| id | integer | primary key |
| requestId | integer | foreign key to PurchaseRequest, delete cascades, indexed |
| fileName | text | not null |
| fileType | text | not null, one of the three stored types |
| sizeBytes | integer | not null, CHECK between 1 and 5242880 |
| content | bytea | not null |
| uploadedById | integer | foreign key to User, delete restricted |
| createdAt | timestamp | default now |

The application never deletes a purchase request; the cascade only serves database cleanup such as test fixtures. List and detail queries must not select `content`.

The migration only adds a table. Existing rows are not changed, and an earlier application revision keeps working with the new table present.

**Storage decision.** System SDS 2.0 expected object storage because Cloud Run has no lasting local disk. The course portal gives the team a Cloud Run service, a Cloud SQL database, an image repository and secrets, and no storage bucket. Storing the bytes in PostgreSQL keeps the files across restarts and deployments, saves a file and its record in one transaction, uses the same permission checks as the request and needs no new cloud permission. The cost is database growth and larger backups. The limits of BR-22 bound one request to 25 MB. There is no limit across requests; moving to object storage is the change to make if volume grows.

## 5. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-117 | The owner of a draft uploads a valid PDF and gets 201 with the attachment fields; the file is stored and the response has no content. |
| AC-118 | Valid PNG and JPEG files are accepted, including `.jpeg` and upper-case extensions; the stored type follows the file content. |
| AC-119 | A type that is not allowed, or content that does not match the extension, gives 422 with `fields.file`, and nothing is stored. |
| AC-120 | A file of exactly 5,242,880 bytes is accepted, 5,242,881 bytes gives 413 `FILE_TOO_LARGE`, an empty body gives 422, and refused files are not stored. |
| AC-121 | A missing, badly encoded, blank, 101-character or path or control-character file name gives 422 with `fields.fileName`; a 100-character name is accepted, and a Thai name is stored unchanged. |
| AC-122 | An upload whose `Content-Type` is not `application/octet-stream` gives 415 and stores nothing. |
| AC-123 | The sixth upload gives 409 `ATTACHMENT_LIMIT`; of two simultaneous uploads to a request with 4 files, exactly one succeeds. |
| AC-124 | Upload and delete on a SUBMITTED, APPROVED, REJECTED or CANCELLED request give 409 `NOT_EDITABLE`, and the attachments do not change. |
| AC-125 | When the request leaves DRAFT while an upload or delete is waiting, the attachment change is refused with 409 and nothing changes. |
| AC-126 | Another requester, an approver and an administrator who are not the owner get 404 on upload and delete, and nothing changes. |
| AC-127 | Without a session all four routes give 401 without data; a POST or DELETE from another origin gives 403 and changes nothing. |
| AC-128 | The list returns the attachment fields only, oldest first, and an empty array when there are none. |
| AC-129 | Reading follows BR-12: the owner, an approver for a non-draft request and the administrator can list and download; any other caller, including an approver on another user's draft, gets 404 with no attachment data. |
| AC-130 | A download returns the same bytes that were uploaded, with the download headers of section 3, also for a name with Thai text, spaces and quotes. |
| AC-131 | An attachment id used under another request's URL gives 404 for download and delete, also when the caller may see both requests. |
| AC-132 | The owner deletes an attachment of a draft and gets 204; it is gone from the list and from download, and a second delete gives 404. |
| AC-133 | The client cannot set the type, size, uploader or time; a file name with HTML or SQL characters is stored and shown as text and runs nothing. |
| AC-134 | Attachments are still there after a new session and after the request is submitted, approved, rejected or cancelled, and stay readable under BR-12. |
| AC-135 | Adding or removing a file changes no status and adds no history entry, and a draft can be submitted with or without attachments. |
| AC-136 | The owner of a draft can list, upload and delete in the UI; delete happens only after confirmation, and **Keep file** keeps it. |
| AC-137 | Other users, and the owner of a request that is not a draft, see the list and Download links and no add or delete control. |
| AC-138 | The UI shows the loading, empty, load-error with Retry, action-error and 5-file states with the texts of section 2. |
| AC-139 | Upload, download and delete work with the keyboard, controls have labels that name the file, announcements use the mounted status region, and focus is handled as in section 2. |
| AC-140 | At 375, 768 and 1280 px, with a 100-character file name, there is no horizontal page scrolling, and axe-core reports no serious or critical violation on the section. |

## 6. Software test specification

All files used in tests are small synthetic bytes made by the test code. No real document is committed.

| Test | AC | Level | Precondition and input | Expected result |
|---|---|---|---|---|
| TEST-148 | AC-117 | API integration | Owner uploads PDF bytes to a draft | 201, exact response fields, one database row with the same bytes |
| TEST-149 | AC-118 | API integration | Upload `.png`, `.jpg`, `.jpeg` and `.PDF` files with matching content | All 201 with the expected stored type |
| TEST-150 | AC-119 | API integration | Upload a `.txt` file, a `.svg` file, an executable header named `.pdf`, and PNG bytes named `.pdf` | Each 422 with `fields.file`; row count unchanged |
| TEST-151 | AC-120 | API integration | PDF bytes of length 5,242,880 and 5,242,881, and an empty body | 201, 413 `FILE_TOO_LARGE`, 422; only the first is stored |
| TEST-152 | AC-121 | Unit and API integration | No header, `%E0%A4%A`, spaces only, 101 characters, `a/b.pdf`, `a\b.pdf`, `a%0A.pdf`; then 100 characters and a Thai name | Bad names 422 with `fields.fileName`; the last two 201 and unchanged |
| TEST-153 | AC-122 | API integration | Upload as `application/pdf` and as `text/plain` | 415; nothing stored |
| TEST-154 | AC-123 | API integration | Upload 5 files and a sixth; then, with 4 files, send two uploads at the same time | Sixth 409 `ATTACHMENT_LIMIT`; of the two exactly one 201 and one 409; 5 rows |
| TEST-155 | AC-124 | API integration | Owner uploads and deletes on requests in the four non-draft states | All 409 `NOT_EDITABLE`; rows unchanged |
| TEST-156 | AC-125 | API integration | The test sets the status to SUBMITTED in its own transaction without committing (this locks the row), sends an upload, waits until the database shows the call waiting for the lock, then commits; repeat with a delete on a reset draft | The waiting call answers 409; rows unchanged |
| TEST-157 | AC-126 | API integration | Another requester, an approver and an administrator upload and delete on a draft and on a submitted request | All 404 `NOT_FOUND`; rows unchanged |
| TEST-158 | AC-127 | API integration | All four routes without a session; POST and DELETE with a foreign Origin | 401 with no data; 403; rows unchanged |
| TEST-159 | AC-128 | API integration | List with zero and with three files | Empty array; three entries oldest first with only the listed fields |
| TEST-160 | AC-129 | API integration | Owner, other requester, approver and administrator list and download on a draft and on a submitted request | Allowed and 404 results match BR-12; 404 bodies have no attachment data |
| TEST-161 | AC-130 | API integration | Upload a file with a Thai name containing spaces, `'`, `"` and `()`, then download | Byte-identical body and all download headers |
| TEST-162 | AC-131 | API integration | Request A's attachment id under request B, both visible to the caller | 404 for download and delete; the file remains |
| TEST-163 | AC-132 | API integration | Owner deletes, lists, downloads and deletes again | 204, absent, 404, 404 |
| TEST-164 | AC-133 | API and browser | Send extra headers and query values for type, size and uploader; use the name `<img src=x onerror=alert(1)>';--.pdf` | Server values are used; the name is returned and shown as text; no dialog opens |
| TEST-165 | AC-134 | API integration | Upload, then submit and approve one request, reject one, cancel one; read with a new session | Same files and bytes, readable under BR-12 |
| TEST-166 | AC-135 | API integration | Compare status and history before and after upload and delete; submit a draft with and one without files | No change from file actions; both submits succeed |
| TEST-167 | AC-136 | Browser end to end | Owner uploads a file, deletes with **Keep file**, then with **Confirm delete** | File appears, stays, then disappears; still correct after reload |
| TEST-168 | AC-137 | Browser end to end | Approver and administrator open a submitted request with a file; owner opens it too | Download link present; no add or delete control |
| TEST-169 | AC-138 | Browser end to end | Delay and fail the list call, then Retry; upload a refused file; reach 5 files | Each state shows its text; the list stays after an action error |
| TEST-170 | AC-139 | Browser end to end | Use only the keyboard to upload, download and delete | Reading-order focus, labelled controls, announcements, focus on the heading after delete |
| TEST-171 | AC-140 | Browser responsive and accessibility | A 100-character name at 375, 768 and 1280 px, for the owner and the read-only view; run axe on the section | No horizontal page overflow; no serious or critical violation |

## 7. Definition of Done

- This contract is reviewed and approved before implementation. A later change gets a new version and a change-log entry.
- Tests are written first. The red output (against the code without the feature) and the green output are stored under `docs/sprints/sprint-2/tdd/`; a test that guards a new rule fails without the feature.
- Every AC has its test, and the server suite, client tests, type check and build pass.
- Raw server and Playwright terminal output is stored under `docs/sprints/sprint-2/test-output/`. Browser tests are run locally because CI does not run Playwright.
- The migration is additive and applies to a database that already has data.
- The SRS, feature inventory, traceability matrix and System SDS agree with the implementation, and the Sprint 2 results table records every AC, test, actual result and commit.
- The implementation Pull Request closes the F-09 Issue, is reviewed and approved by Thanwarat before merge, and is merged into `staging`.
