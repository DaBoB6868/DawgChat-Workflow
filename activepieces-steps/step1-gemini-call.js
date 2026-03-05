// ================================================================
//  ACTIVEPIECES — CODE STEP 1: Call Gemini API
// ================================================================
//  Paste this into an Activepieces "Code" piece.
//  
//  Inputs (from the webhook trigger):
//    - params.residentName   (string)
//    - params.conversationSummary (string)
//
//  Secrets / Connection values you'll configure in Activepieces:
//    - GEMINI_API_KEY  (your Google AI Studio key)
//
//  Outputs:
//    - enhancedSummary  (string)
//    - theme            (string — one of 6 categories)
//    - challenges       (string — or "None")
// ================================================================

export const code = async (inputs) => {
    const residentName = inputs.residentName;
    const rawSummary = inputs.conversationSummary;
    const apiKey = inputs.geminiApiKey; // passed from Activepieces connection/config

    // ── The predetermined prompt ──────────────────────────────────
    const SYSTEM_PROMPT = `You are a professional conversation-log assistant for a residential community program called DawgChat.

You will receive:
- A resident's name
- A raw, informal summary of a conversation a staff member had with them

Your job is to return EXACTLY three things in valid JSON (no markdown, no code fences):

{
  "enhancedSummary": "<A grammatically polished, professionally expanded version of the conversation summary. Keep the original meaning but improve clarity, grammar, and completeness. 2-4 sentences.>",
  "theme": "<Exactly ONE of these 6 categories that best describes the overall conversation: Academics | Relationships | Belonging | Roommates | Campus Involvement | Well-being>",
  "challenges": "<If the conversation revealed any challenges or concerns the resident is facing, list them briefly. If none, return exactly the string: None>"
}

Rules:
- Return ONLY the JSON object. No explanation, no extra text.
- enhancedSummary should be professional but warm.
- theme must be exactly one of the 6 listed categories.
- challenges should be concise bullet-style if multiple, or "None".`;

    const userMessage = `Resident Name: ${residentName}\n\nRaw Conversation Summary:\n${rawSummary}`;

    // ── Call Gemini API ───────────────────────────────────────────
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1024
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extract the text content from Gemini's response
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
        throw new Error('No text returned from Gemini. Full response: ' + JSON.stringify(data));
    }

    // Parse the JSON — strip potential markdown fences just in case
    const cleanText = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleanText);

    // Validate the 6 allowed themes
    const VALID_THEMES = [
        'Academics',
        'Relationships',
        'Belonging',
        'Roommates',
        'Campus Involvement',
        'Well-being'
    ];
    if (!VALID_THEMES.includes(parsed.theme)) {
        parsed.theme = 'Well-being';
    }

    return {
        residentName: residentName,
        enhancedSummary: parsed.enhancedSummary,
        theme: parsed.theme,
        challenges: parsed.challenges || 'None'
    };
};
