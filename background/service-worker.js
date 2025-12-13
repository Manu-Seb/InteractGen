// background/service-worker.js

// Import detection logic if needed, but we mostly trust the message payload
// import { detectPageType } from '../utils/page-detector.js'; 
import { GEMINI_API_KEY } from '../config.js';

import { generateGeminiReply } from '../utils/gemini-api.js';

// ---- Setup & Install ----
chrome.runtime.onInstalled.addListener(() => {
    console.log("Context-Aware AI Assistant installed.");
    // Initialize storage defaults
    chrome.storage.sync.set({
        settings: {
            enableSidebar: true,
            enableReminders: true
        },
        researchSessions: []
    });
});

// ---- Message Handling ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. AI Actions
    // 1. AI Actions
    // 1. AI Actions
    if (message.action.startsWith("REQUEST_")) {
        handleAIRequest(message, sender)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ data: "Error: " + error.message }));
        return true; // async response
    }

    // 2. Chat
    if (message.action === "SEND_CHAT") {
        handleChat(message, sender).then(response => sendResponse(response));
        return true;
    }

    // 3. Reminders
    if (message.action === "SET_REMINDER") {
        createReminder(message).then(() => sendResponse({ success: true }));
        return true;
    }

    // 4. Research
    if (message.action === "ADD_TO_RESEARCH") {
        addToResearch(message).then(() => sendResponse({ success: true }));
        return true;
    }

    // 5. Sidebar Control
    if (message.action === "CLOSE_SIDEBAR") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "CLOSE_SIDEBAR" });
            }
        });
        return true;
    }

    // 6. Generic Relay
    // If content script sends INIT_SIDEBAR, it might just be for logging or tracking active tab state
});

// ---- Core Logic Stubs ----

