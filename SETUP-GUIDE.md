# DawgChat Workflow — Complete Setup Guide

## Overview

This workflow lets you:
1. Open a mobile-friendly web page on your phone
2. Enter a resident name + raw conversation notes
3. AI (Gemini) enhances the summary, picks a theme, and identifies challenges
4. The results are written to the correct row in your Excel workbook

---

## Prerequisites

| Item | Where to get it |
|------|----------------|
| **Google AI Studio API Key** | https://aistudio.google.com/app/apikey |
| **Activepieces account** | https://www.activepieces.com (cloud) or self-host |
| **Excel workbook on OneDrive** | Create one with columns: **A = Resident Name**, **B = Enhanced Summary**, **C = Theme**, **D = Challenges** |
| **A place to host the mobile form** | GitHub Pages (free), Netlify, Vercel, or any static host |

---

## Step 1: Prepare Your Excel Workbook

1. Create a new Excel workbook in OneDrive (or upload an existing `.xlsx` file).
2. Set up the header row:

| A | B | C | D |
|---|---|---|---|
| Resident Name | Enhanced Summary | Theme | Challenges |

3. Pre-fill column A with all your resident names (the workflow will search this column).
4. Note the **file path** in OneDrive (e.g., `/DawgChat.xlsx`).
5. Note the **worksheet tab name** (default is `Sheet1`).

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

### 2d. Add Step 2: Microsoft Excel 365 (Two Options)

#### OPTION A: Use Built-in Excel 365 Pieces (Easier, No Code)

**Sub-step 2d-i: Find Row**
1. Click **+** → search **Microsoft Excel 365** → select **Find Rows**.
2. Connect your Microsoft account (OneDrive access).
3. Configure:
   - **Workbook**: Select your Excel file
   - **Worksheet**: Select the tab (e.g., Sheet1)
   - **Column**: A (Resident Name)
   - **Value**: `{{step_1.residentName}}` (from the Code step output)
4. Test it.

**Sub-step 2d-ii: Update Row**
1. Click **+** → search **Microsoft Excel 365** → select **Update Row**.
2. Configure:
   - **Workbook**: Same Excel file
   - **Worksheet**: Same tab
   - **Row Number**: `{{step_2.row}}` (from the Find Row result — check exact path)
   - **Values**:
     - Column B: `{{step_1.enhancedSummary}}`
     - Column C: `{{step_1.theme}}`
     - Column D: `{{step_1.challenges}}`
3. Test it.

#### OPTION B: Use Code Step (More Control)

1. Click **+** → add another **Code** step.
2. Paste the contents of `activepieces-steps/step2-excel.js`.
3. Set up Inputs:

| Input Name | Value |
|---|---|
| `residentName` | `{{step_1.residentName}}` |
| `enhancedSummary` | `{{step_1.enhancedSummary}}` |
| `theme` | `{{step_1.theme}}` |
| `challenges` | `{{step_1.challenges}}` |
| `microsoftAccessToken` | From your Microsoft 365 connection (Activepieces manages this) |
| `workbookPath` | Your OneDrive file path (e.g., `/DawgChat.xlsx`) |
| `worksheetName` | `Sheet1` (or your tab name) |

> **Note on microsoftAccessToken**: If you use code to call Excel directly via the Microsoft Graph API, you'll need the OAuth token from an Activepieces Microsoft connection. The easier path is **Option A** (built-in pieces). Option B is for advanced usage.

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
2. Enter a resident name that exists in your Excel workbook column A.
3. Type a quick raw summary like: "talked about missing home and not eating well lately"
4. Hit **Submit**.
5. Check your Excel workbook — within a few seconds you should see:
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
Edit `step2-excel.js` — update the range addresses (e.g., change `B${excelRow}:D${excelRow}` to different columns).

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
| Resident not found in workbook | Names must match exactly (case-insensitive). Check for extra spaces |
| Excel / Microsoft auth fails | Reconnect Microsoft account in Activepieces connections |
| Flow doesn't trigger | Make sure the flow is **Published** (not draft) |

---

## File Structure

```
DawgChat Workflow/
├── mobile-form/
│   └── index.html          ← Phone form (host this)
├── activepieces-steps/
│   ├── step1-gemini-call.js  ← Paste into Activepieces Code step 1
│   └── step2-excel.js        ← Paste into Activepieces Code step 2 (Option B)
└── SETUP-GUIDE.md           ← This file
```
