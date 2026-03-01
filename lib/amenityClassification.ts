/**
 * lib/amenityClassification.ts
 *
 * Splits raw amenity strings into two categories:
 *   • Facilities – building / complex-level features
 *   • Amenities  – in-unit features
 *
 * Any value that doesn't appear in either set falls through to Amenities.
 */

/** Building / complex-level features */
export const FACILITIES: ReadonlySet<string> = new Set([
  "Swimming Pool",
  "Gym",
  "Fitness Center",
  "Elevator",
  "24h Security",
  "CCTV",
  "Parking",
  "Car Parking",
  "Motorcycle Parking",
  "Rooftop",
  "Sauna",
  "Sky Bar/Lounge",
  "Lounge",
  "Garden",
  "BBQ Area",
  "Playground",
  "Reception/Lobby",
  "Meeting Room",
  "Co-working Space",
  "Yoga Room",
  "Concierge",
  "Cleaning Service",
]);

/** In-unit features */
export const AMENITIES: ReadonlySet<string> = new Set([
  "Air Conditioning",
  "Balcony",
  "Kitchen",
  "Washing Machine",
  "Refrigerator",
  "Cable TV",
  "WiFi/Internet",
  "Fully Furnished",
  "Unfurnished",
  "Hot Water",
  "Terrace",
  "Bathtub",
  "Oven",
  "Microwave",
  "Laundry",
  "Electricity Metered",
  "Water Metered",
]);

/**
 * Top facilities shown as checkboxes in the advanced filter panel.
 * Ordered by frequency (most common first).
 */
export const FILTERABLE_FACILITIES = [
  "Swimming Pool",
  "Gym",
  "Parking",
  "24h Security",
  "Elevator",
  "Rooftop",
  "Sauna",
  "Garden",
] as const;

/**
 * Top amenities shown as checkboxes in the advanced filter panel.
 * Ordered by frequency (most common first).
 */
export const FILTERABLE_AMENITIES = [
  "Fully Furnished",
  "WiFi/Internet",
  "Kitchen",
  "Balcony",
  "Washing Machine",
  "Air Conditioning",
  "Refrigerator",
] as const;

export interface ClassifiedAmenities {
  facilities: string[];
  amenities: string[];
}

/**
 * Classify a flat list of amenity strings into facilities and amenities.
 * Unknown values are bucketed as amenities.
 */
export function classifyAmenities(items: string[]): ClassifiedAmenities {
  const facilities: string[] = [];
  const amenities: string[] = [];

  for (const item of items) {
    if (FACILITIES.has(item)) {
      facilities.push(item);
    } else {
      amenities.push(item);
    }
  }

  return { facilities, amenities };
}
