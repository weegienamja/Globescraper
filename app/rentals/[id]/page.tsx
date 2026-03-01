import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListingDetailClient } from "@/components/rentals/ListingDetailClient";
import "../rentals.css";

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
    },
  });

  if (!listing) notFound();

  // Serialize dates for client component
  const serialized = {
    ...listing,
    postedAt: listing.postedAt?.toISOString() ?? null,
    firstSeenAt: listing.firstSeenAt.toISOString(),
    lastSeenAt: listing.lastSeenAt.toISOString(),
  };

  return (
    <main className="listing-detail">
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
