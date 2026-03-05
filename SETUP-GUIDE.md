# DawgChat Workflow — Complete Setup Guide

## Overview

This workflow lets you:
1. Open a mobile-friendly web page on your phone
2. Enter a resident name + raw conversation notes
3. AI (Gemini) enhances the summary, picks a theme, and identifies challenges
4. The results are written to the correct row in your Google Sheet

---

## Prerequisites

| Item | Where to get it |
|------|----------------|
| **Google AI Studio API Key** | https://aistudio.google.com/app/apikey |
| **Activepieces account** | https://www.activepieces.com (cloud) or self-host |
| **Google Sheet** | Create one with columns: **A = Resident Name**, **B = Enhanced Summary**, **C = Theme**, **D = Challenges** |
| **A place to host the mobile form** | GitHub Pages (free), Netlify, Vercel, or any static host |

---

## Step 1: Prepare Your Google Sheet

1. Create a new Google Sheet (or use an existing one).
2. Set up the header row:

| A | B | C | D |
|---|---|---|---|
| Resident Name | Enhanced Summary | Theme | Challenges |

3. Pre-fill column A with all your resident names (the workflow will search this column).
4. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
5. Note the **sheet tab name** (default is `Sheet1`).

---

## Step 2: Create the Activepieces Flow

### 2a. Create a new Flow
1. Log into Activepieces → click **New Flow**.
2. Name it **DawgChat Conversation Logger**.

### 2b. Add Trigger: Webhook
1. For the trigger, search for **Webhook** and select **Webhook (Catch Request)**.
2. Click **Generate Test URL** — Activepieces gives you a URL like:
   ```
   https://cloud.activepieces.com/api/v1/webhooks/YOUR_FLOW_ID
   ```
3. **Copy this URL** — you'll paste it into the mobile form later.
4. Send a test request (you can use the form or curl):
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"residentName":"John Smith","conversationSummary":"Talked about adjusting to campus life"}'
   ```
5. Click **Load Data** in Activepieces to capture the test payload.

### 2c. Add Step 1: Code — Call Gemini API
1. Click **+** to add a step → search **Code** → select it.
2. **Paste the contents of `activepieces-steps/step1-gemini-call.js`** into the code editor.
3. Set up the **Inputs** (left panel in the Code step):

| Input Name | Value |
|---|---|
| `residentName` | Map from webhook body → `{{trigger.body.residentName}}` |
| `conversationSummary` | Map from webhook body → `{{trigger.body.conversationSummary}}` |
| `geminiApiKey` | Paste your Google AI Studio API key (or use Activepieces secrets) |

4. Click **Test** to verify it returns JSON with `enhancedSummary`, `theme`, and `challenges`.

### 2d. Add Step 2: Google Sheets (Two Options)

#### OPTION A: Use Built-in Google Sheets Pieces (Easier, No Code) ← RECOMMENDED

**Sub-step 2d-i: Find Row**
1. Click **+** → search **Google Sheets** → select **Find Rows**.
2. Connect your Google account.
3. Configure:
   - **Spreadsheet**: Select your sheet
   - **Sheet**: Select the tab (e.g., Sheet1)
   - **Column**: A (Resident Name)
   - **Value**: `{{step_1.residentName}}` (from the Code step output)
4. Test it.

**Sub-step 2d-ii: Update Row**
1. Click **+** → search **Google Sheets** → select **Update Row**.
2. Configure:
   - **Spreadsheet**: Same sheet
   - **Sheet**: Same tab
   - **Row Number**: `{{step_2.row}}` (from the Find Row result — check exact path)
   - **Values**:
     - Column B: `{{step_1.enhancedSummary}}`
     - Column C: `{{step_1.theme}}`
     - Column D: `{{step_1.challenges}}`
3. Test it.

#### OPTION B: Use Code Step (More Control)

1. Click **+** → add another **Code** step.
2. Paste the contents of `activepieces-steps/step2-google-sheets.js`.
3. Set up Inputs:

| Input Name | Value |
|---|---|
| `residentName` | `{{step_1.residentName}}` |
| `enhancedSummary` | `{{step_1.enhancedSummary}}` |
| `theme` | `{{step_1.theme}}` |
| `challenges` | `{{step_1.challenges}}` |
| `googleAccessToken` | From your Google Sheets connection (Activepieces manages this) |
| `spreadsheetId` | Your spreadsheet ID (from the URL) |
| `sheetName` | `Sheet1` (or your tab name) |

> **Note on googleAccessToken**: If you use code to call Sheets directly, you'll need the OAuth token from an Activepieces Google connection. The easier path is **Option A** (built-in pieces). Option B is for advanced usage.

### 2e. Publish the Flow
1. Click **Publish** in the top-right.
2. Your webhook URL is now live.

---

## Step 3: Set Up the Mobile Form

1. Open `mobile-form/index.html`.
2. Find this line near the top of the `<script>`:
   ```js
   const WEBHOOK_URL = 'YOUR_ACTIVEPIECES_WEBHOOK_URL_HERE';
   ```
3. Replace it with your actual Activepieces webhook URL:
   ```js
   const WEBHOOK_URL = 'https://cloud.activepieces.com/api/v1/webhooks/abc123...';
   ```
4. Host the file. Easiest free options:

### GitHub Pages (Recommended)
1. Create a GitHub repo, push the `mobile-form/` folder.
2. Go to repo **Settings → Pages → Source: main branch**, folder: `/mobile-form`.
3. Your form is live at `https://yourusername.github.io/reponame/`.

