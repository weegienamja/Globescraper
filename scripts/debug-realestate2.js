// Deep inspect realestate.com.kh listing structure
const cheerio = require("cheerio");

async function main() {
  const res = await fetch("https://www.realestate.com.kh/rent/condo/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Check article elements - these are the listing cards
  console.log("=== article elements ===");
  $("article").each((i, el) => {
    const $el = $(el);
    const classes = $el.attr("class") || "";
    const links = [];
    $el.find("a[href]").each((j, a) => {
      links.push($(a).attr("href"));
    });
    console.log(`\narticle[${i}] class="${classes}"`);
    console.log("  links:", links.slice(0, 3));
    console.log("  text preview:", $el.text().trim().substring(0, 150));
  });

  // Check [class*=listing] elements
  console.log("\n\n=== [class*=listing] elements ===");
  $("[class*=listing]").each((i, el) => {
    const $el = $(el);
    const tag = el.tagName;
    const classes = $el.attr("class") || "";
    const link = $el.find("a[href]").first().attr("href") || $el.attr("href") || "";
    console.log(`${tag} class="${classes}" firstLink="${link}"`);
  });

  // Check all links that look like property detail pages
  console.log("\n\n=== Links with property-like patterns ===");
  const propertyLinks = new Set();
  $("a[href]").each((i, el) => {
    const href = $(el).attr("href") || "";
    // Property detail links often have numeric IDs or slug patterns
    if (href.match(/\/(rent|buy)\/[^/]+-\d+/) || 
        href.match(/\/listing\//) ||
        href.match(/\/property\//) ||
        href.match(/\d{4,}/) && href.includes("/rent/")) {
      propertyLinks.add(href);
    }
  });
  console.log("Property detail links:", propertyLinks.size);
  Array.from(propertyLinks).slice(0, 20).forEach(l => console.log("  ", l));

  // Also check for data attributes that might contain listing IDs
  console.log("\n\n=== Elements with data-listing or data-id ===");
  $("[data-listing-id], [data-id], [data-property-id]").each((i, el) => {
    const $el = $(el);
    console.log(`${el.tagName} data-listing-id="${$el.attr("data-listing-id") || ""}" data-id="${$el.attr("data-id") || ""}" data-property-id="${$el.attr("data-property-id") || ""}"`);
  });

  // What about CSS-based URL links
  console.log("\n\n=== All unique internal link paths (containing /rent/) ===");
  const rentPaths = new Set();
  $("a[href]").each((i, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("/rent/") && !href.startsWith("http")) {
      rentPaths.add(href);
    }
  });
  Array.from(rentPaths).sort().forEach(l => console.log("  ", l));
}

main().catch(console.error);
