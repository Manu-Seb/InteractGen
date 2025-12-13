// sidebar.js

// State
let currentPageType = "generic";
let currentUrl = "";
let currentTitle = "";
let currentProductData = {};
let currentCodeContent = "";

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Listen for messages from parent (content script) or background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "INIT_SIDEBAR") {
            initializeSidebar(message);
        } else if (message.action === "UPDATE_SIDEBAR_CONTENT") {
            handleContentUpdate(message.data);
        }
    });

    // Also listen for direct window messages (more reliable from content script)
    window.addEventListener("message", (event) => {
        if (event.data.action === "INIT_SIDEBAR") {
            initializeSidebar(event.data);
        }
    });

    // Initial setup listeners
    setupGlobalListeners();
});

function initializeSidebar(data) {
    currentPageType = data.pageType;
    currentUrl = data.url;
    currentTitle = data.title || "";
    if (data.productData) currentProductData = data.productData;

    // Crucial: Set code content from initialization data
    if (data.codeContent) {
        currentCodeContent = data.codeContent;
        console.log("Sidebar: Code content loaded", currentCodeContent.substring(0, 50));
    } else {
        currentCodeContent = "";
    }

    updateUI();

    // Auto-Action: If README content is provided, summarize it immediately
    if (data.readmeContent) {
        performAction('summarize_readme', { readme: data.readmeContent });
    }
}
// ... (lines 52-166 omitted)
const payload = { ...extraPayload };
if (fullAction === 'REQUEST_SIMILAR_ITEMS') {
    payload.product = currentProductData;
}
if (fullAction === 'REQUEST_SIMILAR_COURSES') {
    payload.title = currentTitle;
}
if (['REQUEST_CODE_EXPLAIN', 'REQUEST_DOCS'].includes(fullAction)) {
    payload.code = currentCodeContent || "No visible code found on page.";
}

function setupGlobalListeners() {
    document.getElementById('close-btn').addEventListener('click', () => {
        window.parent.postMessage({ action: "CLOSE_SIDEBAR" }, "*");
    });

    // Event Delegation for static elements or bubble-up events
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

        // 5. Research
        if (e.target.id === 'add-session-btn') {
            addToResearchSession();
            return;
        }
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
    }

    // Initialize layout for the new content
    setupChatListeners();
    loadChatHistory();
    loadSavedPages(); // Safe to call even if element not present
}

function setupChatListeners() {
    // These IDs now exist inside the cloned template in main-content
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');

    if (sendBtn && userInput) {
        sendBtn.addEventListener('click', sendChatMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const content = document.getElementById(`tab-${tabName}`);
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);

    if (content && btn) {
        content.classList.add('active');
        btn.classList.add('active');
    }
}

// Actions -> Background
function performAction(actionName, extraPayload = {}) {
    const resultBox = document.querySelector('.result-box');
    if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.innerHTML = '<div class="spinner"></div> Analyze & summarize...';
    }

    const actionMap = {
        'summarize': 'REQUEST_SUMMARY',
        'summarize_readme': 'REQUEST_README_SUMMARY',
        'keypoints': 'REQUEST_KEYPOINTS',
        'compare': 'REQUEST_PRODUCT_COMPARISON',
        'explain': 'REQUEST_CODE_EXPLAIN',
        'docs': 'REQUEST_DOCS', // Changed from bugs
        'similar-courses': 'REQUEST_SIMILAR_COURSES',
        'similar': 'REQUEST_SIMILAR_ITEMS'
    };

    const fullAction = actionMap[actionName] || actionName.toUpperCase();

    const payload = { ...extraPayload };
    if (fullAction === 'REQUEST_SIMILAR_ITEMS') {
        payload.product = currentProductData;
    }
    if (fullAction === 'REQUEST_SIMILAR_COURSES') {
        payload.title = currentTitle;
    }
    if (['REQUEST_CODE_EXPLAIN', 'REQUEST_DOCS'].includes(fullAction)) {
        payload.code = currentCodeContent || "No visible code found on page.";
    }

    console.log("Sidebar: Sending message", fullAction, payload);

    const proceedWithRequest = (finalPayload) => {
        chrome.runtime.sendMessage({
            action: fullAction,
            pageType: currentPageType,
            url: currentUrl,
            payload: finalPayload
        }, (response) => {
            console.log("Sidebar: Received response", response);

            if (chrome.runtime.lastError) {
                console.error("Sidebar Error Message:", chrome.runtime.lastError.message);
                if (resultBox) resultBox.innerText = "Error: " + chrome.runtime.lastError.message;
                return;
            }

            if (response && response.data) {
                handleContentUpdate(response.data);
            } else {
                console.warn("Sidebar: Empty response received");
                if (resultBox) resultBox.innerText = "Error: No response from AI service.";
            }
        });
    };

    // If context is needed (Summmary/Keypoints), fetch logic
    if (['REQUEST_SUMMARY', 'REQUEST_KEYPOINTS', 'REQUEST_TLDR'].includes(fullAction)) {
        // We need to get text from the parent page. 
        // We can't use chrome.tabs from sidebar, but we can query the ACTIVE tab via background relay,
        // OR postMessage to parent content script. 
        // We'll use tabs.sendMessage via background relay pattern which is cleaner for extension context.
        // Wait... sidebar is an extension page, it CAN use chrome.tabs? 
        // Yes, but only for querying. Not for content script injection unless permission.

        // Easier path: Ask background to get text OR just assume background does it?
        // Background doesn't have direct access to DOM text without executing script.

        // Let's ask the active tab directly via tabs API if we can (Sidebar has tabs permission?)
        // If not, we use the content script listener we just added.

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "GET_PAGE_TEXT" }, (response) => {
                    // Check if lastError exists (e.g. on restricted pages)
                    if (chrome.runtime.lastError || !response) {
                        console.warn("Failed to get page text", chrome.runtime.lastError);
                        payload.text = "Error: Could not read page content. (Restricted page?)";
                    } else {
                        payload.text = response.text;
                    }
                    proceedWithRequest(payload);
                });
            } else {
                payload.text = "Error: No active tab found.";
                proceedWithRequest(payload);
            }
        });
    } else {
        proceedWithRequest(payload);
    }

}

