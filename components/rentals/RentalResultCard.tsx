"use client";

import Link from "next/link";
import { ListingCardImageCarousel } from "./ListingCardImageCarousel";
import { PriceBlock } from "./PriceBlock";
import { SpecIcons } from "./SpecIcons";

export interface RentalCardData {
  id: string;
  title: string;
  titleRewritten: string | null;
  city: string;
  district: string | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  priceMonthlyUsd: number | null;
  imageUrlsJson: string | null;
  description: string | null;
  descriptionRewritten: string | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  canonicalUrl: string;
}

export function RentalResultCard({
  listing,
  saved,
  onToggleSave,
}: {
  listing: RentalCardData;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const images = parseImages(listing.imageUrlsJson);
  const displayTitle = listing.titleRewritten || listing.title;
  const desc = listing.descriptionRewritten || listing.description || "";
  const dateStr = formatDate(listing.postedAt || listing.firstSeenAt);

  return (
    <article className="rental-card">
      <ListingCardImageCarousel images={images} alt={displayTitle} />

      <PriceBlock priceMonthlyUsd={listing.priceMonthlyUsd} />

      <div className="rental-card__content">
        <h2 className="rental-card__title">
          <Link href={`/rentals/${listing.id}`} className="rental-card__link">
            {displayTitle}
          </Link>
        </h2>

        <SpecIcons
          propertyType={listing.propertyType}
          bedrooms={listing.bedrooms}
          bathrooms={listing.bathrooms}
        />

        {desc && (
          <p className="rental-card__desc">{stripHtml(desc)}</p>
        )}

        <span className="rental-card__meta">Added on {dateStr}</span>

        <div className="rental-card__actions">
          <a
            href={listing.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rental-card__contact-btn"
            aria-label="View original listing"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Contact
          </a>
          <button
            type="button"
            className={"rental-card__save-btn" + (saved ? " rental-card__save-btn--active" : "")}
            aria-label={saved ? "Remove from saved" : "Save this listing"}
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          >
            <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </article>
  );
}

function parseImages(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((u: unknown) => typeof u === "string" && u.startsWith("http")) : [];
  } catch {
    return [];
  }
}

function formatDate(d: Date | null): string {
  if (!d) return "Unknown";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
