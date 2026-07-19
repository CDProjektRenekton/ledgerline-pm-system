// Sends transactional email (verification, password reset, task
// notifications). Tries transports in this order:
//   1. Google Apps Script Web App (APPS_SCRIPT_EMAIL_URL) — recommended,
//      since it sends through a real Gmail account with zero SMTP setup.
//      See /google-apps-script/README.md for the 5-minute deploy steps.
//   2. Traditional SMTP (SMTP_HOST) — Gmail App Password, SendGrid, etc.
//   3. Console log — so the app keeps working in local/dev environments
//      without crashing or requiring real credentials.
const nodemailer = require("nodemailer");

const BRAND = process.env.APP_BRAND_NAME || "MWSS RO Project Workspace";
const FROM_EMAIL = process.env.FROM_EMAIL || `${BRAND} <no-reply@mwss-ro.local>`;

let transporter = null;
let attemptedInit = false;

function getTransporter() {
  if (attemptedInit) return transporter;
  attemptedInit = true;

  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/STARTTLS
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Posts to a Google Apps Script Web App deployment. Returns null (rather
// than throwing) when it's not configured or the call fails, so the caller
// can fall back to SMTP/console instead of hard-failing the request.
async function sendViaAppsScript({ to, subject, text, html }) {
  const url = process.env.APPS_SCRIPT_EMAIL_URL;
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow", // Apps Script /exec URLs 302 to script.googleusercontent.com
      body: JSON.stringify({
        to,
        subject,
        text,
        html,
        displayName: BRAND,
        secret: process.env.APPS_SCRIPT_SECRET || undefined,
      }),
      signal: controller.signal,
    });

    let body = null;
    try { body = await res.json(); } catch { /* tolerate a non-JSON response */ }

    if (!res.ok || (body && body.ok === false)) {
      throw new Error((body && body.error) || `Apps Script responded with HTTP ${res.status}`);
    }
    return { sent: true, via: "apps-script" };
  } catch (err) {
    console.error(`Apps Script email send failed, falling back to SMTP/console: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Single core sender used by every specific email function below. Keeping
// one function here means the Apps-Script/SMTP/console fallback chain only
// has to be written once.
async function sendEmail({ to, subject, text, html }) {
  const viaScript = await sendViaAppsScript({ to, subject, text, html });
  if (viaScript) return viaScript;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no APPS_SCRIPT_EMAIL_URL or SMTP_HOST configured] Would send to ${to}: "${subject}"`);
    return { sent: false, mode: "console-fallback" };
  }
  try {
    await t.sendMail({ from: FROM_EMAIL, to, subject, text, html });
    return { sent: true, via: "smtp" };
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendAssignmentEmail({ to, recipientName, taskTitle, projectName, assignedByName }) {
  const subject = `You've been assigned a task: ${taskTitle}`;
  const text = `Hi ${recipientName},\n\n${assignedByName} assigned you a task in "${projectName}":\n\n  ${taskTitle}\n\nLog in to ${BRAND} to see the details.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p><strong>${assignedByName}</strong> assigned you a task in <strong>${projectName}</strong>:</p>
      <p style="background:#EEF6FC; border-left:3px solid #1A7FA8; padding:10px 14px; font-weight:600;">
        ${taskTitle}
      </p>
      <p>Log in to ${BRAND} to see the full details.</p>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

async function sendReminderEmail({ to, recipientName, taskTitle, projectName, type }) {
  const isOverdue = type === "overdue";
  const subject = isOverdue ? `Overdue: ${taskTitle}` : `Due soon: ${taskTitle}`;
  const lead = isOverdue ? "is now overdue" : "is due within 24 hours";
  const text = `Hi ${recipientName},\n\nYour task "${taskTitle}" in "${projectName}" ${lead}.\n\nLog in to ${BRAND} to take a look.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Your task in <strong>${projectName}</strong> ${lead}:</p>
      <p style="background:${isOverdue ? "#FBEAE2" : "#EEF6FC"}; border-left:3px solid ${isOverdue ? "#9C4221" : "#1A7FA8"}; padding:10px 14px; font-weight:600;">
        ${taskTitle}
      </p>
      <p>Log in to ${BRAND} to take a look.</p>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

async function sendPasswordResetEmail({ to, recipientName, resetUrl }) {
  const subject = `Reset your ${BRAND} password`;
  const text = `Hi ${recipientName},\n\nSomeone requested a password reset for your account. If this was you, reset your password here:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Someone requested a password reset for your account. If this was you, click below:</p>
      <p><a href="${resetUrl}" style="display:inline-block; background:#1A7FA8; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Reset password</a></p>
      <p style="font-size:12px; color:#6B92AD;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

async function sendVerificationEmail({ to, recipientName, verifyUrl }) {
  const subject = `Verify your ${BRAND} email address`;
  const text = `Hi ${recipientName},\n\nThanks for signing up! Please verify your email address by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Thanks for signing up to <strong>${BRAND}</strong>! Please verify your email address:</p>
      <p><a href="${verifyUrl}" style="display:inline-block; background:#1A7FA8; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Verify email address</a></p>
      <p style="font-size:12px; color:#6B92AD;">This link expires in 24 hours.</p>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

async function sendStatusChangeEmail({ to, recipientName, taskTitle, projectName, oldStatus, newStatus, changedByName }) {
  const STATUS_LABEL = { todo: "To Do", inprogress: "In Progress", review: "In Review", done: "Done" };
  const subject = `Task status updated: ${taskTitle}`;
  const text = `Hi ${recipientName},\n\n${changedByName} moved "${taskTitle}" in "${projectName}" from ${STATUS_LABEL[oldStatus] || oldStatus} to ${STATUS_LABEL[newStatus] || newStatus}.\n\nLog in to ${BRAND} to see the full details.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p><strong>${changedByName}</strong> updated a task in <strong>${projectName}</strong>:</p>
      <p style="background:#EEF6FC; border-left:3px solid #1A7FA8; padding:10px 14px; font-weight:600;">${taskTitle}</p>
      <p style="font-size:13px; color:#0B2233;">
        <span style="background:#DCF0FB; padding:2px 8px; border-radius:4px;">${STATUS_LABEL[oldStatus] || oldStatus}</span>
        &nbsp;→&nbsp;
        <span style="background:#1A7FA8; color:#fff; padding:2px 8px; border-radius:4px;">${STATUS_LABEL[newStatus] || newStatus}</span>
      </p>
      <p>Log in to ${BRAND} to see the full details.</p>
    </div>
  `;
  return sendEmail({ to, subject, text, html });
}

module.exports = { sendAssignmentEmail, sendReminderEmail, sendPasswordResetEmail, sendVerificationEmail, sendStatusChangeEmail };
