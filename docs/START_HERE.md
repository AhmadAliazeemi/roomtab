# RoomTab — Start Here

Welcome! RoomTab is your first version of the hostel canteen tracker. We will do this one step at a time.

## Step 1 — Open the project

1. Download the RoomTab starter ZIP and extract it.
2. Open Visual Studio Code.
3. Select **File → Open Folder** and choose the extracted `roomtab` folder.
4. Select **Terminal → New Terminal**.
5. Run these commands, one at a time:

   ```bash
   node --version
   npm --version
   npm install
   npm run dev
   ```

6. Open the localhost address shown in the terminal (usually `http://localhost:5173`).

You should see a sample RoomTab dashboard. This is preview mode. It is saved only in that browser and isn't visible on your roommates' phones yet.

## Step 2 — Do not set up login/database until the preview opens

Once the local page opens, continue with `SETUP.md` to create a free Firebase project. We chose Firebase because free Supabase projects can pause after a week of inactivity. Firebase Spark is a better fit for this particular tiny project because its included Authentication, Firestore, and Hosting quotas do not depend on activity over a 7-day window. The free quota is still limited; no provider can guarantee a forever-free service.

## Step 3 — Keep secrets safe

Never share `.env.local`, any service-account JSON file, private keys, or account passwords. The Firebase Web App config is designed to be placed in a browser application, but it must be protected by the Firestore rules in this project. Do not publish the app until you have deployed and tested the rules.

## What to send me if a step fails

Copy the exact error text from the VS Code terminal, or upload a screenshot that shows the full error. Don't share passwords, private keys, tokens, or billing details. We'll fix one issue at a time.
