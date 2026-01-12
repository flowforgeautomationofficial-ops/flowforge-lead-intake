# FlowForge Automation — Project 1: Lead Intake System

A $0 Google-based lead intake automation using Google Forms, Sheets, Apps Script, and Gmail.

## What it does
- Captures leads from a Google Form
- Generates a unique Lead ID: FF-YYYYMMDD-#### 
- Appends a cleaned row into the LEADS tab
- Sends a confirmation email to the lead
- Sends a notification email to the owner

## Stack
- Google Forms
- Google Sheets
- Google Apps Script
- Gmail
- Google Drive

## Demo (what to show)
1) Open the Form (responder view)
2) Submit a test lead
3) Show the LEADS tab with the new Lead ID
4) Show the lead confirmation email
5) Show the owner notification email

## Screenshots
Add these files to a /screenshots folder in GitHub:

- screenshots/01-leads-tab-lead-id.png
- screenshots/02-lead-confirmation-email.png
- screenshots/03-owner-notification-email.png

Then update this section with images:

![LEADS Tab](screenshots/01-leads-tab-lead-id.png)
![Lead Confirmation Email](screenshots/02-lead-confirmation-email.png)
![Owner Notification Email](screenshots/03-owner-notification-email.png)

## Setup (client install)
1) Copy the Google Sheet + Google Form
2) Open Extensions → Apps Script
3) Update config (owner email, email subjects, templates)
4) Add trigger:
   - Function: onFormSubmit
   - Event source: From spreadsheet
   - Event type: On form submit
5) Run an end-to-end test by submitting the form

## Testing checklist
- New lead submits → LEADS row created with Lead ID
- Lead gets confirmation email
- Owner gets notification email
- Multiple submissions increment Lead IDs correctly

## Rollback / Safety
- Apps Script → Triggers → disable/delete onFormSubmit trigger
- Sheets → File → Version history → restore if needed

## Customization ideas
- Add lead status (New/Contacted/Booked/Closed)
- Do Not Contact toggle
- Automated follow-ups (Day 2 / Day 7)
- Dashboard reporting
