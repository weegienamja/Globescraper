/**
 * Explore Khmer24 apartment/condo listing pages
 */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const categoryUrls = [
    "https://www.khmer24.com/en/c-apartment-for-rent",
    "https://www.khmer24.com/en/c-condo-for-sale",
    "https://www.khmer24.com/en/c-room-for-rent",
  ];

  for (const catUrl of categoryUrls) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Category: ${catUrl}`);
    console.log("=".repeat(60));
    
    await page.goto(catUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log(`Final URL: ${page.url()}`);
    console.log(`Title: ${await page.title()}`);

    // Get listing links — Khmer24 uses adid-NNNNNN pattern
    const listingLinks = await page.$$eval("a", (els) =>
      els
        .map((a) => ({
          href: a.getAttribute("href") || "",
          text: a.innerText.trim().substring(0, 100),
        }))
        .filter((l) => /adid-\d+/.test(l.href))
    );
    console.log(`Listing links found: ${listingLinks.length}`);
    listingLinks.slice(0, 5).forEach((l, i) =>
      console.log(`  [${i}] ${l.text.substring(0, 60)} → ${l.href}`)
    );

    // Pagination
    const nextPage = await page.$$eval("a", (els) =>
      els
        .map((a) => ({ href: a.getAttribute("href") || "", text: a.innerText.trim() }))
        .filter((l) => /\?page=|\/page\/|p=2/.test(l.href) || l.text === "2" || l.text === "Next" || l.text === "»")
        .slice(0, 5)
    );
    console.log("Pagination:");
    nextPage.forEach((l) => console.log(`  "${l.text}" → ${l.href}`));
  }

  // Now explore an individual listing from the apartment-for-rent category
  console.log(`\n${"=".repeat(60)}`);
  console.log("Individual listing page");
  console.log("=".repeat(60));

  await page.goto("https://www.khmer24.com/en/c-apartment-for-rent", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const firstListing = await page.$$eval("a", (els) => {
    const found = els.find((a) => /adid-\d+/.test(a.getAttribute("href") || ""));
    return found ? found.getAttribute("href") : null;
  });

  if (firstListing) {
    const listingUrl = firstListing.startsWith("http")
      ? firstListing
      : `https://www.khmer24.com${firstListing}`;

    console.log(`Navigating to: ${listingUrl}`);
    await page.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    console.log(`Title: ${await page.title()}`);

    // Get the full page HTML structure overview
    const structure = await page.evaluate(() => {
      function describe(el, depth = 0) {
        if (depth > 4) return "";
        let out = "";
        const cls = el.className && typeof el.className === "string" ? el.className.substring(0, 60) : "";
        const id = el.id || "";
        const text = el.children.length === 0 ? el.innerText?.trim().substring(0, 80) : "";
        if (cls || id || text) {
          out += "  ".repeat(depth) + `<${el.tagName.toLowerCase()}` + (id ? ` id="${id}"` : "") + (cls ? ` class="${cls}"` : "") + ">";
          if (text) out += ` "${text}"`;
          out += "\n";
        }
        for (const child of el.children) {
          out += describe(child, depth + 1);
        }
        return out;
      }
      // Focus on main content area
      const main = document.querySelector("main, #app, .content, .container, article, .ad-detail, [class*='detail']");
      if (main) return describe(main);
      return describe(document.body);
    });
    console.log("\nPage structure (first 3000 chars):");
    console.log(structure.substring(0, 3000));

    // Specific elements
    const h1 = await page.$eval("h1", (e) => e.innerText.trim()).catch(() => "no h1");
    console.log(`\nH1: ${h1}`);

    // All text with "price" or "$" context
    const priceTexts = await page.$$eval("*", (els) =>
      els
        .filter((e) => {
          const cls = (typeof e.className === "string" ? e.className : "").toLowerCase();
          const text = e.innerText?.trim() || "";
          return (
            (cls.includes("price") || (text.includes("$") && text.length < 50)) &&
            e.children.length < 3
          );
        })
        .map((e) => ({
          tag: e.tagName,
          class: typeof e.className === "string" ? e.className : "",
          text: e.innerText?.trim().substring(0, 80),
        }))
        .slice(0, 15)
    );
    console.log("\nPrice-related elements:");
    priceTexts.forEach((e) => console.log(`  <${e.tag} class="${e.class}"> "${e.text}"`));

    // Location
    const locTexts = await page.$$eval("*", (els) =>
      els
        .filter((e) => {
          const cls = (typeof e.className === "string" ? e.className : "").toLowerCase();
          return cls.includes("location") || cls.includes("address");
        })
        .map((e) => ({
          tag: e.tagName,
          class: typeof e.className === "string" ? e.className : "",
          text: e.innerText?.trim().substring(0, 120),
        }))
        .slice(0, 10)
    );
    console.log("\nLocation elements:");
    locTexts.forEach((e) => console.log(`  <${e.tag} class="${e.class}"> "${e.text}"`));
  }

  await browser.close();
}

main().catch(console.error);
