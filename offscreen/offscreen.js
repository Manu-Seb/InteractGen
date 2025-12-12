// Offscreen document script
// Handles scraping tasks in a hidden environment

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse) {
    if (message.action === "SCRAPE_URL") {
        scrapeUrl(message.url)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // async
    }
}

async function scrapeUrl(url) {
    console.log("Offscreen: Scraping URL", url);

    // Idea: Load in iframe to execute JS, or fetch text for static scraping
    // For many sites, fetch() is blocked by CORS unless you have host permissions.
    // Since we have host_permissions: <all_urls>, fetch should work for GET requests.

    try {
        const response = await fetch(url);
        const text = await response.text();

        // Simple regex parsing for demonstration (cheaper/faster than DOMParser for basic metadata)
        // In a real app, use DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");

        const title = doc.querySelector("title")?.innerText || "";
        const price = extractPrice(doc) || "N/A";

        return { url, title, price };
    } catch (e) {
        console.error("Offscreen Scrape Error:", e);
        throw e;
    }
}

function extractPrice(doc) {
    // Strategy 1: Metadata (most reliable)
    const metaPrice = doc.querySelector('meta[property="product:price:amount"]')?.content ||
        doc.querySelector('meta[property="og:price:amount"]')?.content;
    const metaCurrency = doc.querySelector('meta[property="product:price:currency"]')?.content ||
        doc.querySelector('meta[property="og:price:currency"]')?.content || "$";

    if (metaPrice) return `${metaCurrency}${metaPrice}`;

    // Strategy 2: Specific Selectors (Major Retailers)
    const priceSelectors = [
        // Amazon
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        // Walmart
        '[itemprop="price"]',
        '[data-automation-id="product-price"]',
        // eBay
        '.x-price-primary',
        '.prcIsum',
        // Best Buy
        '.priceView-hero-price span[aria-hidden="true"]',
        // Target
        '[data-test="product-price"]',
        // Generic / Schema.org
        '.price',
        '.product-price',
        '.offer-price',
        '[class*="price"]'
    ];

    for (const sel of priceSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
            const text = el.innerText.trim();
            // Basic validation: must contain a number and preferably a currency symbol
            if (/\d/.test(text) && (text.includes('$') || text.includes('€') || text.includes('£'))) {
                return text;
            }
        }
    }

    // Strategy 3: Regex Fallback (The "Fine Tuning")
    // Look for price patterns near "price" keyword or at top of body
    try {
        const text = doc.body.innerText.substring(0, 5000); // Check first 5k chars
        // Match $XX.XX or $XX,XXX
        const priceRegex = /(\$\d{1,3}(,\d{3})*(\.\d{2})?)/g;
        const matches = text.match(priceRegex);
        if (matches && matches.length > 0) {
            // Return the first valid looking match, or the largest one if multiple (often safest for logic, effectively 'current price')
            // Actually, usually the first one near the top is the main price.
            return matches[0];
        }
    } catch (e) {
        // ignore regex errors
    }

    return null;
}
