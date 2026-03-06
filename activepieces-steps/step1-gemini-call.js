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

    // ── FERPA: Sanitize PII before sending to external AI ─────────
    function sanitizeForAI(name, summary) {
        let text = summary;

        // Replace the resident's own name (first, last, full — case-insensitive)
        const nameParts = name.trim().split(/\s+/);
        for (const part of nameParts) {
            if (part.length >= 2) {
                text = text.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'Resident');
            }
        }
        // Also replace full name as a unit
        if (nameParts.length > 1) {
            text = text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), 'Resident');
        }

        // Emails
        text = text.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED]');

        // Phone numbers (US formats: 123-456-7890, (123) 456-7890, 1234567890, +1...)
        text = text.replace(/(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g, '[REDACTED]');

        // Student IDs / UGA IDs (8–10 digit numbers, or "ID: 12345678" patterns)
        text = text.replace(/\b(UGA\s*ID|student\s*ID|ID)[:\s#]*\d{5,10}\b/gi, '[REDACTED]');
        text = text.replace(/\b81[0-9]{7}\b/g, '[REDACTED]');  // UGA 81x pattern

        // Room numbers / dorm+room references ("Creswell 405", "Room 312", "Myers 201B")
        text = text.replace(/\b(room|rm)\s*#?\s*\d{2,4}[A-Za-z]?\b/gi, 'residence hall');
        text = text.replace(/\b[A-Z][a-z]+\s+\d{3,4}[A-Za-z]?\b/g, 'residence hall');

        // Best-effort: other full names (two+ consecutive Capitalized words that aren't the resident)
        // Skips common non-name words
        const skipWords = new Set(['The','This','That','They','Their','There','These','Those',
            'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
            'January','February','March','April','May','June','July','August',
            'September','October','November','December','Spring','Summer','Fall','Winter',
            'Terry','UGA','RA','RBA','DawgChat','None','Resident','REDACTED',
            'Academics','Relationships','Belonging','Roommates','Campus','Involvement','Well']);
        const residentParts = new Set(nameParts.map(p => p.toLowerCase()));
        text = text.replace(/\b([A-Z][a-z]{1,15})\s+([A-Z][a-z]{1,15})\b/g, (match, first, last) => {
            if (skipWords.has(first) || skipWords.has(last)) return match;
            if (residentParts.has(first.toLowerCase()) || residentParts.has(last.toLowerCase())) return match;
            return 'OtherStudent';
        });

        return text;
    }

    // ── FERPA: Scan AI output for PII leaks ───────────────────────
    function scanForPII(text, originalName) {
        if (!text) return false;
        // Check for the resident's actual name
        const nameParts = originalName.trim().split(/\s+/);
        for (const part of nameParts) {
            if (part.length >= 2 && new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)) {
                return true;
            }
        }
        // Check for emails
        if (/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(text)) return true;
        // Check for phone numbers
        if (/(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/.test(text)) return true;
        // Check for student IDs
        if (/\b81[0-9]{7}\b/.test(text)) return true;
        return false;
    }

    // ── Sanitize inputs before they leave our server ──────────────
    const sanitizedText = sanitizeForAI(residentName, rawSummary);
    const alias = 'Resident' + Math.floor(Math.random() * 9000 + 1000);

    // ── The predetermined prompt ──────────────────────────────────
    const SYSTEM_PROMPT = `You are a conversation-log assistant for a residential community program called DawgChat. Your job is to take a staff member's quick notes about a conversation and expand them into a polished summary that sounds like the staff member naturally wrote it themselves — not like AI.

IMPORTANT: The resident is referred to by an alias for privacy. Use "Resident" as their name in the output.

WRITING STYLE RULES (critical — follow these closely):
- Write in FIRST PERSON ("Me and Resident talked about...", "I suggested...", "He mentioned...")
- Keep a warm, casual-but-professional tone. Use natural phrases like "caught up", "pretty good", "stoked", "hyped up", "pretty chill"
- Flow naturally between topics in paragraph form — NO bullet points, NO headers
- Reference specific details: classes, programs, resources when relevant
- Use contractions naturally (didn't, he's, wasn't, etc.)
- Keep it feeling like a real person wrote it, not a report. Think "talking to a coworker" tone, not "corporate email" tone
- 3-6 sentences typically. Don't over-explain, but fill in enough detail to be useful

EXAMPLES OF THE TARGET WRITING STYLE:

Example 1: "Me and Resident caught up on his move in day and he actually expressed a lot of concern about RA Interviews and upcoming academics. He is in Terry and is in accounting this semester which is really hyped up to be a very tough class, so he is worried. I went ahead and suggested penji and tutoring resources, so that he was prepared for if challenges do come up later. He is also unsure of the RA role and if he would be a good fit and I talked through some of the expectations and challenges, but also rewards of the role and we agreed that I would help him prepare as much as possible for the interviews and that with confidence it will be easier to proceed. He said his break was pretty chill and that he didn't get up to much, but enjoyed the break. Him and his roommate are also doing good and the fridge stuff is worked out. He voiced excitement for upcoming events too."

Example 2: "Resident has been pretty good recently. He is stoked to be applying for the RA and RBA roles and we prepped a lot with mock interviews and such. He is involved with peer leadership here too which he loves."

You will receive:
- An alias for a resident (use "Resident" in the output)
- A sanitized summary of a conversation

Return EXACTLY three things in valid JSON (no markdown, no code fences):

{
  "enhancedSummary": "<Expanded summary matching the writing style above. Use 'Resident' as the name. Keep all original meaning and details, improve grammar and flow, and fill in natural connecting language. Do NOT make it sound robotic or formal.>",
  "theme": "<Exactly ONE of these 6 categories: Academics | Relationships | Belonging | Roommates | Campus Involvement | Well-being>",
  "challenges": "<If challenges or concerns came up, list them briefly. If none, return exactly: None>"
}

Rules:
- Return ONLY the JSON object. No explanation, no extra text.
- theme must be exactly one of the 6 listed categories.
- challenges should be concise. Use "None" if no challenges.
- The enhanced summary should read like the staff member wrote it themselves.
- NEVER include real names, emails, phone numbers, room numbers, or student IDs.`;

    // Only sanitized data leaves our server — real name stays local
    const userMessage = `Resident Alias: ${alias}\n\nSanitized Conversation Summary:\n${sanitizedText}`;

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

    // ── FERPA: Scan AI output for PII leaks BEFORE name substitution ──
    const rawSummaryFromAI = parsed.enhancedSummary || '';
    let finalChallenges = parsed.challenges || 'None';

    const summaryHasPII = scanForPII(rawSummaryFromAI, residentName);
    const challengesHasPII = scanForPII(finalChallenges, residentName);

    // Replace "Resident" placeholder with actual first name for the final output
    let finalSummary = rawSummaryFromAI.replace(/\bResident\b/g, residentName.split(' ')[0]);

    if (summaryHasPII || challengesHasPII) {
        return {
            residentName: residentName,
            enhancedSummary: 'NEEDS MANUAL REVIEW',
            theme: parsed.theme,  // theme is a category label — safe to keep
            challenges: challengesHasPII ? 'NEEDS MANUAL REVIEW' : finalChallenges
        };
    }

    return {
        residentName: residentName,
        enhancedSummary: finalSummary,
        theme: parsed.theme,
        challenges: finalChallenges
    };
};
