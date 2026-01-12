/**
 * FlowForge Automation — Project 1: Lead Intake
 * Day 2 Script
 *
 * What it does:
 * - On Form Submit: generate Lead ID (FF-YYYYMMDD-####)
 * - Clean fields
 * - Append to LEADS tab
 * - Send confirmation email to lead
 * - Send notification email to owner (subject starts with "New lead —")
 * - Log actions in LOGS tab
 *
 * REQUIRED SHEETS:
 * - LEADS (with headers in row 1)
 * - CONFIG (Key/Value in A/B)
 * - LOGS (headers in row 1)
 *
 * REQUIRED CONFIG KEYS (CONFIG!A2:A):
 * - OWNER_EMAIL
 * - FROM_NAME
 * - REPLY_TIME_WINDOW
 * - SHEET_LINK
 * - DEFAULT_STATUS
 */


// =========================
// ✅ RUN THIS ONCE (after paste)
// =========================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();


  // Validate required sheets
  const leads = ss.getSheetByName("LEADS");
  const config = ss.getSheetByName("CONFIG");
  const logs = ss.getSheetByName("LOGS");
  if (!leads || !config || !logs) {
    throw new Error('Missing a required sheet. You must have tabs named: LEADS, CONFIG, LOGS.');
  }


  // Validate config keys exist
  const cfg = getConfig_(ss);
  const requiredKeys = ["OWNER_EMAIL", "FROM_NAME", "REPLY_TIME_WINDOW", "SHEET_LINK", "DEFAULT_STATUS"];
  requiredKeys.forEach((k) => {
    if (!cfg[k]) throw new Error(`Missing CONFIG value for key: ${k}`);
  });


  // Create/refresh trigger
  ensureOnFormSubmitTrigger_();


  log_(ss, "SETUP_COMPLETE", `Trigger installed. Owner=${cfg.OWNER_EMAIL}`);
}


// =========================
// TRIGGER HANDLER
// =========================
function onFormSubmit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    processFormSubmitEvent_(ss, e);
  } catch (err) {
    log_(ss, "ERROR", String(err && err.stack ? err.stack : err));
    throw err; // keep error visible in executions
  }
}


// =========================
// MANUAL TEST (uses latest row in Form Responses sheet)
// =========================
function test_ProcessLatestResponse() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = getConfig_(ss);


  const responsesSheet = findResponsesSheet_(ss);
  if (!responsesSheet) {
    throw new Error('Could not find the Form Responses sheet. It usually starts with "Form Responses".');
  }


  const lastRow = responsesSheet.getLastRow();
  if (lastRow < 2) throw new Error("No responses to process yet.");


  const result = processResponseRow_(ss, responsesSheet, lastRow, cfg, { sendEmails: true });
  log_(ss, "TEST_PROCESS_LATEST_RESPONSE", `Processed row ${lastRow}. LeadID=${result.leadId}`);
}


// =========================
// ROLLBACK (removes last row from LEADS)
// =========================
function rollback_LastLead() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const leads = ss.getSheetByName("LEADS");
  if (!leads) throw new Error("LEADS sheet not found.");


  const lastRow = leads.getLastRow();
  if (lastRow < 2) throw new Error("No lead rows to rollback (LEADS only has header).");


  const lastLeadId = String(leads.getRange(lastRow, 1).getValue() || "");
  leads.deleteRow(lastRow);


  log_(ss, "ROLLBACK_LAST_LEAD", `Deleted LEADS row ${lastRow}. LeadID=${lastLeadId}`);
}


// =========================
// INTERNALS
// =========================
function processFormSubmitEvent_(ss, e) {
  if (!e || !e.range) throw new Error("Missing event object. This function is meant to run from the trigger.");


  const cfg = getConfig_(ss);


  const sheet = e.range.getSheet();
  const row = e.range.getRow();


  // Ignore header row
  if (row === 1) return;


  // Process the submitted row
  const result = processResponseRow_(ss, sheet, row, cfg, { sendEmails: true });


  log_(ss, "FORM_SUBMIT_PROCESSED", `Sheet=${sheet.getName()} Row=${row} LeadID=${result.leadId}`);
}


