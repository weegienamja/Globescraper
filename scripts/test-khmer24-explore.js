/**
 * Explore Khmer24 site structure to find current rental listing URLs
 */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Try the homepage first
  console.log("=== Trying Khmer24 homepage ===");
  await page.goto("https://www.khmer24.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log(`URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);

  // Find links containing "rent" or "apartment" or "condo"
  const rentalLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().substring(0, 80) }))
      .filter((l) => l.href && /(rent|apartment|condo|house.*land)/i.test(l.href + " " + l.text))
      .slice(0, 20)
  );
  console.log("\nRental-related links on homepage:");
  rentalLinks.forEach((l) => console.log(`  ${l.text} → ${l.href}`));

  // Try searching for apartments for rent on the site
  const searchUrls = [
    "https://www.khmer24.com/en/property-for-rent.html",
    "https://www.khmer24.com/property-for-rent",
    "https://www.khmer24.com/en/house-land/apartments-for-rent",
    "https://www.khmer24.com/house-land/apartment-for-rent.html",
    "https://www.khmer24.com/en/house-land",
  ];

  for (const url of searchUrls) {
    console.log(`\n=== Trying ${url} ===`);
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);
      const status = resp?.status() || "?";
      const title = await page.title();
      const finalUrl = page.url();
      console.log(`  Status: ${status}, Final URL: ${finalUrl}`);
      console.log(`  Title: ${title}`);
      
      // Count links that look like listings
      const listingLinks = await page.$$eval("a", (els) =>
        els
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && /\d{5,}/.test(h) && !/category|page|search/.test(h))
      );
      console.log(`  Listing-like links: ${listingLinks.length}`);
      if (listingLinks.length > 0) {
        console.log(`  First 3:`, listingLinks.slice(0, 3));
      }
    } catch (e) {
      console.log(`  Error: ${e.message.substring(0, 100)}`);
    }
  }

  // Also look at all nav/category links from the homepage
  console.log("\n=== All category links on homepage ===");
  await page.goto("https://www.khmer24.com", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(2000);
  
  const allLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().substring(0, 60) }))
      .filter((l) => l.href && /(house|land|property|home|real.?estate)/i.test(l.href + " " + l.text))
      .slice(0, 20)
  );
  console.log("House/Property links:");
  allLinks.forEach((l) => console.log(`  ${l.text} → ${l.href}`));

  await browser.close();
}

main().catch(console.error);
