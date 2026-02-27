/**
 * Final details: listing header structure + pagination
 */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // ── Listing detail (the $600 apartment) ──
  console.log("=== Listing detail page ===");
  await page.goto(
    "https://www.khmer24.com/en/video-below-1-bedroom-condo-for-rent-in-agile-sky-residence-border-bkk1-adid-12920868",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );
  await page.waitForTimeout(3000);

  // Header section - get the full text of the header area
  const headerHtml = await page.evaluate(() => {
    const header = document.querySelector("article header");
    return header ? header.innerHTML.substring(0, 3000) : "no header";
  });
  console.log("Header HTML (first 2000 chars):");
  console.log(headerHtml.substring(0, 2000));

  // Get the flex-1 div inside header that has the title + price + location
  const titleBlock = await page.evaluate(() => {
    const el = document.querySelector("article header .flex-1");
    if (!el) return "not found";
    return el.innerText.trim().substring(0, 500);
  });
  console.log("\nTitle block text:");
  console.log(titleBlock);

  // Get the description section text  
  const descSection = await page.evaluate(() => {
    const p = document.querySelector("article section p.text-base\\/8, article section .whitespace-break-spaces");
    return p ? p.innerText.trim().substring(0, 500) : "not found";
  });
  console.log("\nDescription:");
  console.log(descSection);

  // Get the dt/dd pairs (structured specs)
  const specs = await page.$$eval("article section dt", (dts) =>
    dts.map((dt) => {
      const dd = dt.nextElementSibling;
      return {
        label: dt.innerText.trim(),
        value: dd ? dd.innerText.trim() : "",
      };
    })
  );
  console.log("\nStructured specs:");
  specs.forEach((s) => console.log(`  ${s.label}: ${s.value}`));

  // ── Pagination on category ──
  console.log("\n=== Category pagination ===");
  await page.goto("https://www.khmer24.com/en/c-apartment-for-rent", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Scroll to bottom to trigger any lazy loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Find pagination/load-more buttons
  const paginationEls = await page.$$eval("button, a", (els) =>
    els
      .filter((e) => {
        const text = e.innerText.trim().toLowerCase();
        return text.includes("more") || text.includes("next") || text.includes("load") || /^\d+$/.test(text) || text === "»";
      })
      .map((e) => ({
        tag: e.tagName,
        href: e.getAttribute("href"),
        text: e.innerText.trim().substring(0, 40),
        class: (typeof e.className === "string" ? e.className : "").substring(0, 60),
      }))
      .slice(0, 10)
  );
  console.log("Pagination/Load-more elements:");
  paginationEls.forEach((e) =>
    console.log(`  <${e.tag} class="${e.class}" href="${e.href}"> "${e.text}"`)
  );

  // Try scrolling infinite scroll  
  const countBefore = await page.$$eval("a", (els) =>
    els.filter((a) => /adid-\d+/.test(a.getAttribute("href") || "")).length
  );
  console.log(`\nListings before scroll: ${countBefore}`);

  // Scroll multiple times
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
  }

  const countAfter = await page.$$eval("a", (els) =>
    els.filter((a) => /adid-\d+/.test(a.getAttribute("href") || "")).length
  );
  console.log(`Listings after 3 scrolls: ${countAfter}`);

  // Check if there's a "?page=2" style URL
  await page.goto("https://www.khmer24.com/en/c-apartment-for-rent?page=2", {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(3000);
  const page2Count = await page.$$eval("a", (els) =>
    els.filter((a) => /adid-\d+/.test(a.getAttribute("href") || "")).length
  );
  console.log(`\n?page=2 listing count: ${page2Count}`);
  console.log(`?page=2 URL: ${page.url()}`);

  await browser.close();
}

main().catch(console.error);
