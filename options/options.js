// Saves options to chrome.storage
const saveOptions = () => {
    const enableSidebar = document.getElementById('enableSidebar').checked;
    const enableBlog = document.getElementById('enableBlog').checked;
    const enableMarketplace = document.getElementById('enableMarketplace').checked;

    chrome.storage.sync.set(
        { settings: { enableSidebar, enableBlog, enableMarketplace } },
        () => {
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 750);
        }
    );
};

// Restores select box and checkbox state using the preferences stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get('settings', (items) => {
        const s = items.settings || {};
        document.getElementById('enableSidebar').checked = s.enableSidebar !== false;
        document.getElementById('enableBlog').checked = s.enableBlog !== false;
        document.getElementById('enableMarketplace').checked = s.enableMarketplace !== false;
    });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
