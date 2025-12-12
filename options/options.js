// State
let savedUserData = {};

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

            function restoreOptions() {
                chrome.storage.sync.get({
                    geminiApiKey: '',
                    userProfileData: {}
                }, (items) => {
                    document.getElementById('apiKey').value = items.geminiApiKey;
                    savedUserData = items.userProfileData || {};
                    renderUserData();
                });
            }

            function renderUserData() {
                const list = document.getElementById('userDataList');
                list.innerHTML = "";

                Object.keys(savedUserData).forEach(key => {
                    const value = savedUserData[key];
                    const li = document.createElement('li');
                    li.className = 'data-item';

                    const text = document.createElement('span');
                    text.innerHTML = `<strong>${key}:</strong> ${value}`;

                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.innerHTML = '&times;';
                    delBtn.title = "Delete";
                    delBtn.onclick = () => {
                        delete savedUserData[key];
                        renderUserData();
                    };

                    li.appendChild(text);
                    li.appendChild(delBtn);
                    list.appendChild(li);
                });
            }

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
                    keyInput.value = "";
                    valInput.value = "";
                }
            });
        });
