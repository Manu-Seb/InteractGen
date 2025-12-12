// background/service-worker.js

// Import detection logic if needed, but we mostly trust the message payload
// import { detectPageType } from '../utils/page-detector.js'; 
import { GEMINI_API_KEY } from '../config.js';

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
    if (message.action.startsWith("REQUEST_")) {
        handleAIRequest(message).then(response => sendResponse(response));
        return true; // async response
    }

    // 2. Chat
    if (message.action === "SEND_CHAT") {
        handleChat(message).then(response => sendResponse(response));
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

    // 5. Sidebar Control (optional relay)
    // If content script sends INIT_SIDEBAR, it might just be for logging or tracking active tab state
});

// ---- Core Logic Stubs ----

async function handleAIRequest(msg) {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        console.warn("Gemini API Key is missing in config.js");
    } else {
        console.log("Using Gemini API Key: " + GEMINI_API_KEY.substring(0, 4) + "...");
        // TODO: Implement actual fetch request to Gemini API here
    }

    const type = msg.pageType;
    let text = "";

    switch (msg.action) {
        case "REQUEST_SUMMARY": // Blog
            text = "📌 Summary of this article:\n\nThis article discusses the importance of context-aware UI patterns. It highlights how Loom and others utilize sidebar interfaces to maintain user flow without blocking content. \n\nKey takeaways:\n- Sidebars > Modals for reference tasks\n- Context detection improves UX\n- Animation timing matters (300ms)";
            break;
        case "REQUEST_KEYPOINTS":
            text = "• Sidebar UI patterns are trending\n• Reactivity to page context is key\n• Non-blocking overlay strategies";
            break;
        case "REQUEST_PRODUCT_COMPARISON": // Marketplace
            text = "💰 Price Comparison:\n- Amazon: $29.99\n- eBay: $24.50 (Used)\n- Official Store: $35.00\n\nRecommendation: eBay offers best value if you don't mind open-box.";
            break;
        case "REQUEST_CODE_EXPLAIN": // Dev
            text = "💡 Code Explanation:\nThis function uses a heuristics-based approach to classify the current DOM. It checks for specific store indicators (meta tags) and developer site hostnames to determine the `pageType` string.";
            break;
        case "REQUEST_CODE_DEBUG":
            text = "🐛 Potential Bug:\nThe regex used for creating URL validation might miss edge cases with international domains. Consider using the `URL` API instead of string parsing.";
            break;
        case "REQUEST_SIMILAR_COURSES": // Online Course
            text = "📚 Similar Courses:\n1. Python for Everybody (Coursera)\n2. Machine Learning by Andrew Ng (Coursera)\n3. Complete Python Bootcamp (Udemy)\n4. Intro to Computer Science (Udacity)\n\nRecommendation: 'Python for Everybody' is a great starting point.";
            break;
        default:
            text = "Processed request: " + msg.action;
    }

    return { data: text };
}

async function handleChat(msg) {
    await new Promise(r => setTimeout(r, 800));
    return {
        reply: `I see you are on ${msg.context.pageType} page. detailed answer to "${msg.message}" would go here. I can help you analyze this content further.`
    };
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
