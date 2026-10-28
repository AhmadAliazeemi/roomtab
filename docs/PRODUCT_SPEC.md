# RoomTab — Product Specification (MVP)

## Vision
Replace the handwritten hostel canteen notebook with a minimalist shared ledger for roommates, starting with one four-person room and allowing more rooms and users later.

## Decisions confirmed
- Product: RoomTab, an installable PWA designed for Android home screens; no Play Store publishing required.
- Theme: soft wheat/cream, muted green accents, minimalist, fast data entry.
- Sign-in: Google and email/password.
- Membership: room creator is admin; members join using an invitation link/code; admin can remove active membership without deleting history.
- Shared meals: all active room members selected by default; recorder deselects people who did not eat. Split equally by default; support individual expense and custom shares.
- Timing: save meals immediately; new meal entries can be backdated up to seven days, while actual creation time is preserved.
- Expenses: members may correct their own entries; change/deletion is recorded in activity history.
- Canteen debt: one combined balance for the room. Record each canteen payment amount, date, payer, and recorder. Full payment credits the person who paid; overpayments can produce a personal credit.
- Reimbursements: optional per-room setting, kept distinct from canteen payments.
- Payment corrections: allowed to the original recorder or room admin; changes remain in the activity history.
- Months: room admin reviews and closes the month; old monthly records remain separate; unpaid balances carry forward overall. Corrections after closing require reopening by admin and an activity record.
- Reminders: each account has its own on/off and preferred-time setting. Scheduled notifications are future work.
- Online-first MVP. Offline entry/sync is future work.
- Initial platform: Firebase Authentication, Cloud Firestore and Firebase Hosting on the Spark no-cost plan, with usage limits understood.

## Primary workflows
1. User signs up/signs in, creates a room or joins by invitation.
2. Member records a shared meal, personal meal or custom split.
3. Roommates see the shared ledger and their calculated shares.
4. Any room member records a canteen payment and names the payer.
5. The dashboard derives room debt and individual net balances from meal shares, canteen payments, and optional reimbursements.
6. Admin reviews and closes a month. A later correction requires reopening and leaves an audit entry.

## Core calculations
- Room canteen balance = sum of non-deleted food expenses − sum of non-deleted canteen payments.
- Personal net balance = personal meal shares − canteen payments made by that person + reimbursements received − reimbursements sent.
- Positive personal net means still owed/contributed less than their share; negative personal net means credit.
- Roommate reimbursements never reduce the room's canteen debt again.
- Equal splits are calculated in cents so individual shares add up exactly to the recorded total.

## Not in this release
- Native APK/iOS binary, Play Store publishing, bank/mobile-wallet payment processing, receipt scanning, AI features, scheduled push notifications, offline conflict synchronization, and opening-balance import from a previous notebook.

## Before using real money records
Test Firebase rules with separate accounts, room isolation, custom/equal split arithmetic, payment credits, late entries, edit/delete audit logs, month closing/reopening, and member removal. Use the paper notebook in parallel for one month and export/back up records regularly. This starter is not a formally audited financial system.
