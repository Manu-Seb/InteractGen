import { GEMINI_API_KEY as DEFAULT_KEY, API_CONFIG } from '../config.js';

export async function generateGeminiReply(systemPrompt, userMessage, context) {
    // Retrieve custom key from storage
    const getCustomKey = () => new Promise(resolve => {
        chrome.storage.sync.get('settings', (items) => {
            resolve(items.settings?.apiKey || null);
        });
    });

    const customKey = await getCustomKey();
    const apiKey = (customKey && customKey.length > 10) ? customKey : DEFAULT_KEY;

    if (!apiKey || apiKey.length < 10 || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        return { error: "⚠️ Please configure a valid Gemini API Key in Extension Options." };
    }

    let model = API_CONFIG?.model || "gemini-2.5-flash-lite";
    if (["gemini-pro", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash-001"].includes(model)) {
        model = "gemini-2.5-flash-lite";
    }
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let contentText = "";
    if (context.skipContext) {
        contentText = `${systemPrompt}\n\n${userMessage}`;
    } else {
        contentText = `${systemPrompt}\n\nContext: User is on a ${context.pageType || 'unknown'} page (${context.url || 'unknown'}).\n\nUser: ${userMessage}`;
    }

    const payload = {
        contents: [{
            parts: [{
                text: contentText
            }]
        }],
        generationConfig: {
            temperature: API_CONFIG?.temperature || 0.7
        }
    };

    if (context.useGrounding && !model.includes("lite")) {
        payload.tools = [{ google_search: {} }];
    } else if (context.useGrounding && model.includes("lite")) {
        console.warn("Gemini API: Google Grounding (Search) is skipped because 'lite' models typically do not support tools.");
    }

    try {
        console.log("Gemini API: Sending request to", API_URL);
        console.log("Gemini API: Payload", JSON.stringify(payload));
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", JSON.stringify(data.error, null, 2));
            const errorMessage = data.error.message || JSON.stringify(data.error);
            return { error: `Gemini API Error: ${errorMessage}` };
        }

        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
        return { reply: replyText };

    } catch (error) {
        console.error("Network Error:", error);
        return { error: "Failed to connect to Gemini API." };
    }
}
