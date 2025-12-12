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
            toggleSidebar(!sidebarOpen);
        }
        if (msg.action === "ANALYZE_REQUEST") {
            // Example: User clicked "Analyze with AI" in context menu
            toggleSidebar(true);
            // Forward to sidebar
            setTimeout(() => sendToSidebar({ action: "UPDATE_SIDEBAR_CONTENT", data: "Analyzing selection..." }), 500);
        }
    });

    // 5. Code Block listeners (for Dev mode)
    if (detectedPageType === "dev") {
        setupCodeInteractions();
    }
})();

function injectSidebar() {
    // Create Shadow Host
    shadowHost = document.createElement('div');
    shadowHost.id = "ai-sidebar-host";
    shadowHost.style.position = "fixed";
    shadowHost.style.zIndex = "2147483647"; // Max z-index
    shadowHost.style.top = "0";
    shadowHost.style.right = "0";
    shadowHost.style.height = "0"; // Initially 0 height to not block clicks
    shadowHost.style.width = "0";
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
    toggleBtn.addEventListener('click', () => toggleSidebar(!sidebarOpen));
    shadowRoot.appendChild(toggleBtn);
}

function toggleSidebar(open) {
    sidebarOpen = open;
    if (open) {
        sidebarIframe.classList.add('open');
        shadowHost.style.width = "100vw"; // Expand host to allow clicking sidebar
        shadowHost.style.height = "100vh";
        shadowHost.style.pointerEvents = "none"; // Let clicks pass through empty areas?
        // Actually, we need pointer events on the iframe and button, but not the rest of the screen unless we have a backdrop.
        // Shadow DOM style isolation makes this tricky. 
        // Better: Set host size to full only so children can be positioned relative to viewport properly.
        // We handle pointer-events on children in CSS? 
        // No, if host is 0x0, children outside it are visible but might have interaction issues depending on browser.
        // Safest: Host always 0x0 size, but allow overflow.
        shadowHost.style.width = "0";
        shadowHost.style.height = "0";

        // Initialize sidebar state
        sendToSidebar({
            action: "INIT_SIDEBAR",
            pageType: detectedPageType,
            url: window.location.href
        });

    } else {
        sidebarIframe.classList.remove('open');
    }
}

function sendToSidebar(msg) {
    if (sidebarIframe && sidebarIframe.contentWindow) {
        // chrome.runtime messaging is usually better for iframe part of extension 
        // but postMessage also works. Since sidebar is an extension page, we can use runtime.
        // However, we can't easily target a specific iframe with runtime.sendMessage unless we identify it.
        // Sending directly via runtime to the extension logic in the iframe is cleanest.
        // BUT: Content scripts can't send message TO other extension views directly easily without background relay.
        // Use postMessage to iframe window
        // sidebarIframe.contentWindow.postMessage(msg, chrome.runtime.getURL("")); 
        // The iframe is on chrome-extension://origin.
        // Let's use runtime messaging from Background -> Sidebar, but for Content -> Sidebar, 
        // it's often easier to route through background OR use window.postMessage if we know the origin.

        // Let's try runtime.sendMessage to background, which then forwards to sidebar? 
        // No, simpler: Content -> Iframe via postMessage is standard for parent->child.
        // BUT sidebar is cross-origin to the page (extension origin).
        // So we must use targetOrigin = chrome.runtime.getURL("")

        // Actually, the Sidebar listens to chrome.runtime.onMessage. 
        // Does sending from content script trigger that in extension pages? Yes.
        chrome.runtime.sendMessage(msg);
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