async function handleAIRequest(msg, sender) {
    // No delay

    let responseData = "";

    try {
        console.log("Service Worker: Handling AI Request", msg.action);
        switch (msg.action) {
            case "REQUEST_SUMMARY": // Blog
                console.log("Service Worker: Generating Summary...");
                const summaryText = msg.payload?.text || "No text provided.";
                const summaryPrompt = `Summarize this article text concisely. Focus on the main argument and conclusion.\n\nText:\n${summaryText.substring(0, 10000)}`;
                const summaryRes = await generateGeminiReply("You are a helpful reading assistant.", summaryPrompt, { url: msg.url, pageType: msg.pageType });
                responseData = summaryRes.reply || summaryRes.error;
                break;
            case "REQUEST_KEYPOINTS":
                console.log("Service Worker: Generating Key Points...");
                const kpText = msg.payload?.text || "No text provided.";
                const kpPrompt = `Extract 3-5 key bullet points from this text.\n\nText:\n${kpText.substring(0, 10000)}`;
                const kpRes = await generateGeminiReply("You are a helpful reading assistant.", kpPrompt, { url: msg.url, pageType: msg.pageType });
                responseData = kpRes.reply || kpRes.error;
                break;
            case "REQUEST_PRODUCT_COMPARISON": // Marketplace
                responseData = "💰 Price Comparison:\n- Amazon: $29.99\n- eBay: $24.50 (Used)\n- Official Store: $35.00\n\nRecommendation: eBay offers best value if you don't mind open-box.";
                break;
            case "REQUEST_SIMILAR_ITEMS": // Marketplace - "Price Check & Compare"
                // 1. SEARCH: Ask Gemini with Grounding
                console.log("Service Worker: Processing PRICE_CHECK");
                const product = msg.payload?.product || {};
                const searchPrompt = `I want to buy "${product.title || 'this item'}". \n\nSearch (using Google Grounding) for the current price of this specific product at major retailers like Amazon, Walmart, Best Buy, eBay, and official stores.\n\nProvide the list of retailers found, their listed price if visible to you, and the DIRECT link to the product page.`;

                console.log("Service Worker: Step 1 - Search Prompt...", searchPrompt);

                // Race against timeout
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ error: "Request timed out after 25s" }), 25000));
                const searchApiPromise = generateGeminiReply("You are a shopping assistant. Find prices.", searchPrompt, { url: msg.url, pageType: msg.pageType, useGrounding: true });

                const searchResult = await Promise.race([searchApiPromise, timeoutPromise]);
                console.log("Service Worker: Step 1 Result", searchResult);

                if (searchResult.error) {
                    responseData = searchResult.error;
                    break;
                }

                // 2. SCRAPE: Verify prices via Offscreen
                let scrapedData = [];
                try {
                    await setupOffscreenDocument('offscreen/offscreen.html');

                    const urlRegex = /(https?:\/\/[^\s)]+)/g;
                    const links = searchResult.reply.match(urlRegex) || [];
                    const uniqueLinks = [...new Set(links)].filter(l => !l.includes('google.com/search')).slice(0, 3);

                    if (uniqueLinks.length > 0) {
                        console.log("Service Worker: Step 2 - Scraping links...", uniqueLinks);

                        for (const link of uniqueLinks) {
                            try {
                                const scrapeResponse = await chrome.runtime.sendMessage({ action: "SCRAPE_URL", url: link });
                                if (scrapeResponse && scrapeResponse.success) {
                                    scrapedData.push({
                                        url: link,
                                        title: scrapeResponse.data.title,
                                        price: scrapeResponse.data.price || "Price not detected"
                                    });
                                } else {
                                    scrapedData.push({ url: link, error: "Connection failed" });
                                }
                            } catch (e) {
                                console.warn("Scrape error", link, e);
                            }
                        }
                    }
                } catch (err) {
                    console.warn("Offscreen Step Failed:", err);
                }

                // 3. FORMAT: Ask Gemini to present the final data
                console.log("Service Worker: Step 3 - Formatting...");
                const formatPrompt = `
                I have the following product data found for "${product.title}":

                ${JSON.stringify(scrapedData, null, 2)}

                Original AI Search Result:
                ${searchResult.reply}

                INSTRUCTION:
                Create a concise, beautiful list of these buying options. 
                For each option, show the Store/Product Name, the Verified Price (from the scraped data if available), and the Link.
                
                CRITICAL RULES:
                1. DO NOT CHANGE THE LINKS AT ALL. Use the exact URLs provided in the JSON/text.
                2. If a price was verified (in the JSON), use that and add a ✅ emoji.
                3. Format as a clean list or bullet points.
                `;

                const formatResult = await generateGeminiReply("You are a formatter. Do not hallucinate links.", formatPrompt, { url: msg.url, pageType: msg.pageType });

                responseData = formatResult.reply || formatResult.error;
                break;
            case "REQUEST_README_SUMMARY": // Dev via Auto-Init
                console.log("Service Worker: Summarizing README...");
                const readme = msg.payload?.readme || "No README found.";
                const readmePrompt = `You are a savvy technical lead. Summarize this README file for a developer audience. 
                
                Structure:
                1. **What is it?** (1 sentence)
                2. **Key Features** (Bullet points)
                3. **Installation/Usage** (Quick summary)
                
                README Content:
                ${readme}`;

                const readmeResult = await generateGeminiReply("You are a tech lead.", readmePrompt, { url: msg.url, pageType: msg.pageType });
                responseData = readmeResult.reply || readmeResult.error;
                break;
            case "REQUEST_CODE_EXPLAIN": // Dev
                console.log("Service Worker: Explaining Code...");
                const codeToExplain = msg.payload?.code || "No code provided.";
                const explainPrompt = `Explain this code snippet concisely. proper markdown. \n\n${codeToExplain.substring(0, 5000)}`;
                const explainRes = await generateGeminiReply("You are a senior developer.", explainPrompt, { url: msg.url, pageType: msg.pageType });
                responseData = explainRes.reply || explainRes.error;
                break;
            // case "SEND_CHAT": Removed (moved to handleChat)

            case "REQUEST_AGENT_PLAN":
                console.log("Service Worker: Agent Planning...");
                const agentPrompt = msg.prompt;
                // Use skipContext because the prompt itself contains all necessary details
                const planResult = await generateGeminiReply("You are a browser automation agent.", agentPrompt, { skipContext: true });
                responseData = planResult.reply || planResult.error;
                break;

            case "REQUEST_DOCS": // Dev - Find Docs
                console.log("Service Worker: Finding Docs (AI Search)...");
                const codeForDocs = msg.payload?.code || "No code provided.";

                const docsPrompt = `You are a technical documentation expert. 
                Analyze the following code snippet and identify EVERY specific function call, class, or method used from external libraries/frameworks.

                1. **Function-Level Explanation**: For EACH function/method found (e.g., 'useEffect', 'axios.get', 'path.join'), explain exactly what it does *in the context of this code*.
                2. **Deep Documentation Links**: Provide the direct, specific documentation link for that FUNCTION or method if available (not just the homepage).

                Format the output as a clean list:
                - **\`functionName\`** (Library): Explanation... [Link](...)
                
                Code Snippet:
                ${codeForDocs.substring(0, 3000)}`;

                const docsRes = await generateGeminiReply("You are a helpful developer assistant. Use Google Search to find specific function docs.", docsPrompt, { url: msg.url, pageType: msg.pageType, useGrounding: true });
                responseData = docsRes.reply || docsRes.error;
                break;
            case "REQUEST_SIMILAR_COURSES": // Online Course
                responseData = "📚 Similar Courses:\n1. Python for Everybody (Coursera)\n2. Machine Learning by Andrew Ng (Coursera)\n3. Complete Python Bootcamp (Udemy)\n4. Intro to Computer Science (Udacity)\n\nRecommendation: 'Python for Everybody' is a great starting point.";
                break;
            default:
                responseData = "Processed request: " + msg.action;
        }
    } catch (e) {
        console.error("AI Request Error: ", e);
        responseData = "Error processing request: " + e.message;
    }

    return { data: responseData };
}

