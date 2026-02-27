/**
 * Deep explore Khmer24 rental category page structure
 */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // ── Category page ──
  console.log("=== Category: /en/c-property-housing-rentals ===");
  await page.goto("https://www.khmer24.com/en/c-property-housing-rentals", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  console.log(`URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);

  // Check for subcategory/filter links
  const subLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().substring(0, 80) }))
      .filter((l) =>
        l.href &&
        /(apartment|condo|flat|room|studio|house|villa)/i.test(l.text) &&
        l.text.length > 2
      )
      .slice(0, 30)
  );
  console.log("\nApartment/Condo subcategory links:");
  subLinks.forEach((l) => console.log(`  ${l.text} → ${l.href}`));

  // Get all listing-like links (adid pattern)
  const listingLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim().substring(0, 100) }))
      .filter((l) => l.href && /adid-\d+/.test(l.href))
      .slice(0, 15)
  );
  console.log(`\nListings found: ${listingLinks.length}`);
  listingLinks.slice(0, 10).forEach((l) =>
    console.log(`  ${l.text.substring(0, 60)} → ${l.href}`)
  );

  // Pagination
  const paginationLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim() }))
      .filter((l) => l.href && /(page|p=|offset)/i.test(l.href))
      .slice(0, 10)
  );
  console.log("\nPagination links:");
  paginationLinks.forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

  // Check for filters (e.g., "Rental" vs "Sale" tabs or dropdowns)
  const filterLinks = await page.$$eval("a", (els) =>
    els
      .map((a) => ({ href: a.getAttribute("href"), text: a.innerText.trim() }))
      .filter((l) => l.href && /(rental|rent|sale|buy)/i.test(l.href + " " + l.text) && l.text.length < 30)
      .slice(0, 15)
  );
  console.log("\nRent/Sale filter links:");
  filterLinks.forEach((l) => console.log(`  "${l.text}" → ${l.href}`));

  // ── Individual listing page ──
  if (listingLinks.length > 0) {
    // Find one that looks like an apartment/condo rental
    const rentalListing = listingLinks.find(
      (l) => /(apartment|condo|studio|bedroom|br\b)/i.test(l.text) && /rent/i.test(l.text)
    ) || listingLinks[0];
    
    const listingUrl = rentalListing.href.startsWith("http")
      ? rentalListing.href
      : `https://www.khmer24.com${rentalListing.href}`;
    
    console.log(`\n=== Listing page: ${listingUrl} ===`);
    await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    console.log(`Title: ${await page.title()}`);

    // Extract content structure
    const h1 = await page.$eval("h1", (e) => e.innerText.trim()).catch(() => "no h1");
    console.log(`H1: ${h1}`);

    const priceEls = await page.$$eval('[class*="price"], [class*="Price"]', (els) =>
      els.map((e) => ({
        class: e.className,
        text: e.innerText.trim().substring(0, 100),
        tag: e.tagName,
      }))
    );
    console.log("\nPrice elements:");
    priceEls.forEach((e) => console.log(`  <${e.tag} class="${e.class}"> ${e.text}`));

    const locationEls = await page.$$eval(
      '[class*="location"], [class*="Location"], [class*="address"], .location-text',
      (els) =>
        els.map((e) => ({
          class: e.className,
          text: e.innerText.trim().substring(0, 100),
        }))
    );
    console.log("\nLocation elements:");
    locationEls.forEach((e) => console.log(`  class="${e.class}" → ${e.text}`));

    // Detail table / specs
    const detailEls = await page.$$eval(
      '[class*="detail"], [class*="spec"], [class*="info"], [class*="attribute"], table td, table th, .item-info, [class*="feature"]',
      (els) =>
        els.map((e) => ({
          class: e.className,
          text: e.innerText.trim().substring(0, 120),
        })).filter(e => e.text.length > 0 && e.text.length < 120)
    );
    console.log("\nDetail/spec elements:");
    detailEls.slice(0, 15).forEach((e) => console.log(`  class="${e.class}" → ${e.text}`));

    // Description
    const descEls = await page.$$eval('[class*="description"], [class*="Description"]', (els) =>
      els.map((e) => ({ class: e.className, text: e.innerText.trim().substring(0, 200) }))
    );
    console.log("\nDescription elements:");
    descEls.forEach((e) => console.log(`  class="${e.class}" → ${e.text}`));

    // Images
    const images = await page.$$eval("img", (els) =>
      els
        .map((e) => e.getAttribute("src") || e.getAttribute("data-src"))
        .filter((s) => s && s.startsWith("http") && !s.includes("logo") && !s.includes("icon") && !s.includes("avatar") && !s.includes("placeholder"))
    );
    console.log(`\nImages: ${images.length}`);
    if (images.length > 0) console.log("  First:", images[0]);

    // Date
    const dateEls = await page.$$eval('[class*="date"], [class*="time"], time', (els) =>
      els.map((e) => ({ class: e.className, text: e.innerText.trim().substring(0, 80), datetime: e.getAttribute("datetime") }))
    );
    console.log("\nDate elements:");
    dateEls.forEach((e) => console.log(`  class="${e.class}" datetime="${e.datetime}" → ${e.text}`));
  }

  await browser.close();
}

main().catch(console.error);
