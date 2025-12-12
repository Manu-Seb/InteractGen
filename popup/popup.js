document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById('toggle-sidebar').addEventListener('click', () => {
    // Query active tab and send message
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_SIDEBAR" });
            window.close();
        }
    });
});
