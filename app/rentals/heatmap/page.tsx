import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicHeatmapClient } from "./PublicHeatmapClient";

export const revalidate = 3600; // regenerate every hour

export const metadata: Metadata = {
  title: "Cambodia Rental Heatmap — GlobeScraper",
  description:
    "Interactive map of rental prices across Cambodia. See median prices by district for apartments, condos, houses, and more.",
  openGraph: {
    title: "Cambodia Rental Heatmap — GlobeScraper",
    description:
      "Interactive map of rental prices across Cambodia by district.",
    url: "https://globescraper.com/rentals/heatmap",
    siteName: "GlobeScraper",
    type: "website",
  },
};

/* ── Aggregation (same logic as admin page, no individual listing data) ── */

interface HeatmapRow {
  district: string | null;
  city: string | null;
  bedrooms: number | null;
  propertyType: string;
  listingCount: number;
  medianPriceUsd: number | null;
  p25PriceUsd: number | null;
  p75PriceUsd: number | null;
}

async function getHeatmapData(): Promise<{
  data: HeatmapRow[];
  totalListings: number;
}> {
  const listings = await prisma.rentalListing.findMany({
    where: { isActive: true },
    select: {
      district: true,
      city: true,
      bedrooms: true,
      propertyType: true,
      priceMonthlyUsd: true,
    },
  });

  const groups = new Map<
    string,
    {
      district: string | null;
      city: string | null;
      bedrooms: number | null;
      propertyType: string;
      prices: number[];
    }
  >();

  for (const l of listings) {
    const key = `${l.district}|${l.propertyType}|${l.bedrooms}`;
    if (!groups.has(key)) {
      groups.set(key, {
        district: l.district,
        city: l.city,
        bedrooms: l.bedrooms,
        propertyType: l.propertyType || "Unknown",
        prices: [],
      });
    }
    if (l.priceMonthlyUsd !== null)
      groups.get(key)!.prices.push(l.priceMonthlyUsd);
  }

  const displayData: HeatmapRow[] = [];
  for (const g of groups.values()) {
    const sorted = g.prices.sort((a, b) => a - b);
    const median =
      sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
    const p25 =
      sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.25)] : null;
    const p75 =
      sorted.length >= 4 ? sorted[Math.floor(sorted.length * 0.75)] : null;
    displayData.push({
      district: g.district,
      city: g.city,
      bedrooms: g.bedrooms,
      propertyType: g.propertyType,
      listingCount: sorted.length,
      medianPriceUsd: median,
      p25PriceUsd: p25,
      p75PriceUsd: p75,
    });
  }
  displayData.sort(
    (a, b) => (b.medianPriceUsd ?? 0) - (a.medianPriceUsd ?? 0),
  );

  return { data: displayData, totalListings: listings.length };
}

export default async function PublicHeatmapPage() {
  const { data, totalListings } = await getHeatmapData();

  return (
    <PublicHeatmapClient
      data={data}
      totalListings={totalListings}
    />
  );
}
