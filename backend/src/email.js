// Sends task-assignment emails via SMTP (Gmail, SendGrid, Mailgun, Resend, etc.).
// If no SMTP_HOST is set in the environment, emails are logged to the console
// instead of sent — so the app keeps working in local/dev environments
// without crashing or requiring real credentials.
const nodemailer = require("nodemailer");

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

async function sendAssignmentEmail({ to, recipientName, taskTitle, projectName, assignedByName }) {
  const subject = `You've been assigned a task: ${taskTitle}`;
  const text = `Hi ${recipientName},\n\n${assignedByName} assigned you a task in "${projectName}":\n\n  ${taskTitle}\n\nLog in to Ledgerline to see the details.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p><strong>${assignedByName}</strong> assigned you a task in <strong>${projectName}</strong>:</p>
      <p style="background:#F6F2E9; border-left:3px solid #C9A227; padding:10px 14px; font-weight:600;">
        ${taskTitle}
      </p>
      <p>Log in to Ledgerline to see the full details.</p>
    </div>
  `;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP_HOST configured] Would send to ${to}: "${subject}"`);
    return { sent: false, mode: "console-fallback" };
  }

  try {
    await t.sendMail({
      from: process.env.FROM_EMAIL || "Ledgerline <no-reply@ledgerline.app>",
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send assignment email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendReminderEmail({ to, recipientName, taskTitle, projectName, type }) {
  const isOverdue = type === "overdue";
  const subject = isOverdue ? `Overdue: ${taskTitle}` : `Due soon: ${taskTitle}`;
  const lead = isOverdue ? "is now overdue" : "is due within 24 hours";
  const text = `Hi ${recipientName},\n\nYour task "${taskTitle}" in "${projectName}" ${lead}.\n\nLog in to Ledgerline to take a look.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Your task in <strong>${projectName}</strong> ${lead}:</p>
      <p style="background:${isOverdue ? "#FBEAE2" : "#F6F2E9"}; border-left:3px solid ${isOverdue ? "#9C4221" : "#C9A227"}; padding:10px 14px; font-weight:600;">
        ${taskTitle}
      </p>
      <p>Log in to Ledgerline to take a look.</p>
    </div>
  `;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP_HOST configured] Would send to ${to}: "${subject}"`);
    return { sent: false, mode: "console-fallback" };
  }
  try {
    await t.sendMail({ from: process.env.FROM_EMAIL || "Ledgerline <no-reply@ledgerline.app>", to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send reminder email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendPasswordResetEmail({ to, recipientName, resetUrl }) {
  const subject = "Reset your Ledgerline password";
  const text = `Hi ${recipientName},\n\nSomeone requested a password reset for your account. If this was you, reset your password here:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Someone requested a password reset for your account. If this was you, click below:</p>
      <p><a href="${resetUrl}" style="display:inline-block; background:#1F6F78; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Reset password</a></p>
      <p style="font-size:12px; color:#8B8680;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode, no SMTP_HOST configured] Would send to ${to}: "${subject}" -> ${resetUrl}`);
    return { sent: false, mode: "console-fallback" };
  }
  try {
    await t.sendMail({ from: process.env.FROM_EMAIL || "Ledgerline <no-reply@ledgerline.app>", to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send password reset email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendVerificationEmail({ to, recipientName, verifyUrl }) {
  const subject = "Verify your Ledgerline email address";
  const text = `Hi ${recipientName},\n\nThanks for signing up! Please verify your email address by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p>Thanks for signing up to <strong>Ledgerline</strong>! Please verify your email address:</p>
      <p><a href="${verifyUrl}" style="display:inline-block; background:#1F6F78; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:600;">Verify email address</a></p>
      <p style="font-size:12px; color:#8B8680;">This link expires in 24 hours.</p>
    </div>
  `;
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode] Verification link for ${to}: ${verifyUrl}`);
    return { sent: false, mode: "console-fallback" };
  }
  try {
    await t.sendMail({ from: process.env.FROM_EMAIL || "Ledgerline <no-reply@ledgerline.app>", to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send verification email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function sendStatusChangeEmail({ to, recipientName, taskTitle, projectName, oldStatus, newStatus, changedByName }) {
  const STATUS_LABEL = { todo: "To Do", inprogress: "In Progress", review: "In Review", done: "Done" };
  const subject = `Task status updated: ${taskTitle}`;
  const text = `Hi ${recipientName},\n\n${changedByName} moved "${taskTitle}" in "${projectName}" from ${STATUS_LABEL[oldStatus] || oldStatus} to ${STATUS_LABEL[newStatus] || newStatus}.\n\nLog in to Ledgerline to see the full details.`;
  const html = `
    <div style="font-family:sans-serif; max-width:480px;">
      <p>Hi ${recipientName},</p>
      <p><strong>${changedByName}</strong> updated a task in <strong>${projectName}</strong>:</p>
      <p style="background:#F6F2E9; border-left:3px solid #C9A227; padding:10px 14px; font-weight:600;">${taskTitle}</p>
      <p style="font-size:13px; color:#5C5747;">
        <span style="background:#E4DFD3; padding:2px 8px; border-radius:4px;">${STATUS_LABEL[oldStatus] || oldStatus}</span>
        &nbsp;→&nbsp;
        <span style="background:#1F6F78; color:#fff; padding:2px 8px; border-radius:4px;">${STATUS_LABEL[newStatus] || newStatus}</span>
      </p>
      <p>Log in to Ledgerline to see the full details.</p>
    </div>
  `;
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-mode] Would send status-change email to ${to}: "${subject}"`);
    return { sent: false, mode: "console-fallback" };
  }
  try {
    await t.sendMail({ from: process.env.FROM_EMAIL || "Ledgerline <no-reply@ledgerline.app>", to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`Failed to send status-change email to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendAssignmentEmail, sendReminderEmail, sendPasswordResetEmail, sendVerificationEmail, sendStatusChangeEmail };
