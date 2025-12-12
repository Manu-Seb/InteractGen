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

  // 2. Online Courses (Prioritized over Marketplace/Blog)
  const isCoursePlatform =
    hostname.includes("coursera") ||
    hostname.includes("udemy") ||
    hostname.includes("edx") ||
    hostname.includes("udacity");

  const isCourseUrl =
    url.includes("/learn/") ||
    url.includes("/course/") ||
    url.includes("/nanodegree/");

  const contentHeuristics =
    (document.querySelector("h1") && (
      document.body.innerText.includes("What you'll learn") ||
      document.body.innerText.includes("syllabus") ||
      document.body.innerText.includes("Instructor")
    )) &&
    (document.querySelector(".enroll-btn") ||
      document.body.innerText.toLowerCase().includes("enroll"));

  const isCatalog =
    document.body.innerText.includes("Filter by") ||
    document.querySelectorAll(".course-card, .card").length > 5;

  if (isCoursePlatform) {
    // If it's a known platform, we want strict control.
    // Detail page -> online-course
    // Catalog/Other -> generic (Don't let it fall through to Marketplace/Blog)

    // Note: Some course sites might have blogs (e.g. blog.coursera.org). 
    // If we want to allow that to be "blog", we should check URL.
    if (url.includes("/blog/") || url.includes("/news/") || hostname.includes("blog.")) {
      // Let it fall through to Blog check or generic
    } else if (isCourseUrl || (!isCatalog && contentHeuristics)) {
      return "online-course";
    } else {
      // It's a course platform but likely a catalog or dashboard
      return "generic";
    }
  } else {
    // Unknown platform, use heuristics but be careful not to override valid blogs/marketplaces unless very sure
    if (!isCatalog && contentHeuristics) {
      return "online-course";
    }
  }

  // 3. Marketplace / Shopping
  // Heuristics: Product detail page ONLY (exclude catalogs/home pages)
  const isMarketplaceHost =
    hostname.includes("amazon") ||
    hostname.includes("ebay") ||
    hostname.includes("shopify") ||
    hostname.includes("etsy");

  // Strong signals of a product page
  const hasBuyButton =
    document.querySelector("#addToCart") ||
    document.querySelector("#add-to-cart-button") ||
    document.querySelector(".add-to-cart") ||
    document.querySelector("button[name='add-to-cart']");

  const hasPrice =
    document.querySelector("meta[property='og:price:amount']") ||
    document.querySelector(".product-price") ||
    document.querySelector(".a-price") || // Amazon specific
    document.querySelector(".price");     // Generic

  // URL patterns for common sites
  const isProductUrl =
    (hostname.includes("amazon") && url.includes("/dp/")) ||
    (hostname.includes("ebay") && url.includes("/itm/"));

  // Negative signals (Catalog/List/Home)
  // Check if we see many product items, which implies a list
  const isProductList =
    document.querySelectorAll(".product-card, .s-result-item, .sh-dgr__grid-result, .s-item").length > 3;

  if (
    (isMarketplaceHost || hasPrice) &&
    (hasBuyButton || isProductUrl) &&
    !isProductList
  ) {
    return "marketplace";
  }

  // 4. Blog / News
  // Heuristics: <article> tag, common news patterns in URL like /2023/12/, high text-to-code ratio
  if (
    document.querySelector("article") ||
    url.includes("/blog/") ||
    url.includes("/news/") ||
    (document.querySelector("h1") && document.querySelectorAll("p").length > 10) // Basic "lots of text" check
  ) {
    return "blog";
  }

  // 5. Fallback
  return "generic";
}

// Format a timestamp for display
function formatTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}