function handleContentUpdate(data) {
    const boxes = document.querySelectorAll('.result-box');
    boxes.forEach(box => {
        if (!box.classList.contains('hidden')) {
            // Use marked.parse to render Markdown
            // Optional: Configure marked if needed, but defaults are usually fine
            try {
                box.innerHTML = marked.parse(data);
            } catch (e) {
                console.error("Markdown parsing error:", e);
                box.textContent = data; // Fallback
            }
        }
    });
}
// Removed linkify() as marked handles links

// Chat
async function loadChatHistory() {
    try {
        const data = await chrome.storage.session.get("chatHistory");
        const history = data.chatHistory || [];
        if (history.length > 0) {
            history.forEach(msg => addChatMessage(msg.text, msg.role, false));
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

    chrome.runtime.sendMessage({
        action: "SEND_CHAT",
        message: msg,
        context: { url: currentUrl, pageType: currentPageType }
    }, (response) => {
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

    if (role === 'assistant') {
        try {
            div.innerHTML = marked.parse(text);
        } catch (e) {
            div.textContent = text;
        }
    } else {
        div.textContent = text; // User input as plain text for safety
    }

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
        title: document.title || currentUrl,
        timestamp: Date.now()
    };

    chrome.storage.local.get("savedPages", (data) => {
        const list = data.savedPages || [];
        if (!list.some(p => p.url === currentUrl)) {
            list.push(pageData);
            chrome.storage.local.set({ savedPages: list }, () => {
                loadSavedPages();
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

        if (list.length === 0) {
            ul.innerHTML = '<li style="padding:10px; color:#888; text-align:center;">No saved pages yet.</li>';
            return;
        }

        list.forEach((page, index) => {
            const li = document.createElement('li');
            li.className = "saved-page-item";

            // Info container
            const infoDiv = document.createElement('div');
            infoDiv.className = "saved-page-info";

            const link = document.createElement('a');
            link.href = page.url;
            link.target = "_blank";
            link.style.textDecoration = "none";
            link.style.color = "black";
            link.style.fontWeight = "500";
            link.textContent = new URL(page.url).hostname;

            const dateSpan = document.createElement('div');
            dateSpan.style.fontSize = "12px";
            dateSpan.style.color = "#666";
            dateSpan.textContent = new Date(page.timestamp).toLocaleDateString();

            infoDiv.appendChild(link);
            infoDiv.appendChild(dateSpan);

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = "delete-btn";
            deleteBtn.innerHTML = "🗑️";
            deleteBtn.title = "Remove page";
            deleteBtn.onclick = () => deleteSavedPage(index);

            li.appendChild(infoDiv);
            li.appendChild(deleteBtn);
            ul.appendChild(li);
        });
    });
}

function deleteSavedPage(index) {
    chrome.storage.local.get("savedPages", (data) => {
        const list = data.savedPages || [];
        if (index >= 0 && index < list.length) {
            list.splice(index, 1);
            chrome.storage.local.set({ savedPages: list }, () => {
                loadSavedPages(); // Refresh list
            });
        }
    });
}

// Research
function addToResearchSession() {
    chrome.runtime.sendMessage({
        action: "ADD_TO_RESEARCH",
        url: currentUrl,
        title: document.title,
        pageType: currentPageType
    }, () => {
        const list = document.getElementById('research-list');
        const item = document.createElement('div');
        item.style.padding = "8px";
        item.style.borderBottom = "1px solid #eee";
        item.textContent = "Added: " + currentUrl;
        list.appendChild(item);
    });
}
