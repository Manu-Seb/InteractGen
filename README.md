# Context-Aware AI Sidebar Extension

A Chrome Extension (Manifest V3) that injects a smart, Loom-style sidebar into web pages to assist with context-specific tasks.

## 📂 Project Structure

```
/Extension
├── manifest.json            # Extension configuration & permissions
├── background/
│   └── service-worker.js    # Background logic, API stubs, storage & alarms
├── content/
│   ├── content.js           # Injects Shadow DOM & Iframe, detects page type
│   └── content.css          # Page-level styles (e.g. highlights)
├── sidebar/
│   ├── sidebar.html         # Sidebar UI structure
│   ├── sidebar.css          # Sidebar styling & animations
│   └── sidebar.js           # Sidebar logic & UI updates
├── popup/                   # Browser toolbar popup
│   ├── popup.html
│   └── popup.js
├── options/                 # Extension settings page
│   ├── options.html
│   └── options.js
├── utils/
│   └── page-detector.js     # Heuristic logic to identify Blog/Dev/Shop pages
└── assets/                  # Icons (placeholders)
```

## 🚀 How to Install

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `/Extension` folder (the root of this project).
5. The extension should appear in your toolbar.

## 🧪 How to Use

1. **Navigation**: Go to different types of websites:
   - **Dev**: A generic GitHub or Stack Overflow page (or any page with `<pre><code>` blocks).
   - **News/Blog**: Any article page.
   - **Shopping**: Amazon product page (or generic e-commerce).
   - **Generic**: Any other page (e.g., google.com).
2. **Trigger**: You will see a generic floating "🤖" button in the bottom right corner (if the page type is detected successfully). Click it to open the sidebar.
3. **Context**:
   - The sidebar header shows the detected page type.
   - Different "cards" will appear based on the type (e.g., "Summarize" for blogs, "Compare" for shopping).
4. **Interaction**: Click buttons like "Summarize" or "Explain Code". Since there is no real backend, it will simulate a delay and show placeholder results.

## 🛠️ Developer Implementation Guide

To turn this into a real product:

1. **AI Integration**:
   - Open `background/service-worker.js`.
   - Locate `handleAIRequest()`.
   - Replace the static string returns with actual calls to OpenAI/Anthropic APIs or a local LLM.

2. **Better Detection**:
   - Improve `utils/page-detector.js` with more robust DOM analysis or use metadata tags (OpenGraph, Schema.org).

3. **Styling**:
   - Edit `sidebar/sidebar.css` to match your brand.
   - The sidebar runs inside an iframe, so its styles are isolated from the host page.

4. **Security**:
   - If adding external API calls, ensure you handle API keys securely (e.g., allow user to input key in Options, do not hardcode in `service-worker.js`).