function processResponseRow_(ss, responsesSheet, row, cfg, opts) {
  const sendEmails = !!(opts && opts.sendEmails);


  const headers = responsesSheet.getRange(1, 1, 1, responsesSheet.getLastColumn()).getValues()[0];
  const values = responsesSheet.getRange(row, 1, 1, responsesSheet.getLastColumn()).getValues()[0];


  const data = headersToNormalizedObject_(headers, values);


  // Pull values (robust even if Google slightly changes column names)
  const timestamp = pick_(data, ["timestamp"], new Date());
  const leadEmailRaw = pick_(data, ["emailaddress", "email"], "");
  const firstRaw = pick_(data, ["firstname"], "");
  const lastRaw = pick_(data, ["lastname"], "");
  const phoneRaw = pick_(data, ["phone"], "");
  const serviceRaw = pick_(data, ["serviceneeded"], "");
  const budgetRaw = pick_(data, ["budgetrange"], "");
  const notesRaw = pick_(data, ["noteswhatareyoutryingtoautomate", "notes"], "");
  const bestTimeRaw = pick_(data, ["besttimetocontactyou"], "");
  const consentRaw = pick_(data, ["consenttocontact"], "");


  // Clean
  const firstName = properCase_(String(firstRaw).trim());
  const lastName = properCase_(String(lastRaw).trim());
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();


  const leadEmail = cleanEmail_(String(leadEmailRaw));
  const phone = cleanPhone_(String(phoneRaw));
  const service = String(serviceRaw || "").trim();
  const budget = String(budgetRaw || "").trim();
  const notes = String(notesRaw || "").trim();
  const bestTime = String(bestTimeRaw || "").trim();


  // Do Not Contact logic (simple for now):
  // - If they selected consent checkbox, store "No" (they want contact)
  // - If blank, still store "No" because they submitted the lead request (implied consent),
  //   but we keep the raw value for future logic if needed.
  const doNotContact = "No";
  const consentValue = String(consentRaw || "").trim();


  // Lead ID generation (by date)
  const leadsSheet = ss.getSheetByName("LEADS");
  const leadId = generateLeadId_(leadsSheet, asDate_(timestamp));


  // Build row for LEADS (match your LEADS header order)
  const now = new Date();
  const status = cfg.DEFAULT_STATUS || "New";
  const source = "Google Form";
  const lastContacted = "";
  const nextFollowUp = "";
  const dateAdded = now;


  const leadRow = [
    leadId,                 // Lead ID
    asDate_(timestamp),     // Timestamp
    firstName,              // First Name
    lastName,               // Last Name
    fullName,               // Full Name
    leadEmail,              // Email
    phone,                  // Phone
    service,                // Service
    budget,                 // Budget
    notes,                  // Notes
    bestTime,               // Best Contact Time
    status,                 // Status
    doNotContact,           // Do Not Contact
    source,                 // Source
    lastContacted,          // Last Contacted
    nextFollowUp,           // Next Follow-up
    dateAdded               // Date Added
  ];


  // Append into LEADS
  leadsSheet.appendRow(leadRow);


  // Emails
  if (sendEmails) {
    // Confirmation to lead (only if email exists)
    if (leadEmail) {
      sendLeadConfirmation_(cfg, leadEmail, firstName || "there", service);
      log_(ss, "EMAIL_SENT_LEAD", `To=${leadEmail} LeadID=${leadId}`);
    } else {
      log_(ss, "EMAIL_SKIPPED_LEAD", `Missing lead email. LeadID=${leadId}`);
    }


    // Notification to owner
    sendOwnerNotification_(cfg, {
      leadId,
      fullName: fullName || "(No name provided)",
      email: leadEmail || "(No email provided)",
      phone: phone || "(No phone provided)",
      service: service || "(No service provided)",
      budget: budget || "(No budget provided)",
      notes: notes || "(No notes provided)",
      sheetLink: cfg.SHEET_LINK || ""
    });
    log_(ss, "EMAIL_SENT_OWNER", `To=${cfg.OWNER_EMAIL} LeadID=${leadId}`);
  }


  return { leadId };
}


function ensureOnFormSubmitTrigger_() {
  // Remove old triggers for this handler to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    if (t.getHandlerFunction && t.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(t);
    }
  });


  // Create a new installable trigger for spreadsheet form submits
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();
}


