/**
 * Title generator for rental listings using reverse geocoding (Nominatim/OSM).
 *
 * - Listings WITH GPS coordinates → reverse-geocode to get street/road name,
 *   then format as: "[Street/Road], [Sangkat/Area], [District], [City]"
 * - Listings WITHOUT GPS → fallback: "[District], [City]"
 *
 * Uses OpenStreetMap Nominatim (free, no API key, 1 req/sec).
 * Results are cached in RentalListing.titleRewritten.
 */

import { prisma } from "@/lib/prisma";

/* ── Types ───────────────────────────────────────────────── */

interface NominatimAddress {
  road?: string;
  street?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  town?: string;
  state?: string;
  county?: string;
  country?: string;
}

interface NominatimResult {
  address: NominatimAddress;
  display_name: string;
}

interface ListingForTitle {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
  city: string;
  propertyType: string;
  bedrooms: number | null;
}

export interface TitleGenOptions {
  /** Max listings to process */
  limit?: number;
  /** Force re-title even those already titled */
  force?: boolean;
  /** Only listings with GPS (skip fallback) */
  geoOnly?: boolean;
  /** Dry run — don't persist */
  dryRun?: boolean;
  /** Log function */
  log?: (msg: string) => void;
}

export interface TitleGenResult {
  titled: number;
  geocoded: number;
  fallback: number;
}

/* ── Nominatim reverse geocode ───────────────────────────── */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<NominatimAddress | null> {
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "GlobeScraper/1.0 (rental-pipeline)" },
    });
    if (!res.ok) return null;
    const data: NominatimResult = await res.json();
    return data.address ?? null;
  } catch {
    return null;
  }
}

/* ── Title builders ──────────────────────────────────────── */

function buildGeoTitle(addr: NominatimAddress, listing: ListingForTitle): string {
  const parts: string[] = [];

  // Street / road name
  const street = addr.road || addr.street;
  if (street) {
    parts.push(street);
  }

  // Sangkat / neighbourhood / suburb
  const sangkat =
    addr.neighbourhood ||
    addr.suburb ||
    addr.quarter ||
    addr.village;
  if (sangkat) {
    parts.push(sangkat);
  }

  // District (prefer listing data, fall back to Nominatim)
  const district =
    listing.district ||
    addr.city_district ||
    addr.county;
  if (district) {
    parts.push(district);
  }

  // City
  const city = addr.city || addr.town || listing.city;
  if (city && city !== district) {
    parts.push(city);
  }

  if (parts.length === 0) return "";
  return parts.join(", ");
}

function buildFallbackTitle(listing: ListingForTitle): string {
  const parts: string[] = [];

  if (listing.district) {
    parts.push(listing.district);
  }

  if (listing.city && listing.city !== listing.district) {
    parts.push(listing.city);
  }

  if (parts.length === 0) return "";
  return parts.join(", ");
}

/* ── Main orchestrator ───────────────────────────────────── */

export async function runTitleGeocoding(
  options: TitleGenOptions = {}
): Promise<TitleGenResult> {
  const log = options.log ?? console.log;
  const limit = options.limit ?? 500;

  // Query listings needing titles
  const where: Record<string, unknown> = { isActive: true };
  if (!options.force) {
    where.titleRewritten = null;
  }

  const listings = await prisma.rentalListing.findMany({
    where,
    select: {
      id: true,
      title: true,
      latitude: true,
      longitude: true,
      district: true,
      city: true,
      propertyType: true,
      bedrooms: true,
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });

  log(`Found ${listings.length} listings needing titles`);
  if (listings.length === 0) return { titled: 0, geocoded: 0, fallback: 0 };

  // Split into geo vs non-geo
  const withGps = listings.filter((l) => l.latitude != null && l.longitude != null);
  const withoutGps = options.geoOnly ? [] : listings.filter((l) => l.latitude == null || l.longitude == null);

  log(`  With GPS: ${withGps.length} | Without GPS: ${withoutGps.length}`);

  let titled = 0;
  let geocoded = 0;
  let fallback = 0;

  // ── Process listings WITH GPS (reverse geocode) ──
  for (let i = 0; i < withGps.length; i++) {
    const listing = withGps[i];
    const addr = await reverseGeocode(listing.latitude!, listing.longitude!);

    let newTitle = "";
    if (addr) {
      newTitle = buildGeoTitle(addr, listing);
    }

    if (!newTitle) {
      // Geocode returned nothing useful — use fallback
      newTitle = buildFallbackTitle(listing);
    }

    if (newTitle && newTitle.length > 5) {
      if (!options.dryRun) {
        await prisma.rentalListing.update({
          where: { id: listing.id },
          data: { titleRewritten: newTitle },
        });
      }
      titled++;
      if (addr) geocoded++;
      else fallback++;

      log(
        `  ${addr ? "📍" : "📋"} [${i + 1}/${withGps.length}] "${listing.title.slice(0, 40)}..." → "${newTitle}"`
      );
    } else {
      log(`  ⚠ [${i + 1}/${withGps.length}] No title for "${listing.title.slice(0, 40)}..."`);
    }

    // Nominatim rate limit: 1 request per second
    if (i < withGps.length - 1) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  // ── Process listings WITHOUT GPS (metadata fallback) ──
  for (let i = 0; i < withoutGps.length; i++) {
    const listing = withoutGps[i];
    const newTitle = buildFallbackTitle(listing);

    if (newTitle && newTitle.length > 3) {
      if (!options.dryRun) {
        await prisma.rentalListing.update({
          where: { id: listing.id },
          data: { titleRewritten: newTitle },
        });
      }
      titled++;
      fallback++;

      if ((i + 1) % 50 === 0 || i === withoutGps.length - 1) {
        log(`  📋 Fallback titles: ${i + 1}/${withoutGps.length}`);
      }
    }
  }

  log(`\n╔══════════════════════════════════════════╗`);
  log(`║  Title Generation Complete               ║`);
  log(`╠══════════════════════════════════════════╣`);
  log(`║  Total titled: ${String(titled).padStart(6)}                    ║`);
  log(`║  Geocoded:     ${String(geocoded).padStart(6)}                    ║`);
  log(`║  Fallback:     ${String(fallback).padStart(6)}                    ║`);
  log(`╚══════════════════════════════════════════╝`);

  return { titled, geocoded, fallback };
}
