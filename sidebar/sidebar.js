// sidebar.js

// State
let currentPageType = "generic";
let currentUrl = "";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Listen for messages from parent (content script) or background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "INIT_SIDEBAR") {
            currentPageType = message.pageType;
            currentUrl = message.url;
            updateUI();
        } else if (message.action === "UPDATE_SIDEBAR_CONTENT") {
            handleContentUpdate(message.data);
        } else if (message.action === "REMINDER_TRIGGERED") {
            // Highlight reminders tab or show alert
            alert(`Reminder: ${message.titletitle}`);
            showTab("reminders");
        }
    });

    // Initial setup listeners
    setupGlobalListeners();
});

function setupGlobalListeners() {
    document.getElementById('close-btn').addEventListener('click', () => {
        // Send message to content script to hide iframe
        window.parent.postMessage({ action: "CLOSE_SIDEBAR" }, "*");
    });

    document.getElementById('minimize-btn').addEventListener('click', () => {
        window.parent.postMessage({ action: "MINIMIZE_SIDEBAR" }, "*");
    });

    document.getElementById('send-btn').addEventListener('click', sendChatMessage);
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

function updateUI() {
    const badge = document.getElementById('page-type-badge');
    badge.textContent = currentPageType;

    const main = document.getElementById('main-content');
    main.innerHTML = ""; // Clear existing

    // Load template
    let templateId = "template-generic";
    if (["blog", "marketplace", "dev", "online-course"].includes(currentPageType)) {
        templateId = `template-${currentPageType}`;
    }

    const template = document.getElementById(templateId);
    if (template) {
        const clone = template.content.cloneNode(true);
        main.appendChild(clone);
        attachDynamicListeners(main);
    }

    // Toggle footer
    const footer = document.getElementById('footer-input');
    if (currentPageType === "generic") {
        footer.classList.remove('hidden');
    } else {
        footer.classList.add('hidden');
    }
}

function attachDynamicListeners(container) {
    // Action Cards
    container.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            performAction(action);
        });
    });

    // Tabs
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
        });
    });

    // Small buttons (options)
    container.querySelectorAll('.small-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            performAction(btn.dataset.action);
        });
    });

    // Reminders
    container.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setReminder(parseInt(btn.dataset.time));
        });
    });

    // Research
    const addSessionBtn = container.querySelector('#add-session-btn');
    if (addSessionBtn) {
        addSessionBtn.addEventListener('click', addToResearchSession);
    }
}

function showTab(tabName) {
    // Hide all
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Show target
    const content = document.getElementById(`tab-${tabName}`);
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

    if (content && btn) {
        content.classList.add('active');
        btn.classList.add('active');
    }
}

// Actions -> Background
function performAction(actionName) {
    // Show loading
    const resultBox = document.querySelector('.result-box');
    if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = '<div class="spinner"></div> Processing...';
    }

    // Map short action names to full event names
    const actionMap = {
        'summarize': 'REQUEST_SUMMARY',
        'keypoints': 'REQUEST_KEYPOINTS',
        'compare': 'REQUEST_PRODUCT_COMPARISON',
        'explain': 'REQUEST_CODE_EXPLAIN',
        'bugs': 'REQUEST_CODE_DEBUG',
        'similar-courses': 'REQUEST_SIMILAR_COURSES'
    };

    const fullAction = actionMap[actionName] || actionName.toUpperCase();

    chrome.runtime.sendMessage({
        action: fullAction,
        pageType: currentPageType,
        url: currentUrl,
        payload: { /* could contain selected text etc */ }
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        // Handle immediate response or wait for async update
        if (response && response.data) {
            handleContentUpdate(response.data);
        }
    });
}

function handleContentUpdate(data) {
    // Generic handler to dump text into the result box
    const boxes = document.querySelectorAll('.result-box');
    // For now update all visible result boxes
    boxes.forEach(box => {
        if (!box.classList.contains('hidden')) {
            box.innerText = data; // Plain text for now
        }
    });
}

// Chat
function sendChatMessage() {
    const input = document.getElementById('user-input');
    const msg = input.value.trim();
    if (!msg) return;

    addChatMessage(msg, 'user');
    input.value = "";

    // Send to background
    chrome.runtime.sendMessage({
        action: "SEND_CHAT",
        message: msg,
        context: { url: currentUrl, pageType: currentPageType }
    }, (response) => {
        // Echo response
        if (response && response.reply) {
            addChatMessage(response.reply, 'assistant');
        }
    });
}

function addChatMessage(text, role) {
    const history = document.getElementById('chat-history');
    if (!history) return;

    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

// Reminders
function setReminder(seconds) {
    chrome.runtime.sendMessage({
        action: "SET_REMINDER",
        url: currentUrl,
        title: document.title || "Page Reminder",
        offsetSeconds: seconds
    }, () => {
        alert("Reminder set!");
        // Refresh list logic would go here
    });
}

// Research
function addToResearchSession() {
    chrome.runtime.sendMessage({
        action: "ADD_TO_RESEARCH",
        url: currentUrl,
        title: document.title, // In real app, pass title from content script or query it
        pageType: currentPageType
    }, () => {
        // Optimistic UI update
        const list = document.getElementById('research-list');
        const item = document.createElement('div');
        item.style.padding = "8px";
        item.style.borderBottom = "1px solid #eee";
        item.textContent = "Added: " + currentUrl;
        list.appendChild(item);
    });
}
