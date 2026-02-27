// Test scraping a single listing from realestate.com.kh
import { scrapeListingRealestateKh } from "../lib/rentals/sources/realestate-kh";

async function main() {
  const testUrl = "https://www.realestate.com.kh/rent/bkk-1/3-bed-4-bath-apartment-259490/";
  console.log("Testing scrapeListingRealestateKh...");
  console.log("URL:", testUrl, "\n");

  try {
    const result = await scrapeListingRealestateKh(testUrl);
    if (!result) {
      console.log("❌ scrapeListingRealestateKh returned null");
      return;
    }
    console.log("✅ Scraped successfully!\n");
    console.log("Title:", result.title);
    console.log("Type:", result.propertyType);
    console.log("District:", result.district);
    console.log("Bedrooms:", result.bedrooms);
    console.log("Bathrooms:", result.bathrooms);
    console.log("Size:", result.sizeSqm, "sqm");
    console.log("Price (original):", result.priceOriginal);
    console.log("Price (USD/mo):", result.priceMonthlyUsd);
    console.log("Currency:", result.currency);
    console.log("Images:", result.imageUrls.length);
    if (result.imageUrls.length > 0) {
      console.log("  First:", result.imageUrls[0]);
    }
    console.log("Posted:", result.postedAt);
    console.log("Source ID:", result.sourceListingId);
  } catch (e: any) {
    console.error("❌ Error:", e.message);
  }
}

main();