async function handleChat(msg, sender) {
    console.log("Service Worker: Chat Message Received:", msg.message);

    // 1. Intent Analysis
    try {
        const intent = await analyzeMessage(msg.message, GEMINI_API_KEY);
        console.log("Service Worker: Intent:", intent);

        if (intent.type === "TASK") {
            // --- TASK EXECUTION ---
            console.log("Service Worker: Routing to DOM Agent...");
            try {
                let tabId = sender.tab?.id;
                if (!tabId) {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    tabId = tabs[0]?.id;
                }

                if (tabId) {
                    const goal = intent.payload?.goal || msg.message;
                    const agentRes = await chrome.tabs.sendMessage(tabId, {
                        action: "EXECUTE_AGENT_TASK",
                        goal: goal
                    });

                    let replyText = "";
                    if (agentRes && agentRes.success) {
                        if (agentRes.result && agentRes.result.history && agentRes.result.history.length > 0) {
                            replyText = "✅ **Task Complete**\n\nActions taken:\n" +
                                agentRes.result.history.map(h => `- ${h.action} on ${h.selector}`).join('\n');
                        } else {
                            replyText = "✅ **Task Complete** (No visible actions recorded)";
                        }
                    } else {
                        replyText = "⚠️ **Task Failed**\n\n" + (agentRes?.error || "Unknown error");
                    }
                    return { reply: replyText };
                } else {
                    throw new Error("No active tab found for agent.");
                }
            } catch (e) {
                console.error("Agent Execution Error:", e);
                return { reply: "I tried to run the agent but encountered an error: " + e.message };
            }

        } else if (intent.type === "DATA_SAVE") {
            // --- DATA SAVING ---
            const { key, value } = intent.payload || {};
            if (key && value) {
                try {
                    // Fetch existing
                    const data = await chrome.storage.sync.get("userProfileData");
                    const profile = data.userProfileData || {};

                    // Update
                    profile[key] = value;

                    // Save back
                    await chrome.storage.sync.set({ userProfileData: profile });
                    return { reply: `✅ Saved **${key}** as "${value}".` };
                } catch (e) {
                    return { reply: "❌ Failed to save data: " + e.message };
                }
            } else {
                return { reply: "I understood you want to save data, but I couldn't extract the details. Please try 'My email is...'" };
            }

        } else {
            // --- NORMAL CHAT ---
            // Minimalistic system instruction + RoboForm guard
            const systemPrompt = "You are a helpful browser assistant. If the user asks to fill a form or do a task, tell them 'I can do that! Just ask me to 'fill this form'.'. Do NOT suggest external tools like RoboForm. You ARE the automation tool.";
            const chatRes = await generateGeminiReply(systemPrompt, msg.message, { ...msg.context }, sender.tab?.id);
            return { reply: chatRes.reply || chatRes.error };
        }
    } catch (err) {
        console.error("Intent/Chat Error:", err);
        return { reply: "Error processing your request: " + err.message };
    }
}

