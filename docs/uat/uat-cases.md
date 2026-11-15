# BuyFlow UAT cases (prepared, not yet executed)

User acceptance testing means real users who did not build the system try it against their own goals. In this course it happens in Lab 6, when another team tests the released version. These cases are prepared for that. **No result below is filled in, because no UAT has been done.** Never fill a result without a real tester.

Release under test: (record the tag or commit). Test accounts: the demo accounts of the README, handed over privately or created by the documented seed.

| UAT ID | Kind | User goal | Preconditions | Steps | Expected result | Actual result | PASS or FAIL | Tester | Version | Defect link |
|---|---|---|---|---|---|---|---|---|---|---|
| UAT-01 | Normal journey | As an employee I want to ask for office supplies and learn the answer | Seed loaded; employee and approver accounts | 1. Log in as an employee. 2. Create a request with two items. 3. Submit it to an approver. 4. Log out, log in as that approver, approve with a comment. 5. Log in as the employee again | The employee sees status Approved, the comment, the total and three history entries | | | | | |
| UAT-02 | Rule and boundary | As an approver I must give a reason when I refuse | A pending request assigned to the approver | 1. Open the request. 2. Press Reject. 3. Confirm with an empty reason. 4. Type 4 characters, confirm. 5. Type 5 characters, confirm | Steps 3 and 4 are refused with a message and the request stays pending; step 5 rejects it | | | | | |
| UAT-03 | Role and ownership | As an employee I must not see or decide other people's requests | Two employees, one request of employee A | 1. Log in as employee B. 2. Look for a Review link. 3. Open the address of A's request. 4. Open `/reviews` | No Review link; request not found; sent back to My requests | | | | | |
| UAT-04 | State, history and persistence | As a requester I want my request and its history to be there after I come back | A decided request | 1. Reload the page. 2. Log out and log in again. 3. Open the request | Same status, total, comment and ordered history | | | | | |

Record a defect (expected, actual, severity, steps) for every FAIL, and re-test the fixed version.
