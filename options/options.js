// State
let savedUserData = {};

// Saves options to chrome.storage
// Saves options to chrome.storage
const saveOptions = () => {
    const enableSidebar = document.getElementById('enableSidebar').checked;
    const enableBlog = document.getElementById('enableBlog').checked;
    const enableMarketplace = document.getElementById('enableMarketplace').checked;
    const apiKey = document.getElementById('apiKey').value.trim();

    chrome.storage.sync.set(
        {
            settings: { enableSidebar, enableBlog, enableMarketplace, apiKey },
            userProfileData: savedUserData // Save persistent user data
        },
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
    chrome.storage.sync.get({
        settings: {}, // Settings object
        userProfileData: {}
    }, (items) => {
        // Restore Settings
        if (items.settings) {
            document.getElementById('enableSidebar').checked = items.settings.enableSidebar !== false;
            document.getElementById('enableBlog').checked = items.settings.enableBlog !== false;
            document.getElementById('enableMarketplace').checked = items.settings.enableMarketplace !== false;
            document.getElementById('apiKey').value = items.settings.apiKey || '';
        }

        // Restore User Data
        savedUserData = items.userProfileData || {};
        renderUserData();
    });
};

function renderUserData() {
    const list = document.getElementById('userDataList');
    if (!list) return;
    list.innerHTML = "";

    Object.keys(savedUserData).forEach(key => {
        const value = savedUserData[key];
        const li = document.createElement('li');
        li.className = 'data-item';

        // Basic styling for list items if class not present
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.padding = "5px";
        li.style.borderBottom = "1px solid #eee";

        const text = document.createElement('span');
        text.innerHTML = `<strong>${key}:</strong> ${value}`;

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '🗑️';
        delBtn.style.cursor = "pointer";
        delBtn.title = "Delete";
        delBtn.onclick = () => {
            // Deletion immediately saves
            delete savedUserData[key];
            renderUserData();
            saveOptions();
        };

        li.appendChild(text);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

// Live Listener for Background Changes (e.g. from Chat)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        if (changes.userProfileData) {
            savedUserData = changes.userProfileData.newValue || {};
            renderUserData();
        }
    }
});

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

// Add New Data Logic
document.getElementById('addDataBtn').addEventListener('click', () => {
    const keyInput = document.getElementById('newKey');
    const valInput = document.getElementById('newValue');
    const key = keyInput.value.trim();
    const val = valInput.value.trim();

    if (key && val) {
        savedUserData[key] = val;
        renderUserData();
        saveOptions(); // Auto-save on add
        keyInput.value = "";
        valInput.value = "";
    }
});
