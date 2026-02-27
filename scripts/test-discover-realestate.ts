// Test fixed realestate.com.kh discover adapter
import { discoverRealestateKh } from "../lib/rentals/sources/realestate-kh";

async function main() {
  console.log("Testing discoverRealestateKh...\n");

  try {
    const results = await discoverRealestateKh();
    console.log(`✅ Discovered ${results.length} listing URLs\n`);

    if (results.length === 0) {
      console.log("❌ No listings found — adapter selectors may need updating");
      return;
    }

    // Show first 10
    console.log("Sample URLs:");
    results.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.url} (ID: ${r.sourceListingId})`);
    });

    // Stats
    const withId = results.filter(r => r.sourceListingId).length;
    const rentUrls = results.filter(r => r.url.includes("/rent/")).length;
    const newDevUrls = results.filter(r => r.url.includes("/new-developments/")).length;
    console.log(`\nWith listing ID: ${withId}/${results.length}`);
    console.log(`/rent/ URLs: ${rentUrls}`);
    console.log(`/new-developments/ URLs: ${newDevUrls}`);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
}

main();
