# 🧭 Routing & State Management

In this Chrome Extension, "Routing" is not handled by a traditional URL router (like React Router or Vue Router). Instead, it uses a **Context-Aware State Machine**.

The "route" (current view) is determined by the **content of the web page** you are currently visiting, not by clicking links within the sidebar.

## High-Level Flow

1.  **Detection**: When a page loads, the Content Script runs heuristics to guess the `pageType`.
2.  **Signaling**: The Content Script activates the Sidebar and sends an `INIT_SIDEBAR` message with the detected type.
3.  **Rendering**: The Sidebar receives the type and swaps out its HTML content using `<template>` tags.

---

## 1. The "Router" (Page Detector)

**File:** `utils/page-detector.js`

This script acts as the router. It analyzes the URL and DOM to classify the page into one of four routes:

*   `"blog"`: Detected via `<article>` tags or `/blog/` URLs.
*   `"marketplace"`: Detected via shopping cart buttons or price meta tags.
*   `"dev"`: Detected via code blocks, Github/StackOverflow domains.
*   `"generic"`: The fallback route for all other pages.

## 2. The "Navigation" event (Message Passing)

**File:** `content/content.js`

Once the page type is determined, the content script triggers the "navigation" by sending a message to the Sidebar iframe:

```javascript
// content.js
sendToSidebar({
    action: "INIT_SIDEBAR",
    pageType: "marketplace", // <--- The 'Route'
    url: window.location.href
});
```

## 3. The "View" Renderer (Sidebar)

**File:** `sidebar/sidebar.js` & `sidebar/sidebar.html`

The Sidebar doesn't reload. It listens for the `INIT_SIDEBAR` message and dynamically renders the matching template.

**HTML Templates:**
The `sidebar.html` file contains hidden templates for each route:
*   `<template id="template-blog">`
*   `<template id="template-marketplace">`
*   `<template id="template-dev">`
*   `<template id="template-generic">`

**JavaScript Logic:**
```javascript
// sidebar.js
function updateUI() {
    // 1. Clear current view
    const main = document.getElementById('main-content');
    main.innerHTML = ""; 

    // 2. Select template based on route
    let templateId = `template-${currentPageType}`;
    
    // 3. Clone and inject
    const template = document.getElementById(templateId);
    if (template) {
        main.appendChild(template.content.cloneNode(true));
        attachDynamicListeners(main); // Re-attach event listeners to new DOM
    }
}
```

## Internal Navigation (Tabs)

Within the `generic` route, there is a sub-router using simple CSS tabs:
*   **Chat**
*   **Reminders**
*   **Research**

This is handled by the `showTab(tabName)` function in `sidebar.js`, which simply toggles `.active` classes on standard HTML elements.

## See Also
*   [System Architecture](./ARCHITECTURE.md)
*   [Development Guide](./DEVELOPMENT.md)
