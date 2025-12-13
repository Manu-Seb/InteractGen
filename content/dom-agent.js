/**
 * DOMAgent Module
 * Handles autonomous DOM traversal and manipulation for the AI agent.
 */

export class DOMAgent {
    constructor() {
        this.maxAttempts = 10;
        this.actionHistory = [];
    }

    /**
     * Scans the page for interactive elements.
     * @returns {Array} List of interactive element objects
     */
    extractInteractiveElements() {
        const interactiveSelectors = [
            'input', 'textarea', 'select', 'button', 'a[href]', '[role="button"]'
        ];

        const elements = document.querySelectorAll(interactiveSelectors.join(','));
        const extracted = [];
        let idCounter = 0;

        elements.forEach(el => {
            // Skip invisible elements
            if (!this.isVisible(el)) return;

            // Generate a unique ID (internal to this session)
            const elementId = idCounter++;
            el.dataset.agentId = elementId; // Tag it for easy retrieval

            extracted.push({
                id: elementId,
                tag: el.tagName.toLowerCase(),
                type: el.type || el.getAttribute('role') || 'unknown',
                name: el.name || '',
                label: this.findLabel(el),
                placeholder: el.placeholder || '',
                value: (el.value || el.textContent || '').substring(0, 50),
                classes: Array.from(el.classList).join('.'),
                required: el.required || false,
                selector: this.generateUniqueSelector(el)
            });
        });

        return extracted;
    }

    /**
     * Checks if an element is visible to the user.
     * @param {HTMLElement} el 
     */
    isVisible(el) {
        if (!el.offsetParent && el.tagName !== 'BODY') return false; // Basic check
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

        // Check if strictly within viewport? Maybe not strictly, just "visible on page"
        // For now, computed style is enough.
        return true;
    }

    /**
     * Finds the label for an input element using multiple strategies.
     * @param {HTMLElement} el 
     */
    findLabel(el) {
        // 1. "id" -> label[for="id"]
        if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.innerText.trim();
        }

        // 2. Parent label (wrapping)
        const parentLabel = el.closest('label');
        if (parentLabel) {
            // Clone and remove the input itself to get just the text
            const clone = parentLabel.cloneNode(true);
            const inputInClone = clone.querySelector(el.tagName);
            if (inputInClone) inputInClone.remove();
            return clone.innerText.trim();
        }

        // 3. aria-label
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

        // 4. Previous sibling (heuristics)
        let sibling = el.previousElementSibling;
        while (sibling && !['LABEL', 'SPAN', 'DIV'].includes(sibling.tagName)) {
            sibling = sibling.previousElementSibling;
        }
        if (sibling && sibling.innerText.length < 50) return sibling.innerText.trim();

        // 5. Button text / Link text
        if (['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button') {
            return el.innerText.trim() || el.title || '';
        }

        return '';
    }

    /**
     * Generates a unique CSS selector for an element.
     * @param {HTMLElement} el 
     */
    generateUniqueSelector(el) {
        // Priority 1: ID
        if (el.id) return `#${el.id}`;

        // Priority 2: Unique attributes (name, placeholder, etc.)
        if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;

        // Priority 3: Tag + Classes
        let selector = el.tagName.toLowerCase();
        if (el.classList.length > 0) {
            selector += '.' + Array.from(el.classList).join('.');
        }

        // Check uniqueness
        if (document.querySelectorAll(selector).length === 1) return selector;

        // Priority 4: Path with nth-of-type
        // Simple implementation: climb up parent
        let parent = el.parentElement;
        if (parent) {
            const children = Array.from(parent.children).filter(child => child.tagName === el.tagName);
            const index = children.indexOf(el) + 1;
            selector += `:nth-of-type(${index})`;

            // Should verify parent uniqueness... but keeping it max 3 levels deep as requested might be complex
            // Let's settle for a semi-robust selector for now.
        }

        return selector;
    }

