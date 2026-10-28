# RoomTab — Hostel Canteen Ledger

RoomTab is a minimalist, installable, mobile-first app for hostel roommates who share canteen meals. It replaces the paper notebook with a shared ledger for food expenses, personal shares, canteen payments, optional roommate reimbursements, month-end closing, and activity history.

## Updated hosting choice: Firebase Spark

The first draft used Supabase Free. Supabase documents that inactive free projects may pause after about seven days, so this revised starter uses **Firebase Authentication + Cloud Firestore + Firebase Hosting** instead. Firebase's no-cost Spark plan does not require a billing account to use the included free services and quotas. Firebase documents a Firestore free allowance of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, and 10 GiB outbound transfer/month; Firebase Hosting includes 10 GB storage and 10 GB/month data transfer at no cost. These limits and the providers' terms can change, and a service can stop serving requests if its free quota is exhausted. This is not a promise of unlimited or permanent free hosting.

Official references:
- Firebase plans: <https://firebase.google.com/docs/projects/billing/firebase-pricing-plans>
- Firestore quotas: <https://firebase.google.com/docs/firestore/quotas>
- Firebase Hosting quotas: <https://firebase.google.com/docs/hosting/usage-quotas-pricing>
- Firebase email/password login: <https://firebase.google.com/docs/auth/web/password-auth>
- Firebase Google login: <https://firebase.google.com/docs/auth/web/google-signin>

## Features in this starter

- Email/password and Google sign-in.
- Create a room or join one with a room invitation link/code.
- Shared meals: one person records the total, all active members are selected by default, and the amount is divided equally among selected participants.
- Individual meal entries and custom shares.
- Meal backdating for the previous seven days for new entries; the meal date and actual creation time are stored separately.
- Room-level canteen debt, payments recording both who paid and who entered the payment, individual member credits, and outstanding balances.
- Optional roommate-to-roommate reimbursement tracking; reimbursements do not reduce the canteen debt a second time.
- Meal corrections and payment corrections appear in an append-only activity log. Only an expense's recorder or the room admin can change an expense; only the payment recorder or room admin can change a canteen payment.
- Admin-reviewed month closing, preserved month summaries, and unpaid balances carried forward in overall balances.
- Per-person reminder preference settings. **Scheduled push notifications are not implemented yet.**
- Wheat/cream background, muted green accents, mobile responsive layout, and PWA install support.
- Local preview mode so the UI can be explored before Firebase is configured. Preview data is saved only in that browser and is not shared between phones.

## Run locally

Requirements: Node.js 22 LTS or newer and Visual Studio Code.

1. Extract this project ZIP.
2. Open the extracted `roomtab` folder in VS Code (`File → Open Folder`).
3. Open `Terminal → New Terminal` and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the localhost URL printed by Vite, usually `http://localhost:5173`.

Without Firebase settings, RoomTab runs in local preview mode. Do not use local preview data as the live room ledger.

## Connect Firebase

Read [`docs/SETUP.md`](docs/SETUP.md) from top to bottom. Short version:

1. Create a Firebase project on the Spark (no-cost) plan.
2. Add a Web App and copy its web config.
3. Enable Email/Password and Google providers in Firebase Authentication.
4. Create a Cloud Firestore database.
5. Copy `.env.example` to `.env.local` and add the Firebase Web App config values.
6. Publish the provided `firestore.rules`.
7. Test with two separate accounts before using real canteen records.

The Firebase web config values are used by a browser app; they are not Admin SDK credentials. **Never place a service-account JSON or Admin SDK private key in this project or `.env.local`.** The data is protected by the Firestore Security Rules. Still, the rules and app require careful testing before treating the ledger as authoritative.

## Deploy a public link without the Play Store

RoomTab is an installable Progressive Web App (PWA), not a native APK. Once deployed to Firebase Hosting, it receives a `web.app` / `firebaseapp.com` URL that your roommates can open in Chrome and add to their Android home screens. There is no need to pay for a Google Play developer account to share this link.

Follow the Firebase Hosting steps in [`docs/SETUP.md`](docs/SETUP.md). The actual public URL is not created until you deploy it from your own Firebase account.

## Important limits and next steps

- Free quotas are generous for a small hostel group, but not unlimited. On Spark, if a quota is exceeded, the relevant service can stop accepting requests until the allowance resets or the project is moved to a paid plan. Do not attach a billing account if you cannot accept pay-as-you-go charges.
- Firebase free services do not promise permanent availability, future pricing, or a backup SLA. Keep regular exports of important financial records. The free Firestore tier does not include every backup/restore feature.
- Push notifications, true offline entry/synchronization, and opening-balance import from an old notebook are not implemented yet.
- This is a learning/MVP starter, not a financial product audit. Test calculations against hand-worked examples, test the Firestore rules, and keep the old notebook in parallel during the first month.
- In production, consider a controlled opening-balance entry if you're switching before the previous canteen bill is settled. Do not just delete the old debt or mix it into meal expenses.

## Project files

```text
roomtab/
├── src/App.tsx                 Main user interface and ledger flows
├── src/lib/firebase.ts         Firebase browser SDK initialization
├── src/styles.css              Soft-wheat responsive theme
├── public/icons/               PWA icons
├── firestore.rules             Room-scoped access-control rules
├── firestore.indexes.json      Firestore index configuration
├── firebase.json               Firebase Hosting + rules configuration
├── .env.example                Firebase Web config template
└── docs/                       Beginner setup guide and product spec
```
