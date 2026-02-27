// Quick debug script: test Khmer24 discover
const cheerio = require("cheerio");

async function main() {
  const urls = [
    "https://www.khmer24.com/en/apartment-for-rent.html",
    "https://www.khmer24.com/en/condo-for-rent.html",
  ];

  for (const url of urls) {
    console.log("\n=== Fetching:", url, "===");
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });
      console.log("Status:", res.status);
      console.log("Final URL:", res.url);
      console.log("Content-Type:", res.headers.get("content-type"));

      const html = await res.text();
      console.log("HTML length:", html.length);

      // Check if it redirected or returned something unexpected
      if (html.length < 500) {
        console.log("SHORT HTML:", html.substring(0, 500));
        continue;
      }

      const $ = cheerio.load(html);

      // Print the page title
      console.log("Page title:", $("title").text().trim());

      // Check all a[href] patterns
      const allLinks = [];
      $("a[href]").each((i, el) => {
        const href = $(el).attr("href");
        if (href) allLinks.push(href);
      });
      console.log("Total links on page:", allLinks.length);

      // Filter links that contain /en/ and end in .html
      const enLinks = allLinks.filter(h => h.includes("/en/") && h.endsWith(".html"));
      console.log("Links matching /en/*.html:", enLinks.length);
      enLinks.slice(0, 5).forEach(l => console.log("  ", l));

      // Check our specific pattern: /en/<slug>-<digits>.html
      const listingPattern = /\/en\/.+-\d+\.html/;
      const listingLinks = enLinks.filter(h => listingPattern.test(h));
      console.log("Links matching listing pattern:", listingLinks.length);
      listingLinks.slice(0, 5).forEach(l => console.log("  ", l));

      // Also check for other common listing link patterns
      const allHtmlLinks = allLinks.filter(h => h.endsWith(".html"));
      console.log("All .html links:", allHtmlLinks.length);

      // Check if maybe they use different URL structures now
      const sampleLinks = allLinks.filter(h => 
        h.includes("khmer24") || h.startsWith("/")
      ).slice(0, 20);
      console.log("\nSample internal links:");
      sampleLinks.forEach(l => console.log("  ", l));

      // Look for any listing-like elements
      console.log("\nListing containers check:");
      console.log("  .item-list:", $(".item-list").length);
      console.log("  .listing:", $(".listing").length);
      console.log("  .product:", $(".product").length);
      console.log("  [class*=listing]:", $("[class*=listing]").length);
      console.log("  [class*=item]:", $("[class*=item]").length);
      console.log("  [class*=card]:", $("[class*=card]").length);
      console.log("  [class*=ad]:", $("[class*=ad]").length);
      console.log("  [class*=post]:", $("[class*=post]").length);

      // Print first 2000 chars to see the page structure
      console.log("\n--- First 3000 chars of HTML ---");
      console.log(html.substring(0, 3000));

    } catch (e) {
      console.error("Error:", e.message);
    }
  }
}

main();
