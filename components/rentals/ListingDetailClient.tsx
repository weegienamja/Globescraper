"use client";

import { useState } from "react";
import { ListingGallery } from "@/components/rentals/ListingGallery";
import { ListingFactsCard } from "@/components/rentals/ListingFactsCard";
import { AmenitiesList } from "@/components/rentals/AmenitiesList";

interface DetailListing {
  id: string;
  title: string;
  titleRewritten: string | null;
  city: string;
  district: string | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  priceMonthlyUsd: number | null;
  imageUrlsJson: string | null;
  description: string | null;
  descriptionRewritten: string | null;
  amenitiesJson: string | null;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  latitude: number | null;
  longitude: number | null;
}

export function ListingDetailClient({ listing }: { listing: DetailListing }) {
  const [showModal, setShowModal] = useState(false);

  const displayTitle = listing.titleRewritten || listing.title;
  const desc = listing.descriptionRewritten || listing.description || "";
  const images = parseImages(listing.imageUrlsJson);
  const monthly = listing.priceMonthlyUsd ? Math.round(listing.priceMonthlyUsd) : null;
  const weekly = listing.priceMonthlyUsd ? Math.round((listing.priceMonthlyUsd * 12) / 52) : null;

  return (
    <>
      <div className="listing-detail__grid">
        {/* Left column */}
        <div>
          <ListingGallery images={images} alt={displayTitle} />

          <div className="listing-detail__header">
            <h1 className="listing-detail__title">{displayTitle}</h1>
            <div className="listing-detail__price-row">
              {monthly != null ? (
                <>
                  <span className="listing-detail__price">${monthly.toLocaleString()} pcm</span>
                  <span className="listing-detail__price-weekly">${weekly!.toLocaleString()} pw</span>
                </>
              ) : (
                <span className="listing-detail__price">Price on request</span>
              )}
            </div>
            <p className="listing-detail__date">
              {listing.postedAt ? `Added on ${fmtDate(listing.postedAt)}` : `First seen ${fmtDate(listing.firstSeenAt)}`}
            </p>
          </div>

          {/* Description */}
          {desc && (
            <section className="listing-detail__section">
              <h2 className="listing-detail__section-title">Description</h2>
              <div className="listing-detail__desc">{stripHtml(desc)}</div>
            </section>
          )}

          {/* Amenities / Key Features */}
          {listing.amenitiesJson && (
            <section className="listing-detail__section">
              <h2 className="listing-detail__section-title">Key features</h2>
              <AmenitiesList amenitiesJson={listing.amenitiesJson} />
            </section>
          )}

          {/* Location */}
          {listing.latitude && listing.longitude && (
            <section className="listing-detail__section">
              <h2 className="listing-detail__section-title">
                {displayTitle}
              </h2>
              <div className="listing-map">
                <span>
                  Approximate location: {listing.latitude.toFixed(4)}, {listing.longitude.toFixed(4)}
                </span>
              </div>
            </section>
          )}

          {/* History */}
          <section className="listing-detail__section">
            <h2 className="listing-detail__section-title">Listing history</h2>
            <div className="listing-history">
              {listing.postedAt && (
                <div className="listing-history__item">
                  <span className="listing-history__dot" />
                  <span className="listing-history__label">Posted</span>
                  <span>{fmtDate(listing.postedAt)}</span>
                </div>
              )}
              <div className="listing-history__item">
                <span className="listing-history__dot" />
                <span className="listing-history__label">First seen</span>
                <span>{fmtDate(listing.firstSeenAt)}</span>
              </div>
              <div className="listing-history__item">
                <span className="listing-history__dot" />
                <span className="listing-history__label">Last seen</span>
                <span>{fmtDate(listing.lastSeenAt)}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right column - sticky facts card */}
        <ListingFactsCard
          priceMonthlyUsd={listing.priceMonthlyUsd}
          propertyType={listing.propertyType}
          bedrooms={listing.bedrooms}
          bathrooms={listing.bathrooms}
          sizeSqm={listing.sizeSqm}
          city={listing.city}
          district={listing.district}
          onEnquire={() => setShowModal(true)}
        />
      </div>

      {/* Enquire modal */}
      {showModal && (
        <div className="enquire-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true" aria-label="Enquire about this property">
          <div className="enquire-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="enquire-modal__title">Enquire about this property</h3>
            <p className="enquire-modal__text">
              Messaging integration is coming soon. In the meantime, you can contact the agent through the original listing site.
            </p>
            <button
              type="button"
              className="enquire-modal__close"
              onClick={() => setShowModal(false)}
              aria-label="Close modal"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function parseImages(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http")) : [];
  } catch {
    return [];
  }
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
