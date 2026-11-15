# PurchaseFlow UAT cases (prepared, not yet executed)

User acceptance testing means real users who did not build the system try it against their own goals. In this course it happens in Lab 6, when another team tests the released version. These cases are prepared for that. **No result below is filled in, because no UAT has been done.** Never fill a result without a real tester.

Release under test: (record the tag or commit). Test accounts: the demo accounts of the README, handed over privately or created by the documented seed.

| UAT ID | Kind | User goal | Preconditions | Steps | Expected result | Actual result | PASS or FAIL | Tester | Version | Defect link |
|---|---|---|---|---|---|---|---|---|---|---|
| UAT-01 | Normal journey | As a requester I want to ask for equipment and learn the answer | Seed loaded; requester and approver accounts | 1. Log in as a requester. 2. Create a request with all fields. 3. Submit it. 4. Log out, log in as an approver, approve with a comment. 5. Log in as the requester again | The requester sees status Approved, the total, and three history entries including the comment | | | | | |
| UAT-02 | Rule and boundary | As an approver I must give a reason when I refuse, and a draft needs a reason and category to be submitted | A submitted request; a draft without reason | 1. Try to submit the incomplete draft. 2. As an approver open the submitted request, press Reject. 3. Confirm with an empty reason. 4. Type 4 characters, confirm. 5. Type 5 characters, confirm | Step 1 is refused naming the missing fields; steps 3 and 4 are refused and the request stays submitted; step 5 rejects it | | | | | |
| UAT-03 | Role and ownership | As a requester I must not see or decide other people's requests | Two requesters, one request of requester A; an approver's own submitted request | 1. Log in as requester B. 2. Look for a Review link. 3. Open the address of A's request. 4. Open `/reviews`. 5. As the approver, try to approve their own request | No Review link; request not found; sent back to My requests; the approver's own request cannot be approved | | | | | |
| UAT-04 | State, history and persistence | As a requester I want my request and its history to be there after I come back | A decided request | 1. Reload the page. 2. Log out and log in again. 3. Open the request. 4. Try to edit it | Same status, total, reason and ordered history; no edit form | | | | | |
| UAT-05 | Administrator | As the administrator I want to stop a user from using the system | Demo accounts | 1. Log in as the administrator. 2. Deactivate a requester. 3. Try to log in as that requester. 4. Activate again. 5. Try to deactivate your own account | The user is refused at login; after activation login works; there is no control for your own account | | | | | |

Record a defect (expected, actual, severity, steps) for every FAIL, and re-test the fixed version.