### Netlify Drop (Fastest)
1. Go to https://app.netlify.com/drop
2. Drag the `mobile-form` folder onto the page.
3. Instant public URL.

4. **Bookmark the URL on your phone's home screen** for app-like access.

### Add to Home Screen (Phone)
- **iPhone**: Open in Safari → Share → "Add to Home Screen"
- **Android**: Open in Chrome → Menu (⋮) → "Add to Home Screen"

This gives you an app-like icon that opens the form directly.

---

## Step 4: Test End-to-End

1. Open the form on your phone.
2. Enter a resident name that exists in your Google Sheet column A.
3. Type a quick raw summary like: "talked about missing home and not eating well lately"
4. Hit **Submit**.
5. Check your Google Sheet — within a few seconds you should see:
   - **Column B**: A polished version of the summary
   - **Column C**: A theme like "Well-being"
   - **Column D**: "Homesickness; Poor eating habits" (or "None")

---

## The 6 Theme Categories

| Theme | When it applies |
|-------|----------------|
| **Academics** | Classes, grades, study habits, career goals, academic stress |
| **Relationships** | Friendships, family, significant others, social dynamics |
| **Belonging** | Fitting in, homesickness, identity, feeling connected to community |
| **Roommates** | Roommate conflicts, living situations, shared space issues |
| **Campus Involvement** | Clubs, organizations, events, Greek life, volunteering |
| **Well-being** | Physical health, mental health, sleep, eating, exercise, stress |

These are defined in the Gemini prompt and can be edited in `step1-gemini-call.js`.

---

## Customization

### Change the themes
Edit the `SYSTEM_PROMPT` in `step1-gemini-call.js` — update both the prompt text and the `VALID_THEMES` array.

### Change which columns get written
Edit `step2-google-sheets.js` — update the `writeRange` variable (e.g., change `B${targetRow}:D${targetRow}` to different columns).

### Add date/time stamp
In `step1-gemini-call.js`, add to the return:
```js
return {
    ...parsed,
    residentName,
    timestamp: new Date().toISOString()
};
```
Then map it to a column in the Sheets step.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Form shows "Error submitting" | Check the webhook URL is correct and the flow is published |
| Gemini returns garbled text | The API key may be invalid — test it at https://aistudio.google.com |
| Resident not found in sheet | Names must match exactly (case-insensitive). Check for extra spaces |
| Google Sheets auth fails | Reconnect Google account in Activepieces connections |
| Flow doesn't trigger | Make sure the flow is **Published** (not draft) |

---

## File Structure

```
DawgChat Workflow/
├── mobile-form/
│   └── index.html          ← Phone form (host this)
├── activepieces-steps/
│   ├── step1-gemini-call.js       ← Paste into Activepieces Code step 1
│   └── step2-google-sheets.js     ← Paste into Activepieces Code step 2 (Option B)
└── SETUP-GUIDE.md                 ← This file
```
