import { RentalResultCard, type RentalCardData } from "./RentalResultCard";

export type { RentalCardData };

export function RentalResultsList({ listings }: { listings: RentalCardData[] }) {
  if (listings.length === 0) {
    return (
      <div className="rentals-empty">
        <div className="rentals-empty__icon">🏠</div>
        <p className="rentals-empty__text">No properties found matching your filters.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {listings.map((listing) => (
        <RentalResultCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
