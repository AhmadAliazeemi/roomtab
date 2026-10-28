# My MBA Room — Stabilization plan

This document tracks stabilization and verification work. Passing CI does not by itself mean the app is production-ready.

## Changes in this branch
- Updates user-visible branding to **My MBA Room** in the app, browser title, PWA manifest, and package metadata.
- Adds **History** to the five-item mobile navigation and adjusts the mobile grid to fit it.
- Moves equal splits and room/person/month accounting calculations into a tested accounting module that uses integer cents internally.
- Validates custom shares against the rounded meal total to the exact cent and rejects meal/payment/reimbursement amounts that round below one cent.
- Ensures month-close calculations use the same accounting helper, including legacy date-based month fallback; monthly activity remains separate from the overall carried-forward debt.
- Keeps `monthly_net` as that month's expenses minus that month's payments, while `remaining` records the overall room balance at close.
- Strengthens Firestore document validation and links activity-log writes to their matching transactions and room operations in the same batch.
- Adds emulator tests for authorization, exact-cent share reconciliation, date/month consistency, closed-month enforcement, atomic room create/join logs, and administrator-only closing.

## Before deploying
1. Pull the latest `master` and run `npm ci`.
2. Run `npm audit`, `npm run test:accounting`, `npm run test:security`, and `npm run build`.
3. Run the rules suite with `npx --yes firebase-tools@15.30.2 emulators:exec --only firestore --project demo-my-mba-room "npm run test:rules"`.
4. Test in local preview and then test Firebase with two separate accounts in a disposable room before using real money.
5. Deploy rules only after the emulator suite and the live-project smoke test both pass; no Firebase deployment is performed by these CI checks.

## Accounting tests now automated
Run `npm run test:accounting` to verify equal-split remainders, duplicate participant normalization, invalid sub-cent/empty splits, personal payment and reimbursement math, deleted-entry exclusion, date-based legacy month fallback, and monthly closing snapshots.

## Required accounting tests
- Four members split a Rs. 1,000 meal; all shares add to exactly Rs. 1,000 (automated).
- A Rs. 2,000 canteen payment decreases room debt by Rs. 2,000 and credits the payer in the personal ledger (automated math coverage).
- A Rs. 500 roommate reimbursement changes the two roommates' balances but does not decrease canteen debt again (automated math coverage).
- Month A leaves an unpaid balance; Month B records new meals and a payment. The month B activity summary remains distinct from the overall carried-forward room balance (automated).
- Deleted expenses/payments are excluded from active totals but remain visible in history (automated).
- Closing a month blocks changes to that month's expenses and payments until an authorized admin reopens it.

## Security Rules emulator tests
The `npm run test:rules` suite runs the actual `firestore.rules` file in the Firestore Emulator. CI also runs the accounting and deepmerge regression suites before the production build. The tests cover allowed and denied examples, not every possible Firebase write path.

## Security rules covered by emulator tests
- A non-member cannot read room documents or expense records.
- A member cannot grant themselves admin privileges or edit another member's expense.
- Meal share amounts must reconcile to the exact total in cents, use unique participants, and refer to active members.
- Canteen payments require an active payer, and the payment record and its audit log must be atomic.
- Meal/payment dates must match their month key, and closed-month meal changes are denied.
- Activity logs for tested transaction actions cannot be written independently of the matching transaction.
- Room creation and joining are tested as atomic member/index/invite/activity batches; closing is administrator-only.

## Known work still outstanding
- The seven-day backdating window is enforced by the current client, not independently by Firestore Rules; date/month consistency and closed-month restrictions are enforced in rules.
- Run a two-account smoke test against the actual Firebase project, including Google/email authentication domains, invite regeneration, member removal/rejoin, month reopen/reclose, and payment corrections.
- Review legacy records that include removed members before attempting to edit them under the stricter active-participant rules.
- Android phone QA for keyboard overlap, tap target sizes, installation, and navigation.
- Reminder preferences are stored, but scheduled notifications are not implemented.
- Large-room pagination/query limits and an opening-balance migration workflow are not implemented.

## Important
The current client calculates balances from recorded transactions. Use the app as a pilot and verify canteen settlement against the notebook or receipt until the live Firebase and Android checks are complete.
