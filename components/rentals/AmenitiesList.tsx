export function AmenitiesList({ amenitiesJson }: { amenitiesJson: string | null }) {
  const items = parseAmenities(amenitiesJson);
  if (items.length === 0) return null;

  return (
    <div className="listing-amenities">
      {items.map((item, i) => (
        <div key={i} className="listing-amenities__item">
          <span className="listing-amenities__dot" aria-hidden="true" />
          {item}
        </div>
      ))}
    </div>
  );
}

function parseAmenities(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((a): a is string => typeof a === "string" && a.trim().length > 0);
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed)
        .filter(([, v]) => v === true || v === "true")
        .map(([k]) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    }
    return [];
  } catch {
    return [];
  }
}
