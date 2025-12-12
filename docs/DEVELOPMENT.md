# 🛠️ Development & Contribution Guide

## Prerequisites
*   Google Chrome (or Chromium-based browser)
*   Basic knowledge of HTML/CSS/JS

## Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Manu-Seb/InteractGen.git
    cd InteractGen
    ```
2.  **Load in Chrome**:
    *   Go to `chrome://extensions/`
    *   Enable **Developer mode** (top right toggle).
    *   Click **Load unpacked**.
    *   Select the root folder of this repository.

## Project Structure

```text
/
├── manifest.json       # Entry point
├── background/         # Service worker
├── content/            # Injected scripts
├── sidebar/            # UI logic
└── docs/               # Documentation
```

## Common Tasks

### Adding a New Page Type
1.  **Detection**: Update `utils/page-detector.js` with new heuristics (e.g., regex for URL).
2.  **Template**: Add a new `<template id="template-NEWTYPE">` in `sidebar/sidebar.html`.
3.  **Logic**: Update `sidebar.js` to handle any specific buttons/actions for this new type.

### Connecting to Real AI
Currently, the extension uses stubs. To connect an LLM:
1.  Open `background/service-worker.js`.
2.  Find the `handleAIRequest` function.
3.  Replace the `switch` statement with a `fetch()` call to your API (OpenAI, Anthropic, etc.).

**Security Note**: Never commit API keys to client-side code! Use `chrome.storage` to allow users to input their own keys via the Options page.

## Debugging

*   **Popup/Sidebar**: Right-click the sidebar (or popup) -> "Inspect" to open DevTools for the UI.
*   **Content Script**: Open DevTools on the specific web page (F12) -> Console.
*   **Background**: Go to `chrome://extensions/` -> Click "service worker" link to open its DevTools.

## See Also
*   [System Architecture](./ARCHITECTURE.md)
*   [Routing Logic](./ROUTING.md)
