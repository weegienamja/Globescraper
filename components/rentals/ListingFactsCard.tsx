interface FactsCardProps {
  priceMonthlyUsd: number | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  city: string;
  district: string | null;
  saved: boolean;
  onToggleSave: () => void;
  onEnquire: () => void;
}

export function ListingFactsCard({
  priceMonthlyUsd,
  propertyType,
  bedrooms,
  bathrooms,
  sizeSqm,
  city,
  district,
  saved,
  onToggleSave,
  onEnquire,
}: FactsCardProps) {
  const monthly = priceMonthlyUsd ? `$${Math.round(priceMonthlyUsd).toLocaleString()}` : "Ask";
  const weekly = priceMonthlyUsd ? `$${Math.round((priceMonthlyUsd * 12) / 52).toLocaleString()} pw` : null;

  return (
    <aside className="listing-facts">
      <h2 className="listing-facts__title">Key facts</h2>

      <div className="listing-facts__grid">
        <FactItem label="Price" value={`${monthly} pcm`} />
        {weekly && <FactItem label="Weekly" value={weekly} />}

        <div className="listing-facts__divider" />

        <FactItem label="Property type" value={formatType(propertyType)} />
        <FactItem label="Bedrooms" value={bedrooms != null ? String(bedrooms) : "N/A"} />
        <FactItem label="Bathrooms" value={bathrooms != null ? String(bathrooms) : "N/A"} />
        <FactItem label="Size" value={sizeSqm ? `${sizeSqm} sqm` : "Ask agent"} />

        <div className="listing-facts__divider" />

        <FactItem label="City" value={city} />
        {district && <FactItem label="District" value={district} />}
      </div>

      <button
        type="button"
        className="listing-facts__enquire"
        onClick={onEnquire}
        aria-label="Enquire about this property"
      >
        Enquire
      </button>

      <button
        type="button"
        className={"listing-facts__save" + (saved ? " listing-facts__save--active" : "")}
        onClick={onToggleSave}
        aria-label={saved ? "Remove from saved" : "Save this listing"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
    </aside>
  );
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="listing-facts__item">
      <span className="listing-facts__label">{label}</span>
      <span className="listing-facts__value">{value}</span>
    </div>
  );
}

function formatType(pt: string): string {
  const map: Record<string, string> = {
    CONDO: "Condo",
    APARTMENT: "Apartment",
    SERVICED_APARTMENT: "Serviced Apartment",
    PENTHOUSE: "Penthouse",
    HOUSE: "House",
    VILLA: "Villa",
    TOWNHOUSE: "Townhouse",
  };
  return map[pt] ?? pt;
}