    /**
     * Executes a single action on the page.
     * @param {Object} action {action, elementId, selector, value}
     */
    async executeAction(action) {
        console.log("DOMAgent: Executing action", action);
        let el = null;

        // Try finding by internal ID first (fastest)
        if (action.elementId !== undefined) {
            el = document.querySelector(`[data-agent-id="${action.elementId}"]`);
        }

        // Fallback to selector
        if (!el && action.selector) {
            el = document.querySelector(action.selector);
        }

        if (!el) {
            return { success: false, error: "Element not found" };
        }

        try {
            switch (action.action) {
                case 'type':
                    el.focus();
                    el.value = action.value;
                    // Trigger events for React/Vue
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.blur();
                    break;

                case 'click':
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500); // Wait for scroll
                    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                    el.click();
                    break;

                case 'select':
                    el.focus();
                    // Try setting by value
                    let option = Array.from(el.options).find(o => o.value === action.value || o.text === action.value);
                    if (option) {
                        el.value = option.value;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        return { success: false, error: "Option not found" };
                    }
                    break;

                case 'wait':
                    await this.wait(parseInt(action.value) || 1000);
                    break;

                default:
                    return { success: false, error: "Unknown action type" };
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Main task orchestration loop.
     * @param {String} userGoal 
     * @param {Object} userData 
     */
    async performTask(userGoal, userData) {
        console.log("DOMAgent: Starting task", userGoal);
        this.actionHistory = [];

        // 0. Fetch Persistent User Data
        const persistentData = await this.getPersistentUserData();
        const combinedData = { ...persistentData, ...userData };
        console.log("DOMAgent: Using merged user data", combinedData);

        for (let i = 0; i < this.maxAttempts; i++) {
            // 1. Extract State
            const elements = this.extractInteractiveElements();
            console.log(`DOMAgent: Found ${elements.length} interactive elements.`);

            if (elements.length === 0) {
                return { success: false, error: "No interactive elements found on page. (Is it a canvas or strict iframe?)" };
            }

            // 2. Build Prompt
            const prompt = this.buildPrompt(userGoal, combinedData, elements);

            // 3. Call AI
            console.log("DOMAgent: Asking AI...");
            const response = await this.callGemini(prompt);

            if (!response) {
                console.error("DOMAgent: No response from AI");
                return { success: false, error: "AI failed to generate a plan." };
            }

            if (!response.actions || response.actions.length === 0) {
                if (response.complete) {
                    console.log("DOMAgent: AI says task is complete.");
                    return { success: true, history: this.actionHistory };
                }
                console.warn("DOMAgent: AI returned no actions but not complete.");
                // It might be stuck or needs more data.
                // If we have history, maybe we are done?
                if (this.actionHistory.length > 0) return { success: true, history: this.actionHistory };

                return { success: false, error: "AI could not determine any actions. (Check if you have saved the necessary data in Settings)" };
            }

            // check completion
            if (response.complete) {
                console.log("DOMAgent: Task complete!");
                return { success: true, history: this.actionHistory };
            }

            // 4. Execute Actions
            for (const action of response.actions) {
                const result = await this.executeAction(action);
                this.actionHistory.push({ ...action, result });

                if (!result.success) {
                    console.warn("DOMAgent: Action failed", action, result.error);
                }

                await this.wait(500); // Pace actions
            }

            // 5. Wait for page updates
            await this.wait(1000);
        }

        return { success: false, error: "Max attempts reached without completion." };
    }

    async getPersistentUserData() {
        return new Promise(resolve => {
            chrome.storage.sync.get("userProfileData", (items) => {
                resolve(items.userProfileData || {});
            });
        });
    }

    buildPrompt(userGoal, userData, elements) {
        // Serialize elements to a concise string format
        const elementsList = elements.map(e =>
            `[${e.id}] ${e.tag} - Label: "${e.label}" Placeholder: "${e.placeholder}" Value: "${e.value}" Type: ${e.type} ${e.required ? '(required)' : ''}`
        ).join('\n');

        const historyStr = JSON.stringify(this.actionHistory);
        const userDataStr = JSON.stringify(userData, null, 2);

        return `
You are controlling a web browser. Task: "${userGoal}"

Page: ${document.title} - ${window.location.href}

User data available: 
${userDataStr}

Interactive elements:
${elementsList}

Previous actions: ${historyStr}

CRITICAL RULES:
1. ONLY use the information provided in "User data available" to fill forms.
2. If a required field asks for information NOT present in "User data available" (e.g. Phone Number), DO NOT fill it. DO NOT invent fake data. Skip it or stop.
3. Use the most specific keys from User Data (e.g. use "Work Email" for business forms if available).

Return ONLY valid JSON (no markdown):
{
  "actions": [
    {"action": "type", "elementId": 0, "value": "John Doe"},
    {"action": "click", "elementId": 2}
  ],
  "reasoning": "Using Name from user data.",
  "complete": false
}
`;
    }

    async callGemini(prompt) {
        return new Promise((resolve) => {
            console.log("DOMAgent: Sending prompt to background...", prompt.substring(0, 100) + "...");
            chrome.runtime.sendMessage({
                action: "REQUEST_AGENT_PLAN",
                prompt: prompt
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("DOMAgent: Runtime Error:", chrome.runtime.lastError);
                    resolve(null);
                    return;
                }

                console.log("DOMAgent: Raw Background Response:", response);

                // Expecting response.data to be the JSON string 
                // In service-worker.js: sendResponse({ data: reply }) where reply is text
                if (response && response.data) {
                    // Extract text if it's an object with reply property (just in case)
                    let jsonStr = typeof response.data === 'string' ? response.data : response.data.reply || JSON.stringify(response.data);

                    try {
                        // Cleanup if MD is returned
                        if (jsonStr.includes('```json')) {
                            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
                        }

                        const parsed = JSON.parse(jsonStr);
                        console.log("DOMAgent: Parsed Plan:", parsed);
                        resolve(parsed);
                    } catch (e) {
                        console.error("DOMAgent: Failed to parse JSON plan", e, jsonStr);
                        resolve(null);
                    }
                } else {
                    console.error("DOMAgent: Empty data in response");
                    resolve(null);
                }
            });
        });
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
