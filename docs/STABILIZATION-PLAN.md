# My MBA Room — Stabilization plan

This document tracks the first low-risk stabilization pass. It does not claim that the app is production-ready.

## Changes in this branch
- Updates user-visible branding to **My MBA Room** in the app, browser title, PWA manifest, and package metadata.
- Adds **History** to the five-item mobile navigation and adjusts the mobile grid to fit it.
- Changes the monthly-closing snapshot so `monthly_net` describes that month's expenses minus that month's payments, while `remaining` records the overall room balance at the time of closing. This preserves the distinction between monthly activity and carried-forward debt.

## Before deploying
1. Pull this branch and run `npm install`.
2. Run `npm run build`; fix any build error before deployment.
3. Test in local preview with demo mode.
4. Test Firebase using two separate accounts and a test room before using real money.
5. Do not deploy Firestore rule changes until the rule tests pass. This branch has not yet changed the database rules.

## Required accounting tests
- Four members split a Rs. 1,000 meal; all shares add to exactly Rs. 1,000.
- A Rs. 2,000 canteen payment decreases room debt by Rs. 2,000 and credits the payer in the personal ledger.
- A Rs. 500 roommate reimbursement changes the two roommates' balances but does not decrease canteen debt again.
- Month A leaves an unpaid balance; Month B records new meals and a payment. The month B activity summary must remain distinct from the overall carried-forward room balance.
- Deleted expenses/payments are excluded from active totals but remain visible in history.
- Closing a month blocks changes to that month's expenses and payments until an authorized admin reopens it.

## Security tests required before real use
- A non-member cannot read any room collection.
- A member cannot grant themselves admin privileges or change another member's role.
- Meal share participants must be active room members; shares must reconcile to the meal total.
- Payment payer must be an active member; edits must preserve the original recorder.
- Closed-month records cannot be modified by members or admins unless the month is explicitly reopened.
- Activity records cannot be fabricated independently of a financial mutation.
- Removing a member revokes access to all room data.

## Known work still outstanding
- Stronger Firestore validation and automated Firebase Emulator security-rule tests.
- Atomic and trustworthy room-create/join audit events.
- Automated accounting tests and CI build checks.
- Test Google and email authentication against the actual Firebase project and authorized domains.
- Android phone QA for keyboard overlap, tap target sizes, installation, and navigation.
- Reminder preferences are stored, but scheduled notifications are not implemented.
- Large-room pagination/query limits and an opening-balance migration workflow are not implemented.

## Important
The current client calculates balances from recorded transactions. Until accounting tests and Firestore authorization tests are complete, use this app as a pilot and verify the canteen settlement against the notebook or receipt.
