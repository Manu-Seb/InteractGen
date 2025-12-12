// Utility to detect page type based on URL and content heuristics
// Returns: "blog" | "marketplace" | "dev" | "generic"

function detectPageType(document) {
  const url = window.location.href;
  const hostname = window.location.hostname;
  const bodyText = document.body.innerText.toLowerCase();

  // 1. Dev / Code sites
  if (
    hostname.includes("github.com") ||
    hostname.includes("stackoverflow.com") ||
    hostname.includes("gitlab.com") ||
    document.querySelector("pre code") || // Generic code block detection
    document.querySelector(".blob-code")  // GitHub specific class
  ) {
    return "dev";
  }

  // 2. Marketplace / Shopping (Product Pages Only)
  // We want to distinguish actual product pages from homepages or search results.
  // Homepages of Amazon/eBay etc. should fall back to "generic".

  const hasProductSignals = (
    document.querySelector("meta[property='og:price:amount']") ||
    document.querySelector("meta[property='product:price:amount']") ||
    document.querySelector("#addToCart") ||
    document.querySelector(".add-to-cart") ||
    document.querySelector("[id*='addToCart']") ||
    document.querySelector("[class*='product-price']")
  );

  const isMajorSiteProductUrl = (
    (hostname.includes("amazon") && url.includes("/dp/")) ||
    (hostname.includes("ebay") && url.includes("/itm/")) ||
    (hostname.includes("etsy") && url.includes("/listing/"))
  );

  if (hasProductSignals || isMajorSiteProductUrl) {
    return "marketplace";
  }

  // 3. Blog / News
  // Heuristics: <article> tag, common news patterns in URL like /2023/12/, high text-to-code ratio
  if (
    document.querySelector("article") ||
    url.includes("/blog/") ||
    url.includes("/news/") ||
    (document.querySelector("h1") && document.querySelectorAll("p").length > 10) // Basic "lots of text" check
  ) {
    return "blog";
  }

  // 4. Fallback
  return "generic";
}

// Format a timestamp for display
function formatTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}
