// Utility to detect page type based on URL and content heuristics
// Returns: "blog" | "marketplace" | "dev" | "generic"

export function detectPageType(document) {
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

  // 2. Marketplace / Shopping
  if (
    hostname.includes("amazon") ||
    hostname.includes("ebay") ||
    hostname.includes("shopify") ||
    document.querySelector("meta[property='og:price:amount']") ||
    document.querySelector(".product-price") ||
    document.querySelector("#addToCart") ||
    document.querySelector(".add-to-cart")
  ) {
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
export function formatTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}