function getConfig_(ss) {
  const sheet = ss.getSheetByName("CONFIG");
  if (!sheet) throw new Error("CONFIG sheet not found.");


  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};


  const range = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const cfg = {};
  range.forEach(([k, v]) => {
    const key = String(k || "").trim();
    if (!key) return;
    cfg[key] = String(v || "").trim();
  });
  return cfg;
}


function findResponsesSheet_(ss) {
  const sheets = ss.getSheets();
  for (const sh of sheets) {
    const name = sh.getName();
    if (name.toLowerCase().startsWith("form responses")) return sh;
  }
  return null;
}


function sendLeadConfirmation_(cfg, toEmail, firstName, service) {
  const subject = "FlowForge Automation — Request received";
  const body =
    `Hi ${firstName},\n\n` +
    `Thanks for reaching out — we received your request for ${service || "automation help"}. We’ll get back to you ${cfg.REPLY_TIME_WINDOW || "soon"}.\n\n` +
    `Quick question: what’s the best time today/tomorrow to contact you?\n\n` +
    `— ${cfg.FROM_NAME || "FlowForge Automation"}\n` +
    `(Reply STOP if you’d like us to not contact you.)`;


  MailApp.sendEmail({
    to: toEmail,
    subject: subject,
    body: body,
    name: cfg.FROM_NAME || "FlowForge Automation",
    replyTo: cfg.OWNER_EMAIL || undefined
  });
}


function sendOwnerNotification_(cfg, lead) {
  const subject = `New lead — ${lead.fullName} — ${lead.service}`;


  const body =
    `New lead received:\n` +
    `- Lead ID: ${lead.leadId}\n` +
    `- Name: ${lead.fullName}\n` +
    `- Email: ${lead.email}\n` +
    `- Phone: ${lead.phone}\n` +
    `- Service: ${lead.service}\n` +
    `- Budget: ${lead.budget}\n` +
    `- Notes: ${lead.notes}\n\n` +
    `Tracker: ${lead.sheetLink}`;


  MailApp.sendEmail({
    to: cfg.OWNER_EMAIL,
    subject: subject,
    body: body,
    name: cfg.FROM_NAME || "FlowForge Automation",
    replyTo: cfg.OWNER_EMAIL || undefined
  });
}


function generateLeadId_(leadsSheet, dateObj) {
  const tz = Session.getScriptTimeZone();
  const datePart = Utilities.formatDate(dateObj, tz, "yyyyMMdd");
  const prefix = `FF-${datePart}-`;


  const lastRow = leadsSheet.getLastRow();
  if (lastRow < 2) return `${prefix}0001`;


  // Read Lead ID column (A) values
  const ids = leadsSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);


  let maxSeq = 0;
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i] || "";
    if (id.startsWith(prefix)) {
      const parts = id.split("-");
      const seqStr = parts[2] || "";
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
      // we can keep scanning a little but stopping early is fine
      // (there may be older same-day leads earlier)
    }
  }


  const nextSeq = maxSeq + 1;
  const padded = String(nextSeq).padStart(4, "0");
  return `${prefix}${padded}`;
}


function headersToNormalizedObject_(headers, values) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = normalizeHeader_(headers[i]);
    if (!key) continue;
    obj[key] = values[i];
  }
  return obj;
}


function normalizeHeader_(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces/punctuation
}


function pick_(obj, normalizedKeys, fallback) {
  for (const k of normalizedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== "" && obj[k] != null) {
      return obj[k];
    }
  }
  return fallback;
}


function properCase_(s) {
  const str = String(s || "").trim();
  if (!str) return "";
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}


function cleanEmail_(s) {
  return String(s || "").trim().toLowerCase();
}


function cleanPhone_(s) {
  const digits = String(s || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
    if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(s || "").trim(); // keep original if not a standard length
}


function asDate_(v) {
  if (v instanceof Date) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return new Date();
  return d;
}


function log_(ss, eventName, details) {
  const logs = ss.getSheetByName("LOGS");
  if (!logs) return;
  logs.appendRow([new Date(), eventName, details]);
}
