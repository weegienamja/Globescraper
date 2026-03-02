"use client";

import { ListingGallery } from "@/components/rentals/ListingGallery";
import { ListingFactsCard } from "@/components/rentals/ListingFactsCard";
import { AmenitiesList } from "@/components/rentals/AmenitiesList";
import { ListingMap } from "@/components/rentals/ListingMap";
import { useSavedListings } from "@/components/rentals/useSavedListings";

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
  canonicalUrl: string;
  source: string;
  priceHistory: { date: string; price: number | null }[];
}

export function ListingDetailClient({ listing }: { listing: DetailListing }) {
  const { isSaved, toggleSaved } = useSavedListings();

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

          {/* Facilities & Amenities */}
          {listing.amenitiesJson && (
            <section className="listing-detail__section">
              <AmenitiesList amenitiesJson={listing.amenitiesJson} />
            </section>
          )}

          {/* Location */}
          {listing.latitude && listing.longitude && (
            <section className="listing-detail__section">
              <h2 className="listing-detail__section-title">
                Location
              </h2>
              <div className="listing-map">
                <ListingMap
                  lat={listing.latitude}
                  lng={listing.longitude}
                  title={displayTitle}
                />
              </div>
            </section>
          )}

          {/* Price History */}
          <section className="listing-detail__section">
            <h2 className="listing-detail__section-title">Price History</h2>
            <div className="listing-history">
              {listing.priceHistory.length <= 1 ? (
                <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  No price changes
                </span>
              ) : (
                listing.priceHistory.map((entry, i) => (
                  <div key={i} className="listing-history__item">
                    <span className="listing-history__dot" style={{
                      background: i === 0 ? "#64748b" : entry.price != null && listing.priceHistory[i - 1].price != null
                        ? entry.price < listing.priceHistory[i - 1].price! ? "#4ade80" : "#f87171"
                        : "#818cf8"
                    }} />
                    <span className="listing-history__label">{fmtDate(entry.date)}</span>
                    <span style={{ fontWeight: 500 }}>
                      {entry.price != null ? `$${Math.round(entry.price)}/mo` : "Price removed"}
                      {i > 0 && entry.price != null && listing.priceHistory[i - 1].price != null && (
                        <span style={{
                          marginLeft: "6px",
                          fontSize: "0.8rem",
                          color: entry.price < listing.priceHistory[i - 1].price! ? "#4ade80" : "#f87171",
                        }}>
                          {entry.price < listing.priceHistory[i - 1].price! ? "↓" : "↑"}
                          ${Math.abs(Math.round(entry.price - listing.priceHistory[i - 1].price!))}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
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
          saved={isSaved(listing.id)}
          onToggleSave={() => toggleSaved(listing.id)}
          sourceUrl={listing.canonicalUrl}
          sourceName={formatSourceName(listing.source)}
        />
      </div>

    </>
  );
}

function formatSourceName(source: string): string {
  const map: Record<string, string> = {
    REALESTATE_KH: "Realestate.com.kh",
    KHMER24: "Khmer24",
    FAZWAZ: "FazWaz",
    COMPASS: "Compass",
    CAMBODIA_HOUSING: "Cambodia Housing",
    HUTTONS: "Huttons",
  };
  return map[source] ?? source;
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
