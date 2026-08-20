# Zapier Setup Guide - LOA & Cover Letter PDF Generation

This guide explains how to set up Zapier to automatically generate LOA and Cover Letter PDFs when a client submits an intake form.

---

## Overview

```
Client Submits Form → Webhook to Zapier → Generate PDFs → Upload to S3 → Send Email
```

### What You'll Create:
1. **Congratulations Email** - Sent immediately to client
2. **LOA PDF** - Letter of Authority for the lender
3. **Cover Letter PDF** - DSAR request to lender (skipped for Gambling)

---

## Prerequisites

Before starting, make sure you have:
- [ ] Zapier account (Professional plan recommended for PDF generation)
- [ ] AWS S3 credentials (from your `.env` file)
- [ ] PDF.co account (for HTML to PDF conversion) OR Zapier PDF addon

---

## STEP 1: Create the Zap Trigger

### 1.1 Create New Zap
1. Log into Zapier → Click **"Create Zap"**
2. Name it: `"Intake Form - LOA & Cover Letter Generator"`

### 1.2 Set Up Webhook Trigger
1. **Trigger App**: Select **"Webhooks by Zapier"**
2. **Event**: Select **"Catch Hook"**
3. Click **Continue**
4. **Copy the Webhook URL** (e.g., `https://hooks.zapier.com/hooks/catch/12345/abcdef/`)

### 1.3 Update Your .env File
```env
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/12345/abcdef/
```

### 1.4 Test the Trigger
1. Restart your server: `npm run dev`
2. Submit a test form on your intake page
3. Go back to Zapier and click **"Test trigger"**
4. You should see the test data with fields like:
   - `first_name`
   - `last_name`
   - `email`
   - `lender_type`
   - `contact_id`
   - `lender_selection_url`

---

## STEP 2: Add Paths (For Different Lenders)

Since you have 3 lender types (Vanquis, Loans2Go, Gambling), you need different paths.

### 2.1 Add Paths Step
1. Click **"+"** to add a step
2. Search for **"Paths by Zapier"**
3. Click **Continue**

### 2.2 Configure Path A: VANQUIS
1. **Path name**: `Vanquis`
2. **Path rules**:
   - Field: `lender_type`
   - Condition: `(Text) Contains`
   - Value: `vanquis` (case insensitive)

### 2.3 Configure Path B: LOANS2GO
1. **Path name**: `Loans2Go`
2. **Path rules**:
   - Field: `lender_type`
   - Condition: `(Text) Contains`
   - Value: `loans2go` OR `loans 2 go`

### 2.4 Configure Path C: GAMBLING
1. **Path name**: `Gambling`
2. **Path rules**:
   - Field: `lender_type`
   - Condition: `(Text) Contains`
   - Value: `gambling`

---

## STEP 3: Generate LOA PDF (For Each Path)

### 3.1 Add PDF.co Step
For each path (Vanquis, Loans2Go, Gambling):

1. Click **"+"** inside the path
2. Search for **"PDF.co"**
3. Select **"HTML to PDF"**
4. Connect your PDF.co account

### 3.2 Configure HTML to PDF
1. **HTML content**: Copy the content from `templates/zapier-loa-template.html`
2. **Replace merge fields** with Zapier variables:

| Template Field | Replace With |
|----------------|--------------|
| `{{full_name}}` | Click "+" → Select `full_name` from webhook |
| `{{street_address}}` | Click "+" → Select `street_address` |
| `{{city}}` | Click "+" → Select `city` |
| `{{postal_code}}` | Click "+" → Select `postal_code` |
| `{{date_of_birth}}` | Click "+" → Select `date_of_birth` |
| `{{lender_type}}` | Click "+" → Select `lender_type` |
| `{{submitted_date}}` | Use Formatter to format `submitted_at` |
| `{{previous_address}}` | Leave blank or add if available |

3. **Output filename**: `{{contact_id}}_LOA.pdf`

