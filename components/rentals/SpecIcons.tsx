/** Bed / bath / type icons row */
export function SpecIcons({
  propertyType,
  bedrooms,
  bathrooms,
}: {
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
}) {
  const typeLabel = formatPropertyType(propertyType);

  return (
    <div className="rental-card__specs">
      <span className="rental-card__type-badge">{typeLabel}</span>

      {bedrooms != null && (
        <span className="rental-card__spec" title={`${bedrooms} bedroom${bedrooms !== 1 ? "s" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7v11" /><path d="M21 7v11" /><path d="M3 18h18" />
            <path d="M3 11h18" /><path d="M7 11V7a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v4" />
          </svg>
          {bedrooms}
        </span>
      )}

      {bathrooms != null && (
        <span className="rental-card__spec" title={`${bathrooms} bathroom${bathrooms !== 1 ? "s" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z" />
            <path d="M6 12V5a2 2 0 0 1 2-2h3v2.25" />
          </svg>
          {bathrooms}
        </span>
      )}
    </div>
  );
}

function formatPropertyType(pt: string): string {
  const map: Record<string, string> = {
    CONDO: "Condo",
    APARTMENT: "Apartment",
    SERVICED_APARTMENT: "Serviced Apt",
    PENTHOUSE: "Penthouse",
    HOUSE: "House",
    VILLA: "Villa",
    TOWNHOUSE: "Townhouse",
    SHOPHOUSE: "Shophouse",
    LAND: "Land",
    COMMERCIAL: "Commercial",
    WAREHOUSE: "Warehouse",
    OFFICE: "Office",
    OTHER: "Other",
  };
  return map[pt] ?? pt;
}
