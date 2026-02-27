/**
 * Quick test: can Playwright bypass Cloudflare on Khmer24?
 */
const { chromium } = require("playwright");

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("Navigating to Khmer24 condo-for-rent...");
  await page.goto("https://www.khmer24.com/en/condo-for-rent.html", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // Wait a few seconds for any CF challenge to resolve
  await page.waitForTimeout(5000);

  const title = await page.title();
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));

  console.log(`\nFinal URL: ${url}`);
  console.log(`Title: ${title}`);
  console.log(`Body preview:\n${bodyText.substring(0, 400)}`);

  // Count listing links
  const links = await page.$$eval('a[href*="/en/"]', (els) =>
    els
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && /\/en\/.+-\d{4,}\.html/.test(h))
  );
  console.log(`\nListing links found: ${links.length}`);
  if (links.length > 0) {
    console.log("First 5:", links.slice(0, 5));
  }

  await browser.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