---

## STEP 4: Generate Cover Letter PDF

### 4.1 For VANQUIS Path
1. Add another **PDF.co → HTML to PDF** step
2. Copy content from `templates/zapier-cover-letter-vanquis.html`
3. Replace merge fields (same as above)
4. **Output filename**: `{{contact_id}}_VANQUIS_Cover_Letter.pdf`

### 4.2 For LOANS2GO Path
1. Add another **PDF.co → HTML to PDF** step
2. Copy content from `templates/zapier-cover-letter-loans2go.html`
3. Replace merge fields
4. **Output filename**: `{{contact_id}}_LOANS2GO_Cover_Letter.pdf`

### 4.3 For GAMBLING Path
1. Add another **PDF.co → HTML to PDF** step
2. Copy content from `templates/zapier-cover-letter-gambling.html`
3. Replace merge fields
4. **Output filename**: `{{contact_id}}_GAMBLING_Cover_Letter.pdf`

---

## STEP 5: Upload PDFs to S3

### 5.1 Add AWS S3 Step
For each PDF generated:

1. Click **"+"**
2. Search for **"Amazon S3"**
3. Select **"Upload File"**
4. Connect your AWS account with credentials:
   - Access Key: `<AWS_ACCESS_KEY_ID — set via env, rotate the exposed one>`
   - Secret Key: (from your .env)
   - Region: `eu-north-1`

### 5.2 Configure S3 Upload - LOA
1. **Bucket**: `client.landing.page`
2. **Key (file path)**:
   ```
   {{first_name}}_{{last_name}}_{{contact_id}}/LOA/{{lender_type}}_LOA.pdf
   ```
3. **File**: Select the PDF output from the previous PDF.co step

### 5.3 Configure S3 Upload - Cover Letter
1. **Bucket**: `client.landing.page`
2. **Key (file path)**:
   ```
   {{first_name}}_{{last_name}}_{{contact_id}}/LOA/{{lender_type}}_Cover_Letter.pdf
   ```
3. **File**: Select the Cover Letter PDF output

---

## STEP 6: Send Congratulations Email

### 6.1 Add Email Step (At the START, before Paths)
1. Click **"+"** AFTER the webhook trigger (before Paths)
2. Search for **"Email by Zapier"** or your email provider (Gmail, Office 365)
3. Select **"Send Outbound Email"**

### 6.2 Configure Email
1. **To**: `{{email}}` (from webhook)
2. **From name**: `Rowan Rose Solicitors`
3. **Subject**: `Your Claim is Being Processed - Rowan Rose Solicitors`
4. **Body Type**: HTML
5. **Body**: Copy content from `templates/zapier-congratulations-email.html`
6. Replace merge fields with Zapier variables

---

## STEP 7: Send Documents to Lender (Optional)

If you want to automatically email the LOA and Cover Letter to the lender:

### 7.1 Add Email Step (Inside Each Path)
1. After S3 upload, add **"Email by Zapier"**
2. Configure:

**For VANQUIS:**
- To: `DataRightsTeam@vanquisbank.co.uk`
- Subject: `RE: VANQUIS DSAR, CLIENT: {{full_name}}, REF: FAC-{{contact_id}}`
- Attachments: LOA PDF + Cover Letter PDF

**For LOANS2GO:**
- To: `Ps@loans2go.co.uk`
- Subject: `RE: LOANS 2 GO DSAR, CLIENT: {{full_name}}, REF: FAC-{{contact_id}}`
- Attachments: LOA PDF + Cover Letter PDF

**For GAMBLING:**
- Skip email (no lender address) OR save for manual sending

---

## STEP 8: Test Your Zap

### 8.1 Enable the Zap
1. Click **"Publish"** at the top right
2. Toggle the Zap **ON**

