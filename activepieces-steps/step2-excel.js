// ================================================================
//  ACTIVEPIECES — CODE STEP 2: Write to Excel (Microsoft 365)
// ================================================================
//  Paste this into a SECOND Activepieces "Code" piece that runs
//  AFTER step 1 (the Gemini call).
//
//  This step uses the Microsoft Graph API to:
//    1. Read all rows from your Excel workbook on OneDrive
//    2. Find the row where column A matches the resident's name
//    3. Write enhancedSummary, theme, and challenges into columns
//       B, C, D of that row
//
//  Inputs (mapped from Step 1 outputs + config):
//    - inputs.residentName
//    - inputs.enhancedSummary
//    - inputs.theme
//    - inputs.challenges
//    - inputs.microsoftAccessToken  (from Activepieces Microsoft/OneDrive connection)
//    - inputs.workbookPath          (path in OneDrive, e.g. "/DawgChat.xlsx")
//    - inputs.worksheetName         (tab name, e.g. "Sheet1")
//
//  NOTE: The easier approach is to use Activepieces' built-in
//  Microsoft Excel 365 pieces (Find Row + Update Row).
//  This code version gives you more control in a single step.
// ================================================================

export const code = async (inputs) => {
    const {
        residentName,
        enhancedSummary,
        theme,
        challenges,
        microsoftAccessToken,
        workbookPath,
        worksheetName
    } = inputs;

    const graphBase = 'https://graph.microsoft.com/v1.0/me/drive';
    const headers = {
        'Authorization': `Bearer ${microsoftAccessToken}`,
        'Content-Type': 'application/json'
    };

    // Encode the file path for the Graph API
    const encodedPath = encodeURIComponent(workbookPath).replace(/%2F/g, '/');
    const workbookUrl = `${graphBase}/root:${encodedPath}:/workbook/worksheets/${encodeURIComponent(worksheetName)}`;

    // ── 1. Read all data from the used range ──────────────────────
    const readUrl = `${workbookUrl}/usedRange`;
    const readRes = await fetch(readUrl, { headers });

    if (!readRes.ok) {
        const err = await readRes.text();
        throw new Error(`Failed to read Excel workbook: ${err}`);
    }

    const readData = await readRes.json();
    const rows = readData.values || [];

    // ── 2. Find the row index for this resident (column A) ────────
    let targetRowIndex = -1;
    const searchName = residentName.trim().toLowerCase();

    for (let i = 0; i < rows.length; i++) {
        const cellValue = (rows[i][0] || '').toString().trim().toLowerCase();
        if (cellValue === searchName) {
            targetRowIndex = i;
            break;
        }
    }

    if (targetRowIndex === -1) {
        // Resident not found — append a new row after the last used row
        const newRowIndex = rows.length; // 0-indexed, this is the next empty row
        const appendRange = `B${newRowIndex + 1}:D${newRowIndex + 1}`;

        // First write the name in column A
        const nameUrl = `${workbookUrl}/range(address='A${newRowIndex + 1}')`;
        await fetch(nameUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                values: [[residentName]]
            })
        });

        // Then write the data in columns B-D
        const dataUrl = `${workbookUrl}/range(address='${appendRange}')`;
        const appendRes = await fetch(dataUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                values: [[enhancedSummary, theme, challenges]]
            })
        });

        if (!appendRes.ok) {
            const err = await appendRes.text();
            throw new Error(`Failed to append row: ${err}`);
        }

        return {
            status: 'created',
            message: `Resident "${residentName}" was not found. Created new row ${newRowIndex + 1}.`,
            residentName,
            enhancedSummary,
            theme,
            challenges
        };
    }

    // ── 3. Update columns B, C, D in the found row ───────────────
    //  Row numbers in Excel range addresses are 1-indexed
    const excelRow = targetRowIndex + 1;
    const writeRange = `B${excelRow}:D${excelRow}`;
    const writeUrl = `${workbookUrl}/range(address='${writeRange}')`;

    const writeRes = await fetch(writeUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            values: [[enhancedSummary, theme, challenges]]
        })
    });

    if (!writeRes.ok) {
        const err = await writeRes.text();
        throw new Error(`Failed to update row ${excelRow}: ${err}`);
    }

    return {
        status: 'updated',
        message: `Updated row ${excelRow} for "${residentName}".`,
        row: excelRow,
        residentName,
        enhancedSummary,
        theme,
        challenges
    };
};
