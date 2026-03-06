// ================================================================
//  ACTIVEPIECES — CODE STEP 2: Write to Google Sheets
// ================================================================
//  Paste this into a SECOND Activepieces "Code" piece that runs
//  AFTER step 1 (the Gemini call).
//
//  This step:
//    1. Reads all rows from your Google Sheet
//    2. Finds the row where column A matches the resident's name
//    3. Writes enhancedSummary, theme, and challenges into columns
//       B, C, D of that row
//
//  Inputs (mapped from Step 1 outputs + config):
//    - inputs.residentName
//    - inputs.enhancedSummary
//    - inputs.theme
//    - inputs.challenges
//    - inputs.googleAccessToken  (from Activepieces Google Sheets connection)
//    - inputs.spreadsheetId      (your Google Sheet ID)
//    - inputs.sheetName          (tab name, e.g. "Sheet1")
//
//  NOTE: The easier approach is to use Activepieces' built-in
//  Google Sheets pieces (Find Row + Update Row).
//  This code version gives you more control in a single step.
// ================================================================

export const code = async (inputs) => {
    const {
        residentName,
        enhancedSummary,
        theme,
        challenges,
        googleAccessToken,
        spreadsheetId,
        sheetName
    } = inputs;

    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const headers = {
        'Authorization': `Bearer ${googleAccessToken}`,
        'Content-Type': 'application/json'
    };

    // ── 1. Read all resident names from column A ──────────────────
    const readRange = `${sheetName}!A:A`;
    const readUrl = `${baseUrl}/values/${encodeURIComponent(readRange)}`;

    const readRes = await fetch(readUrl, { headers });
    if (!readRes.ok) {
        const err = await readRes.text();
        throw new Error(`Failed to read sheet: ${err}`);
    }

    const readData = await readRes.json();
    const rows = readData.values || [];

    // ── 2. Find the row number (1-indexed) for this resident ──────
    let targetRow = -1;
    const searchName = residentName.trim().toLowerCase();

    for (let i = 0; i < rows.length; i++) {
        const cellValue = (rows[i][0] || '').trim().toLowerCase();
        if (cellValue === searchName) {
            targetRow = i + 1; // Sheets rows are 1-indexed
            break;
        }
    }

    if (targetRow === -1) {
        // Resident not found — append a new row instead
        const appendUrl = `${baseUrl}/values/${encodeURIComponent(sheetName + '!A:I')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
        const appendRes = await fetch(appendUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                values: [[residentName, '', '', '', '', '', enhancedSummary, theme, challenges]]
            })
        });

        if (!appendRes.ok) {
            const err = await appendRes.text();
            throw new Error(`Failed to append row: ${err}`);
        }

        return {
            status: 'created',
            message: `Resident "${residentName}" was not found. Created new row.`,
            residentName,
            enhancedSummary,
            theme,
            challenges
        };
    }

    // ── 3. Update columns G, H, I in the found row ───────────────
    //    Column G = Overall Conversation (Dawg Chat #2)
    //    Column H = Overall Theme (Dawg Chat #2)
    //    Column I = Challenge (Dawg Chat #2)
    const writeRange = `${sheetName}!G${targetRow}:I${targetRow}`;
    const writeUrl = `${baseUrl}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

    const writeRes = await fetch(writeUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
            values: [[enhancedSummary, theme, challenges]]
        })
    });

    if (!writeRes.ok) {
        const err = await writeRes.text();
        throw new Error(`Failed to update row ${targetRow}: ${err}`);
    }

    return {
        status: 'updated',
        message: `Updated row ${targetRow} for "${residentName}".`,
        row: targetRow,
        residentName,
        enhancedSummary,
        theme,
        challenges
    };
};