### 8.2 Submit Test Form
1. Go to your intake form locally: `http://localhost:5173/intake/vanquis`
2. Fill out the form and submit
3. Check:
   - [ ] Email received?
   - [ ] PDFs generated in S3?
   - [ ] Check Zapier task history for errors

### 8.3 Verify S3 Uploads
```bash
aws s3 ls s3://client.landing.page/FirstName_LastName_123/LOA/ --recursive
```

---

## Troubleshooting

### PDF not generating?
- Check PDF.co API limits
- Verify HTML is valid (test in browser first)
- Check for special characters in names

### S3 upload failing?
- Verify AWS credentials are correct
- Check bucket permissions
- Ensure bucket name is exact: `client.landing.page`

### Email not sending?
- Check spam folder
- Verify email field has valid email
- Check Zapier email limits

### Wrong path triggered?
- Check lender_type value (case sensitivity)
- Add fallback path for unknown lenders

---

## Merge Field Reference

| Field | Description | Example |
|-------|-------------|---------|
| `{{first_name}}` | Client first name | John |
| `{{last_name}}` | Client last name | Doe |
| `{{full_name}}` | Combined name | John Doe |
| `{{email}}` | Client email | john@email.com |
| `{{phone}}` | Client phone | 07123456789 |
| `{{street_address}}` | Street address | 123 Main St |
| `{{city}}` | City | Manchester |
| `{{postal_code}}` | Postal code | M1 1AA |
| `{{date_of_birth}}` | DOB | 1990-01-15 |
| `{{lender_type}}` | Lender name | VANQUIS |
| `{{contact_id}}` | Database ID | 123 |
| `{{lender_selection_url}}` | LOA form link | http://... |
| `{{submitted_at}}` | Timestamp | 2026-01-31T... |

---

## Complete Zap Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TRIGGER: Webhooks by Zapier (Catch Hook)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  ACTION 1: Email - Send Congratulations Email               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│  PATHS: Based on lender_type                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│                 │                 │                         │
│   PATH A:       │   PATH B:       │   PATH C:               │
│   VANQUIS       │   LOANS2GO      │   GAMBLING              │
│                 │                 │                         │
│   ┌─────────┐   │   ┌─────────┐   │   ┌─────────┐           │
│   │PDF: LOA │   │   │PDF: LOA │   │   │PDF: LOA │           │
│   └────┬────┘   │   └────┬────┘   │   └────┬────┘           │
│        │        │        │        │        │                │
│   ┌────▼────┐   │   ┌────▼────┐   │   ┌────▼────┐           │
│   │PDF:Cover│   │   │PDF:Cover│   │   │PDF:Cover│           │
│   └────┬────┘   │   └────┬────┘   │   └────┬────┘           │
│        │        │        │        │        │                │
│   ┌────▼────┐   │   ┌────▼────┐   │   ┌────▼────┐           │
│   │S3:LOA   │   │   │S3:LOA   │   │   │S3:LOA   │           │
│   └────┬────┘   │   └────┬────┘   │   └────┬────┘           │
│        │        │        │        │        │                │
│   ┌────▼────┐   │   ┌────▼────┐   │   ┌────▼────┐           │
│   │S3:Cover │   │   │S3:Cover │   │   │S3:Cover │           │
│   └─────────┘   │   └─────────┘   │   └─────────┘           │
│                 │                 │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## Files Created

| File | Purpose |
|------|---------|
| `templates/zapier-loa-template.html` | LOA PDF template (all lenders) |
| `templates/zapier-cover-letter-vanquis.html` | Cover Letter for Vanquis |
| `templates/zapier-cover-letter-loans2go.html` | Cover Letter for Loans2Go |
| `templates/zapier-cover-letter-gambling.html` | Cover Letter for Gambling (no address) |
| `templates/zapier-congratulations-email.html` | Welcome email template |

---

## Support

If you encounter issues:
1. Check Zapier Task History for error details
2. Test each step individually
3. Verify webhook data is being sent correctly from server.js

Good luck! 🎉
