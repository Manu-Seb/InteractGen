/* content.js */

// Constants
const SIDEBAR_WIDTH = "380px";
let sidebarOpen = false;
let sidebarIframe = null;
let shadowHost = null;
let shadowRoot = null;
let toggleBtn = null;

// Page Type (detected asynchronously)
let detectedPageType = "generic";

// Initialize
(async function init() {
    // 1. Detect Page Type
    try {
        // Now loaded via manifest content_scripts, so function is global
        if (typeof detectPageType === 'function') {
            detectedPageType = detectPageType(document);
            console.log("Extension detected page type:", detectedPageType);
        } else {
            console.warn("detectPageType function not found");
        }
    } catch (e) {
        console.error("Failed to detect page type:", e);
    }

    // 2. Inject UI
    injectSidebar();

    // 3. Listen for window messages (from sidebar iframe)
    window.addEventListener("message", (event) => {
        // Security check: only accept from our iframe if possible, but 
        // since iframe is same-origin (chrome-extension://), we can verify logic or just trust simple actions
        if (event.data.action === "CLOSE_SIDEBAR") {
            toggleSidebar(false);
        }
        if (event.data.action === "MINIMIZE_SIDEBAR") {
            toggleSidebar(false);
        }
    });

    // 4. Listen for background messages
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === "TOGGLE_SIDEBAR") { // From context menu or shortcut
            toggleSidebar(!sidebarOpen, false); // No force refresh
        }
        if (msg.action === "CLOSE_SIDEBAR") {
            toggleSidebar(false);
        }
        if (msg.action === "ANALYZE_REQUEST") {
            // Example: User clicked "Analyze with AI" in context menu
            toggleSidebar(true, true); // FORCE REFRESH to capture new selection
            // Forward to sidebar
            setTimeout(() => sendToSidebar({ action: "UPDATE_SIDEBAR_CONTENT", data: "Analyzing selection..." }), 500);
        }

        // 5. Agent Task Execution (Chat Triggered)
        if (msg.action === "EXECUTE_AGENT_TASK") {
            const { goal } = msg;
            console.log("Sidebar: Received Agent Task:", goal);

            // Ensure Agent is available
            if (window.domAgent) {
                // We need to return a Promise for sendResponse if we await async work
                // But runtime.onMessage async handling requires returning true
                window.domAgent.performTask(goal, {})
                    .then(result => {
                        sendResponse({ success: true, result });
                    })
                    .catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep channel open
            } else {
                sendResponse({ success: false, error: "DOM Agent not loaded." });
            }
        }

        // 6. Text Extraction for Summarization
        if (msg.action === "GET_PAGE_TEXT") {
            // Simple innerText for now. Could be improved with Readability.js later.
            const text = document.body.innerText.substring(0, 15000); // Limit size
            sendResponse({ text: text || "No text found." });
            return false; // Sync response
        }
    });

    // 5. Code Block listeners (for Dev mode)
    if (detectedPageType === "dev") {
        setupCodeInteractions();
    }

    // 6. Auto-close removed to allow per-tab persistence
    // document.addEventListener("visibilitychange", () => ... );
    // 7. Click outside to minimize (User Request)
    document.addEventListener('click', (event) => {
        if (sidebarOpen && shadowHost) {
            // Check if the click target is NOT the shadow host (which contains the toggle btn/iframe)
            // If the user clicks the main page content, the target will be some body element.
            if (event.target !== shadowHost) {
                console.log("Sidebar: Click outside detected, closing.");
                toggleSidebar(false);
            }
        }
    });

    // 8. Expose DOMAgent for testing (User Request)
    try {
        const src = chrome.runtime.getURL("content/dom-agent.js");
        const { DOMAgent } = await import(src);
        window.domAgent = new DOMAgent();
        console.log("Sidebar: DOMAgent loaded and available as window.domAgent");
    } catch (e) {
        console.error("Sidebar: Failed to load DOMAgent", e);
    }

})();

