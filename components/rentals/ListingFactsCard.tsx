interface FactsCardProps {
  priceMonthlyUsd: number | null;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  city: string;
  district: string | null;
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
