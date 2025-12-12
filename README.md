# Context-Aware AI Sidebar Extension

A Chrome Extension (Manifest V3) that injects a smart, Loom-style sidebar into web pages to assist with context-specific tasks.

## 📖 Documentation

Everything you need to know about using and building this extension is in the `docs/` folder:

*   [**System Architecture**](./docs/ARCHITECTURE.md): High-level overview of how the Content Script, Sidebar, and Background worker interact.
*   [**Routing & State**](./docs/ROUTING.md): Explanation of the heuristic-based "routing" system that detects generic vs. blog vs. dev pages.
*   [**Development Guide**](./docs/DEVELOPMENT.md): Instructions for installing, simpler debugging, and adding new features.

## 🚀 Quick Start

1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode**.
3.  Click **Load unpacked** and select this folder.
4.  Visit any website (e.g., a GitHub repo or a news article) and look for the floating 🤖 button.
