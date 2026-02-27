// Quick debug: test realestate.com.kh
const cheerio = require("cheerio");

async function main() {
  const urls = [
    "https://www.realestate.com.kh/rent/condos/",
    "https://www.realestate.com.kh/rent/apartments/",
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

      if (html.length < 500) {
        console.log("SHORT HTML:", html.substring(0, 500));
        continue;
      }

      const $ = cheerio.load(html);
      console.log("Page title:", $("title").text().trim());

      // Check for listing links
      const allLinks = [];
      $("a[href]").each((i, el) => {
        const href = $(el).attr("href");
        if (href) allLinks.push(href);
      });
      console.log("Total links:", allLinks.length);

      // Links to /rent/ detail pages
      const rentLinks = allLinks.filter(h => h.includes("/rent/") && !h.endsWith("/rent/") && !h.endsWith("/condos/") && !h.endsWith("/apartments/"));
      console.log("Rent detail links:", rentLinks.length);
      rentLinks.slice(0, 10).forEach(l => console.log("  ", l));

      // All internal links sample
      const internalLinks = allLinks.filter(h => h.includes("realestate.com.kh") || h.startsWith("/"));
      console.log("\nSample internal links:", internalLinks.length);
      internalLinks.slice(0, 20).forEach(l => console.log("  ", l));

      // Look for listing containers
      console.log("\nListing containers:");
      console.log("  [class*=listing]:", $("[class*=listing]").length);
      console.log("  [class*=card]:", $("[class*=card]").length);
      console.log("  [class*=property]:", $("[class*=property]").length);
      console.log("  [class*=item]:", $("[class*=item]").length);
      console.log("  [class*=result]:", $("[class*=result]").length);
      console.log("  article:", $("article").length);

    } catch (e) {
      console.error("Error:", e.message);
    }
  }
}

main();
