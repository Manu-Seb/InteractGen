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
        }
    });

    // Initial setup listeners
    setupGlobalListeners();
});

function setupGlobalListeners() {
    document.getElementById('close-btn').addEventListener('click', () => {
        // Send message to content script key "parent"
        window.parent.postMessage({ action: "CLOSE_SIDEBAR" }, "*");
    });


    // Event Delegation for Dynamic Content
    document.getElementById('main-content').addEventListener('click', (e) => {
        // 1. Tabs
        const tabBtn = e.target.closest('.tab-btn');
        if (tabBtn) {
            showTab(tabBtn.dataset.tab);
            return;
        }

        // 2. Action Cards
        const actionCard = e.target.closest('.action-card');
        if (actionCard) {
            performAction(actionCard.dataset.action);
            return;
        }

        // 3. Small Buttons / Options
        const smallBtn = e.target.closest('.small-btn');
        if (smallBtn) {
            performAction(smallBtn.dataset.action);
            return;
        }

        // 4. Saved Pages
        if (e.target.id === 'save-page-btn') {
            saveCurrentPage();
            return;
        }

        // 5. Research - Add Session
        if (e.target.id === 'add-session-btn') {
            addToResearchSession();
            return;
        }
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
        // Note: Event delegation in setupGlobalListeners handles clicks now
    }

    // Toggle footer
    const footer = document.getElementById('footer-input');
    if (currentPageType === "generic") {
        footer.classList.remove('hidden');
        loadChatHistory(); // Restore chat when generic template is loaded
        loadSavedPages();
    } else {
        footer.classList.add('hidden');
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
async function loadChatHistory() {
    console.log("Sidebar: Loading chat history...");
    try {
        const data = await chrome.storage.session.get("chatHistory");
        console.log("Sidebar: Got history data:", data);
        const history = data.chatHistory || [];
        if (history.length > 0) {
            console.log(`Sidebar: Restoring ${history.length} messages`);
            history.forEach(msg => addChatMessage(msg.text, msg.role, false)); // Don't re-save
        }
    } catch (e) {
        console.error("Sidebar: Session storage error:", e);
    }
}

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

function addChatMessage(text, role, save = true) {
    const history = document.getElementById('chat-history');
    if (!history) return;

    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.textContent = text;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;

    if (save) {
        chrome.storage.session.get("chatHistory", (data) => {
            const list = data.chatHistory || [];
            list.push({ text, role, timestamp: Date.now() });
            chrome.storage.session.set({ chatHistory: list });
        });
    }
}

// Saved Pages
function saveCurrentPage() {
    const pageData = {
        url: currentUrl,
        title: document.title || currentUrl, // Ideally passed from content script, but URL works for now
        timestamp: Date.now()
    };

    chrome.storage.local.get("savedPages", (data) => {
        const list = data.savedPages || [];
        // Check duplicate
        if (!list.some(p => p.url === currentUrl)) {
            list.push(pageData);
            chrome.storage.local.set({ savedPages: list }, () => {
                loadSavedPages(); // Refresh UI
                alert("Page saved!");
            });
        } else {
            alert("Page already saved.");
        }
    });
}

function loadSavedPages() {
    chrome.storage.local.get("savedPages", (data) => {
        const list = data.savedPages || [];
        const ul = document.getElementById('saved-pages-list');
        if (!ul) return;

        ul.innerHTML = "";
        list.forEach(page => {
            const li = document.createElement('li');
            li.className = "list-item"; // Reuse existing styles if possible or generic
            li.style.padding = "8px";
            li.style.borderBottom = "1px solid #eee";
            li.innerHTML = `<a href="${page.url}" target="_blank" style="text-decoration:none; color:black; font-weight:500;">${new URL(page.url).hostname}</a><br><small>${new Date(page.timestamp).toLocaleDateString()}</small>`;
            ul.appendChild(li);
        });
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