async function analyzeMessage(userMessage, apiKeyOverride = null) {
    const prompt = `
    Analyze this user message: "${userMessage}"
    
    Classify into one of 3 types:
    1. "TASK": User wants to perform an action on the page (Fill form, click, search, scroll). BE TOLERANT OF TYPOS (e.g. "fil", "fill", "clic").
    2. "DATA_SAVE": User is providing personal information to remember (e.g. "My email is...", "Set name to...").
    3. "CHAT": General question or conversation.

    If "DATA_SAVE", extract the key (normalized, proper case) and value.
    If "TASK", refine the goal.

    Examples:
    - "Fill this form" -> { "type": "TASK", "payload": { "goal": "Fill this form" } }
    - "fil this form" -> { "type": "TASK", "payload": { "goal": "Fill this form" } }
    - "My email is bob@test.com" -> { "type": "DATA_SAVE", "payload": { "key": "Email", "value": "bob@test.com" } }
    - "my name is manu" -> { "type": "DATA_SAVE", "payload": { "key": "Name", "value": "manu" } }
    - "Hello" -> { "type": "CHAT" }

    Return JSON ONLY:
    {
        "type": "TASK" | "DATA_SAVE" | "CHAT",
        "payload": { ... }
    }
    `;

    // We reuse generateGeminiReply but simpler
    try {
        const response = await generateGeminiReply("You are an intent classifier. JSON only.", prompt, { skipContext: true }, null);
        let text = response.reply || "";
        if (text.includes('```json')) {
            text = text.replace(/```json/g, '').replace(/```/g, '');
        }
        return JSON.parse(text);
    } catch (e) {
        console.warn("Intent detection failed, assuming chat.", e);
        return { type: "CHAT" };
    }
}

async function createReminder(msg) {
    const delayMinutes = msg.offsetSeconds / 60;
    const alarmName = `reminder-${Date.now()}`;

    chrome.alarms.create(alarmName, { delayInMinutes: delayMinutes });

    // Store metadata
    const reminder = {
        id: alarmName,
        url: msg.url,
        title: msg.title,
        time: Date.now() + (msg.offsetSeconds * 1000)
    };

    const data = await chrome.storage.local.get("reminders");
    const list = data.reminders || [];
    list.push(reminder);
    await chrome.storage.local.set({ reminders: list });
}

async function addToResearch(msg) {
    const sessionItem = {
        url: msg.url,
        title: msg.title,
        pageType: msg.pageType,
        timestamp: Date.now()
    };

    const data = await chrome.storage.local.get("researchSession");
    const list = data.researchSession || [];
    list.push(sessionItem);
    await chrome.storage.local.set({ researchSession: list });
}

// ---- Alarms ----
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith("reminder-")) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icon48.png', // Ensure this exists or use a default
            title: 'Time to check back!',
            message: 'You have a reminder for a saved page.',
            buttons: [{ title: 'Open Page' }]
        });

        // Notify sidebar if open?
        chrome.runtime.sendMessage({ action: "REMINDER_TRIGGERED", title: "Saved Page" });
    }
});

// ---- Offscreen API Management ----
let creatingOffscreen; // Promise to prevent race conditions

async function setupOffscreenDocument(path) {
    if (!(chrome && chrome.runtime && chrome.runtime.getContexts)) {
        console.warn("Offscreen API not available (Chrome < 109)");
        return;
    }
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [path]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Create if not exists
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: path,
            reasons: ['DOM_SCRAPING'],
            justification: 'Scraping product data from competitor sites in background.'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}
