# RoomTab — Setup and Free Hosting Guide

This guide is written for a first-time developer. Please complete the steps in order. Do not skip Firestore Security Rules or enter real money records before testing with at least two separate user accounts.

## 1. Run the local preview

1. Install Node.js 22 LTS or newer from <https://nodejs.org/> if it is not already installed.
2. Extract the ZIP and open the `roomtab` folder in Visual Studio Code.
3. Choose **Terminal → New Terminal**.
4. Run:

   ```bash
   node --version
   npm --version
   npm install
   npm run dev
   ```

5. Open the localhost URL printed by Vite, commonly `http://localhost:5173`.

Without `.env.local`, the app runs in Preview mode. Preview changes are local to that browser and are not shared or backed up.

## 2. Create a Firebase project on the Spark plan

1. Open <https://console.firebase.google.com/> and sign in to your Google account.
2. Choose **Create a project** and name it `RoomTab` or another name you like.
3. Google Analytics is optional for this app; you can disable it for the simplest setup.
4. Keep the project on the **Spark no-cost plan**. Do not attach a billing account if you cannot accept any possibility of charges.
5. Open **Project settings** (gear icon) → **General** → **Your apps** → select the Web icon (`</>`) to register a web app. Give it a name such as `RoomTab Web`. You do not need Firebase Hosting selected at this moment if the console doesn't ask.
6. Firebase will show a web configuration block. Keep this page open; you need the `apiKey`, `authDomain`, `projectId`, and `appId` values.

Firebase Web config is not a server credential. Never download a service-account private key for this frontend project.

## 3. Enable sign-in providers

1. In Firebase Console, open **Build → Authentication** and choose **Get started** if prompted.
2. Open **Sign-in method** (or **Sign-in providers**).
3. Enable **Email/Password** and save.
4. Enable **Google**, select the support email if prompted, and save.
5. Under Authentication settings, make sure `localhost` is an authorized domain for local testing. Firebase Hosting domains are normally configured when the Hosting site is created; if sign-in later rejects the deployed domain, add the exact domain to **Authorized domains**.

The app currently supports email/password and Google popup sign-in. Phone/SMS sign-in is not in the first version.

## 4. Create the Firestore database

1. In Firebase Console, open **Build → Firestore Database**.
2. Choose **Create database** and select **Production mode**.
3. Choose a location reasonably close to the users. For users in Pakistan, Mumbai (`asia-south1`) or another nearby available Asian location is a sensible starting point. The location cannot easily be changed after creation, so choose carefully.
4. Finish database creation.
5. In VS Code, open the file `firestore.rules` from this project. Copy the entire file.
6. In Firebase Console → Firestore Database → **Rules**, replace the starter rules with the copied rules and click **Publish**.

The rules in the project are room-scoped: data reads require active room membership; room settings and month closing require the room administrator; payments record both the payer and recorder; historical records are soft-deleted rather than erased. Security rules are important and still need testing against your actual project before relying on the ledger.

## 5. Add your Firebase configuration locally

1. In VS Code's Explorer, copy `.env.example` and name the copy `.env.local`.
2. Open `.env.local` and replace the placeholders with the values from Firebase → Project settings → General → Your apps. The file should look like this (use your own values):

   ```dotenv
   VITE_FIREBASE_API_KEY=your-web-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your-web-app-id
   ```

3. Save the file. Stop the dev server in the terminal with `Ctrl+C`, then run `npm run dev` again.
4. The app should now display the login screen instead of local Preview mode.
5. Create your own account, create a room, and use a second browser profile or another phone to create a second account and join using the invitation link/code.

If a browser blocks popup authentication, allow popups for your local/deployed app or try the sign-in again.

### Check before using real data

- Create a test room with one account.
- Join it with a second account using the invite link or code.
- Confirm both accounts see the same meal after refresh.
- Confirm a room member cannot open another room's data.
- Create a shared meal with three participants and verify its shares add to the exact total.
- Record a canteen payment, and verify the room balance drops by precisely that payment amount.
- Test a correction, deletion, and month close/reopen.
- Compare the totals to manual arithmetic before using the app for actual settlement.

## 6. Host the app at a public link with Firebase Hosting

Firebase Hosting can serve the static PWA at a `web.app`/`firebaseapp.com` URL on its free allowance. No Play Store developer account is needed. For this client-only project, deploy from the same computer with the Firebase CLI:

1. Install the Firebase CLI. In the VS Code terminal, run:

   ```bash
   npm install -g firebase-tools
   ```

2. Log in:

   ```bash
   firebase login
   ```

3. In Firebase Console, make sure the project you created is selected. In your project folder, copy `.firebaserc.example` and rename the copy to `.firebaserc`. Open it and replace `YOUR_FIREBASE_PROJECT_ID` with your actual Firebase project ID (not the project display name).
4. Confirm `.env.local` contains the correct configuration values for that same project.
5. Deploy Hosting and Firestore rules:

   ```bash
   npm run deploy
   ```

   The script builds the app, then deploys the static output and Firestore rules. If it fails, read the first error line carefully. Some environments require a second login/authorization prompt.

6. When deployment succeeds, the terminal displays your public Hosting URL, commonly `https://YOUR_PROJECT_ID.web.app`. Open it on your phone. In Chrome, choose **Install app** or **Add to Home screen** from the browser menu.
7. Test Google and email sign-in again from the hosted URL. If needed, add the exact hosted domain under Firebase Authentication → Settings → Authorized domains.

After changing source code, run `npm run deploy` again to build and publish the update.

## 7. Free-plan expectations

Official current docs to review before deployment:

- Firebase pricing plans: <https://firebase.google.com/docs/projects/billing/firebase-pricing-plans>
- Firestore usage quotas: <https://firebase.google.com/docs/firestore/quotas>
- Firebase Hosting quota/pricing: <https://firebase.google.com/docs/hosting/usage-quotas-pricing>
- Email/password authentication: <https://firebase.google.com/docs/auth/web/password-auth>
- Google sign-in: <https://firebase.google.com/docs/auth/web/google-signin>

Firebase Spark has no-cost quotas, including a Firestore free tier of 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, and 10 GiB/month outbound transfer; Firebase Hosting includes 10 GB storage and 10 GB/month data transfer. These limits can change, and the relevant service can be unavailable after a quota is used up for the month/day. Keep the app lightweight, avoid repeated refreshes, and check the usage console. Do **not** attach a billing account if you cannot accept potential charges.

Supabase free projects can pause after a week of low activity, per <https://supabase.com/docs/guides/platform/free-project-pausing>. That is why this starter now uses Firebase. This does not mean Firebase is guaranteed free forever: providers can change terms, quotas, or products.

## 8. Backups and safe first launch

- Keep the paper notebook for the first month while you compare app totals with the real canteen ledger.
- Choose an agreed settlement date to start using RoomTab. If you still owe money from an earlier month, record a reviewed opening balance before switching; this opening-balance workflow is not yet implemented in the starter.
- Export or otherwise back up important records regularly. The Firestore free tier does not include every managed backup/restore capability.
- Store no real money history in Preview mode. It is only browser-local sample data.
- The reminder switch saves each person's preference but does not yet deliver scheduled push notifications.
- Offline meal entry and automatic synchronization are not implemented in this first release.
