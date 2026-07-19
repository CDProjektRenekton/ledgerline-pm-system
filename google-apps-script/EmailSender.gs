/**
 * MWSS RO Project Workspace — email relay
 *
 * Deploy this as a Web App (see README.md in this folder for exact steps).
 * The backend POSTs { to, subject, text, html, displayName, secret } here
 * as JSON, and this script sends the email through whichever Google
 * account it's deployed under, using MailApp.
 *
 * Why a shared secret: a Web App deployed with "Who has access: Anyone" is
 * a public URL. Without a check here, anyone who found the URL could send
 * arbitrary email through your Google account. Set SHARED_SECRET below (or
 * as a Script Property) and put the same value in the backend's
 * APPS_SCRIPT_SECRET environment variable.
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No request body received" });
    }
    var data = JSON.parse(e.postData.contents);

    var expectedSecret = getSharedSecret();
    if (expectedSecret && data.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Invalid or missing secret" });
    }

    if (!data.to || !data.subject) {
      return jsonResponse({ ok: false, error: "Missing required field: 'to' or 'subject'" });
    }

    var options = {};
    if (data.html) options.htmlBody = data.html;
    if (data.displayName) options.name = data.displayName;

    MailApp.sendEmail(data.to, data.subject, data.text || "", options);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// Lets you sanity-check the deployment URL directly in a browser —
// visiting the URL should show { ok: true, message: "..." }.
function doGet(e) {
  return jsonResponse({ ok: true, message: "MWSS RO email relay is running. POST to this URL to send email." });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Reads the shared secret from Script Properties (File > Project settings >
// Script properties in the Apps Script editor). Falls back to the constant
// below only if you'd rather hard-code it — Script Properties is safer
// since it's not visible in code you might paste/share.
function getSharedSecret() {
  var fromProperties = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (fromProperties) return fromProperties;
  return ""; // e.g. "a-long-random-string-you-choose" — leave blank to disable the check (not recommended)
}
