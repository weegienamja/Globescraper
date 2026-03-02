import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/site";
import { ListingDetailClient } from "@/components/rentals/ListingDetailClient";
import "../rentals.css";

/* ── Schema.org type mapping ─────────────────────────────── */

const SCHEMA_TYPE_MAP: Record<string, string> = {
  APARTMENT: "Apartment",
  SERVICED_APARTMENT: "Apartment",
  CONDO: "Apartment",
  PENTHOUSE: "Apartment",
  HOUSE: "House",
  VILLA: "House",
  TOWNHOUSE: "House",
  SHOPHOUSE: "House",
  OFFICE: "Residence",
  COMMERCIAL: "Residence",
  WAREHOUSE: "Residence",
  LAND: "Residence",
  OTHER: "Residence",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.rentalListing.findUnique({
    where: { id },
    select: { title: true, titleRewritten: true, city: true, district: true },
  });
  if (!listing) return { title: "Listing Not Found" };

  const title = listing.titleRewritten || listing.title;
  return {
    title: `${title} | Properties to Rent`,
    description: `Rental property in ${listing.district ?? listing.city}`,
  };
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;

  const listing = await prisma.rentalListing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      titleRewritten: true,
      city: true,
      district: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      sizeSqm: true,
      priceMonthlyUsd: true,
      imageUrlsJson: true,
      description: true,
      descriptionRewritten: true,
      amenitiesJson: true,
      postedAt: true,
      firstSeenAt: true,
      lastSeenAt: true,
      latitude: true,
      longitude: true,
      canonicalUrl: true,
      source: true,
      snapshots: {
        select: {
          scrapedAt: true,
          priceMonthlyUsd: true,
        },
        orderBy: { scrapedAt: "asc" },
      },
    },
  });

  if (!listing) notFound();

  /* ── Build JSON-LD structured data ──────────────────────── */

  const displayTitle = listing.titleRewritten || listing.title;
  const displayDesc =
    listing.descriptionRewritten ||
    listing.description ||
    `${displayTitle} for rent in ${listing.district ?? listing.city}`;
  const images: string[] = listing.imageUrlsJson
    ? JSON.parse(listing.imageUrlsJson)
    : [];
  const schemaType = SCHEMA_TYPE_MAP[listing.propertyType] ?? "Residence";
  const pageUrl = `${siteConfig.url}/rentals/${listing.id}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: displayTitle,
    description:
      displayDesc.length > 500
        ? displayDesc.slice(0, 497) + "..."
        : displayDesc,
    url: pageUrl,
    ...(images.length > 0 && { image: images.slice(0, 6) }),
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.district ?? listing.city,
      addressRegion: listing.city,
      addressCountry: "KH",
    },
    ...(listing.latitude &&
      listing.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: listing.latitude,
          longitude: listing.longitude,
        },
      }),
    ...(listing.bedrooms != null && {
      numberOfBedrooms: listing.bedrooms,
    }),
    ...(listing.bathrooms != null && {
      numberOfBathroomsTotal: listing.bathrooms,
    }),
    ...(listing.sizeSqm != null && {
      floorSize: {
        "@type": "QuantitativeValue",
        value: listing.sizeSqm,
        unitCode: "MTK",
      },
    }),
    ...(listing.priceMonthlyUsd != null && {
      offers: {
        "@type": "Offer",
        price: listing.priceMonthlyUsd,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: listing.priceMonthlyUsd,
          priceCurrency: "USD",
          unitText: "MONTH",
        },
      },
    }),
  };

  // Build price history: only entries where price actually changed
  const priceChanges: { date: string; price: number | null }[] = [];
  let prevPrice: number | null | undefined = undefined;
  for (const snap of listing.snapshots) {
    if (snap.priceMonthlyUsd !== prevPrice) {
      priceChanges.push({
        date: snap.scrapedAt.toISOString(),
        price: snap.priceMonthlyUsd,
      });
      prevPrice = snap.priceMonthlyUsd;
    }
  }

  // Serialize dates for client component (omit raw snapshots)
  const { snapshots: _snaps, ...listingRest } = listing;
  const serialized = {
    ...listingRest,
    priceHistory: priceChanges,
    postedAt: listing.postedAt?.toISOString() ?? null,
    firstSeenAt: listing.firstSeenAt.toISOString(),
    lastSeenAt: listing.lastSeenAt.toISOString(),
  };

  return (
    <main className="listing-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/rentals" className="listing-detail__back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to search results
      </Link>

      <ListingDetailClient listing={serialized} />
    </main>
  );
}
