# Email via Google Apps Script — setup guide

This lets the system send real emails (email verification, forgot/reset
password, task-assignment and status-change notifications) through a Gmail
account, with no SMTP server, no App Password, and no third-party email
provider account needed. It's the recommended option for this system —
follow SMTP setup instead only if you'd rather use Gmail SMTP, SendGrid,
Mailgun, etc. (see `backend/.env.example`).

Takes about 5 minutes.

## 1. Create the Apps Script project

1. Go to **https://script.google.com/** and sign in with the Google/Gmail
   account you want emails to be sent *from* (a dedicated account like
   `mwss.ro.notifications@gmail.com` is a good idea, rather than a personal
   inbox — it'll be the "From" address people see).
2. Click **New project**.
3. Delete the placeholder code in the editor, then paste in the entire
   contents of `EmailSender.gs` (in this same folder).
4. Rename the project (top-left, click "Untitled project") to something
   like **MWSS RO Email Relay**.

## 2. Set a shared secret (recommended)

A Web App deployed with "Anyone" access is a public URL — without a check,
anyone who found it could send email through your Google account. Set a
secret so only this app's backend can use it:

1. In the Apps Script editor, click the **gear icon** (Project Settings) in
   the left sidebar.
2. Scroll to **Script Properties** → **Add script property**.
3. Property: `SHARED_SECRET`. Value: any long random string you make up
   (e.g. generate one with `openssl rand -hex 24` on your machine, or just
   mash the keyboard for 30+ characters).
4. Save. You'll put this same value in the backend's `.env` file in step 4.

## 3. Deploy as a Web App

1. Click **Deploy** (top-right) → **New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. The first time, Google will ask you to **authorize** the script (it
   needs permission to send email as you) — click through the consent
   screen. You may see an "unverified app" warning since this is your own
   private script; click **Advanced** → **Go to (project name)** to
   proceed.
6. Copy the **Web app URL** shown after deploying — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

If you ever edit `EmailSender.gs` later, you need to create a **new
deployment version** (Deploy → Manage deployments → edit → new version) for
the changes to take effect on the existing URL.

## 4. Configure the backend

In `backend/.env` (copy from `backend/.env.example` if you haven't
already), set:

```
APPS_SCRIPT_EMAIL_URL=https://script.google.com/macros/s/AKfycb.../exec
APPS_SCRIPT_SECRET=the-same-random-string-from-step-2
```

Leave `SMTP_HOST` blank — Apps Script is tried first automatically, and
whichever one is configured with a real value takes effect (see
`backend/src/email.js` for the exact fallback order: Apps Script → SMTP →
console log).

Restart the backend (`npm run start` or `pm2 restart mwss-pms`) and the
next verification email, password reset, or task-assignment notification
will send for real.

## Good to know

- **Sender address:** Emails always send *from* the Gmail address you
  deployed the script under — Apps Script's `MailApp` can't send as an
  arbitrary "From" address. The `displayName` the backend sends (your
  brand name) shows as the sender's display name, but the underlying email
  address is still your Gmail account. If you need a fully custom sending
  domain/address, use SMTP with a transactional provider instead.
- **Daily send limit:** A regular Gmail account can send about 100 emails
  per day through `MailApp`/`GmailApp` (higher — around 1,500/day — on a
  Google Workspace account). Fine for an internal office tool; if you
  outgrow it, switch to SMTP with a transactional provider (see
  `backend/.env.example`).
- **Testing the deployment directly:** open the Web app URL in a browser —
  you should see `{"ok":true,"message":"MWSS RO email relay is running..."}`.
  If you see a Google sign-in page instead, double check "Who has access"
  is set to "Anyone" in the deployment settings.