function injectSidebar() {
    // Create Shadow Host
    shadowHost = document.createElement('div');
    shadowHost.id = "ai-sidebar-host";
    shadowHost.style.position = "fixed";
    shadowHost.style.zIndex = "2147483647"; // Max z-index
    shadowHost.style.top = "0";
    shadowHost.style.left = "0"; // Ensure coverage
    shadowHost.style.width = "100vw";
    shadowHost.style.height = "100vh";
    shadowHost.style.pointerEvents = "none"; // Let clicks pass through by default
    document.body.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // Styles for Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        .sidebar-iframe {
            position: fixed;
            top: 0;
            right: -${SIDEBAR_WIDTH}; /* Start off-screen */
            width: ${SIDEBAR_WIDTH};
            height: 100vh;
            border: none;
            background: white;
            box-shadow: -5px 0 15px rgba(0,0,0,0.1);
            transition: right 0.3s ease-in-out;
            z-index: 2147483647;
            display: block;
            pointer-events: auto; /* Capture clicks inside sidebar */
        }
        .sidebar-iframe.open {
            right: 0;
        }
        .toggle-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: #6366f1;
            color: white;
            border: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            cursor: pointer;
            z-index: 2147483646;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
            pointer-events: auto; /* Capture clicks on button */
        }
        .toggle-btn:hover {
            transform: scale(1.1);
        }
    `;
    shadowRoot.appendChild(style);

    // Iframe
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.className = "sidebar-iframe";
    sidebarIframe.src = chrome.runtime.getURL("sidebar/sidebar.html");
    shadowRoot.appendChild(sidebarIframe);

    // Toggle Button
    toggleBtn = document.createElement('button');
    toggleBtn.className = "toggle-btn";
    toggleBtn.textContent = "🤖";
    toggleBtn.title = "Open AI Assistant";
    toggleBtn.addEventListener('click', () => toggleSidebar(!sidebarOpen, false));
    shadowRoot.appendChild(toggleBtn);
}

// ... (existing code) ...

function extractProductData() {
    // 1. Title
    let title = document.title;
    const titleEl = document.querySelector("#productTitle") || document.querySelector("h1");
    if (titleEl) title = titleEl.innerText.trim();

    // 2. Price
    let price = "N/A";
    const priceSelectors = [
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-price .a-offscreen",
        ".price",
        "[itemprop='price']",
        "meta[property='og:price:amount']",
        "meta[property='product:price:amount']"
    ];

    for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            price = el.innerText || el.content || "N/A";
            if (price !== "N/A") break;
        }
    }

    return { title, price };
}

function extractReadme() {
    const readmeEl = document.querySelector(".markdown-body") || document.querySelector("article");
    if (readmeEl) {
        return readmeEl.innerText.substring(0, 15000);
    }
    return null;
}


// State Tracking for Caching
let isSidebarInitialized = false;
let lastUrl = "";

async function toggleSidebar(open, forceRefresh = false) {
    sidebarOpen = open;
    if (open) {
        sidebarIframe.classList.add('open');

        // CACHING CHECK:
        // If not forced, already init, and same URL -> Do nothing (retain state)
        if (!forceRefresh && isSidebarInitialized && window.location.href === lastUrl) {
            console.log("Sidebar: Restoring cached state.");
            return;
        }

        console.log("Sidebar: Initializing/Refreshing content...");

        // Extract Data based on Page Type
        let payload = {};
        if (detectedPageType === "marketplace") {
            payload = { productData: extractProductData() };
        } else if (detectedPageType === "dev") {
            const readmeText = extractReadme();
            if (readmeText) payload.readmeContent = readmeText;

            // Updated: Async Code Extraction to support Raw Fetching
            const visualCode = await extractCodeAsync();
            if (visualCode) payload.codeContent = visualCode;
        }

        // Initialize sidebar state
        sendToSidebar({
            action: "INIT_SIDEBAR",
            pageType: detectedPageType,
            url: window.location.href,
            title: document.title, // Pass title for context
            productData: payload.productData,
            ...payload
        });

        // Update Cache State
        isSidebarInitialized = true;
        lastUrl = window.location.href;

    } else {
        sidebarIframe.classList.remove('open');
    }
}

async function extractCodeAsync() {
    console.log("Sidebar: Attempting to extract code (Async)...");

    // Strategy 1: Fetch Raw Content (Best for GitHub)
    // Looks for the "Raw" button and fetches the URL directly
    try {
        const rawButton =
            document.querySelector('a[data-testid="raw-button"]') ||
            document.querySelector('a[href*="/raw/"]');

        if (rawButton && rawButton.href) {
            console.log("Sidebar: Found Raw button, fetching...", rawButton.href);
            const response = await fetch(rawButton.href);
            if (response.ok) {
                const text = await response.text();
                if (text.length > 0) {
                    console.log("Sidebar: Successfully fetched raw content");
                    return text.substring(0, 15000); // Limit size
                }
            } else {
                console.warn("Sidebar: Failed to fetch raw content", response.status);
            }
        }
    } catch (e) {
        console.error("Sidebar: Error fetching raw content", e);
    }

    // Fallback: Synchronous DOM Extraction
    return extractVisibleCodeSync();
}

function extractVisibleCodeSync() {
    console.log("Sidebar: Fallback to DOM extraction...");

    // Strategy 2: GitHub Blob Wrapper (Specific & Reliable)
    const containers = [
        '[data-component="file-content"]', // New GitHub
        '.blob-wrapper',    // Old GitHub
        '.react-code-blob',
        '.js-file-line-container'
    ];

    for (const selector of containers) {
        const el = document.querySelector(selector);
        if (el) {
            console.log("Sidebar: Found container", selector);
            return el.innerText.substring(0, 15000);
        }
    }

    // Strategy 3: GitHub Raw/TextArea (Fallback)
    const rawTextArea = document.querySelector('textarea[readOnly]');
    if (rawTextArea && rawTextArea.value.length > 50) {
        console.log("Sidebar: Found raw textarea code");
        return rawTextArea.value.substring(0, 15000);
    }

    // Strategy 4: StackOverflow / Generic
    const codes = document.querySelectorAll('pre code, .code-snippet, pre.prettyprint');
    let largest = "";
    codes.forEach(c => {
        if (c.innerText.length > largest.length) {
            largest = c.innerText;
        }
    });
    if (largest.length > 50) {
        console.log("Sidebar: Found generic code block");
        return largest.substring(0, 10000);
    }

    // Strategy 5: Fallback generic PRE
    const pre = document.querySelector('pre');
    if (pre && pre.innerText.length > 50) {
        console.log("Sidebar: Found generic PRE");
        return pre.innerText.substring(0, 10000);
    }

    console.log("Sidebar: No code found");
    return null;
}

// ... (existing code) ...

function sendToSidebar(msg) {
    if (sidebarIframe && sidebarIframe.contentWindow) {
        // Use postMessage for direct Parent -> Iframe communication
        // This is more reliable than runtime.sendMessage which goes through background
        const targetOrigin = chrome.runtime.getURL(""); // chrome-extension://...
        sidebarIframe.contentWindow.postMessage(msg, targetOrigin);

        // Redundant fallback (optional, but harmless)
        // chrome.runtime.sendMessage(msg); 
    }
}

function setupCodeInteractions() {
    // Basic delegation for clicking code blocks
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'PRE' || e.target.tagName === 'CODE' || e.target.closest('pre')) {
            // Check if we want to show a floater
            // For now, just log or auto-open
            // console.log("Code clicked");
        }
    });
}
