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
    // Handle both parsed JSON body and raw text body
    let residentName = inputs.residentName;
    let rawSummary = inputs.conversationSummary;

    // If body came as text/plain, Activepieces may pass raw body string
    if (!residentName && inputs.body) {
        try {
            const parsed = typeof inputs.body === 'string' ? JSON.parse(inputs.body) : inputs.body;
            residentName = parsed.residentName;
            rawSummary = parsed.conversationSummary;
        } catch (e) {
            // body wasn't JSON
        }
    }

    const apiKey = inputs.groqApiKey; // passed from Activepieces connection/config

    // ── The predetermined prompt ──────────────────────────────────
    const SYSTEM_PROMPT = `You are a conversation-log assistant for a residential community program called DawgChat. Your job is to take a staff member's quick notes about a conversation and expand them into a polished summary that sounds like the staff member naturally wrote it themselves — not like AI.

WRITING STYLE RULES (critical — follow these closely):
- Write in FIRST PERSON ("Me and [name] talked about...", "I suggested...", "He mentioned...")
- Keep a warm, casual-but-professional tone. Use natural phrases like "caught up", "pretty good", "stoked", "hyped up", "pretty chill"
- Flow naturally between topics in paragraph form — NO bullet points, NO headers
- Reference specific details: classes, programs, resources, other residents by name when relevant
- Use contractions naturally (didn't, he's, wasn't, etc.)
- Keep it feeling like a real person wrote it, not a report. Think "talking to a coworker" tone, not "corporate email" tone
- 3-6 sentences typically. Don't over-explain, but fill in enough detail to be useful

EXAMPLES OF THE TARGET WRITING STYLE:

Example 1: "Me and Sintayehu caught up on his move in day and he actually expressed a lot of concern about RA Interviews and upcoming academics. He is in Terry and is in accounting this semester which is really hyped up to be a very tough class, so he is worried. I went ahead and suggested penji and tutoring resources, so that he was prepared for if challenges do come up later. He is also unsure of the RA role and if he would be a good fit and I talked through some of the expectations and challenges, but also rewards of the role and we agreed that I would help him prepare as much as possible for the interviews and that with confidence it will be easier to proceed. He said his break was pretty chill and that he didn't get up to much, but enjoyed the break. Him and Joseph are also doing good and the fridge stuff is worked out. He voiced excitement for upcoming events too."

Example 2: "Reggie has been pretty good recently. He is stoked to be applying for the RA and RBA roles and we prepped a lot with mock interviews and such. He is involved with peer leadership here too which he loves."

You will receive:
- A resident's name
- A raw, informal summary of a conversation a staff member had with them

Return EXACTLY three things in valid JSON (no markdown, no code fences):

{
  "enhancedSummary": "<Expanded summary matching the writing style above. Keep all original meaning and details, improve grammar and flow, and fill in natural connecting language. Do NOT make it sound robotic or formal.>",
  "theme": "<Exactly ONE of these 6 categories: Academics | Relationships | Belonging | Roommates | Campus Involvement | Well-being>",
  "challenges": "<If challenges or concerns came up, list them briefly. If none, return exactly: None>"
}

Rules:
- Return ONLY the JSON object. No explanation, no extra text.
- theme must be exactly one of the 6 listed categories.
- challenges should be concise. Use "None" if no challenges.
- The enhanced summary should read like the staff member wrote it themselves.`;

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
