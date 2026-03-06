// ================================================================
//  ACTIVEPIECES — CODE STEP 1: Call Groq AI API
// ================================================================
//  Paste this into an Activepieces "Code" piece.
//  
//  Inputs (from the webhook trigger):
//    - params.residentName   (string)
//    - params.conversationSummary (string)
//
//  Secrets / Connection values you'll configure in Activepieces:
//    - GROQ_API_KEY  (free from https://console.groq.com/keys)
//
//  Outputs:
//    - enhancedSummary  (string)
//    - theme            (string — one of 6 categories)
//    - challenges       (string — or "None")
// ================================================================

export const code = async (inputs) => {
    const residentName = inputs.residentName;
    const rawSummary = inputs.conversationSummary;
    const apiKey = inputs.groqApiKey; // passed from Activepieces connection/config

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

    // ── Call Groq API (OpenAI-compatible format) ──────────────────
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.4,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Extract the text content from Groq's response
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
        throw new Error('No text returned from Groq. Full response: ' + JSON.stringify(data));
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
