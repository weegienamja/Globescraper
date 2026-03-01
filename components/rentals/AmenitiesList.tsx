import { classifyAmenities } from "@/lib/amenityClassification";

export function AmenitiesList({ amenitiesJson }: { amenitiesJson: string | null }) {
  const items = parseAmenities(amenitiesJson);
  if (items.length === 0) return null;

  const { facilities, amenities } = classifyAmenities(items);

  return (
    <div className="listing-amenities-split">
      {facilities.length > 0 && (
        <div className="listing-amenities-split__group">
          <h3 className="listing-amenities-split__heading">Facilities</h3>
          <div className="listing-amenities">
            {facilities.map((item, i) => (
              <div key={i} className="listing-amenities__item">
                <span className="listing-amenities__dot" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
      {amenities.length > 0 && (
        <div className="listing-amenities-split__group">
          <h3 className="listing-amenities-split__heading">Amenities</h3>
          <div className="listing-amenities">
            {amenities.map((item, i) => (
              <div key={i} className="listing-amenities__item">
                <span className="listing-amenities__dot" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
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
