/**
 * Content fingerprint helper for rental listings.
 *
 * When sourceListingId is not available, we compute a fingerprint
 * from normalised listing attributes to detect duplicates.
 */

import { createHash } from "crypto";
import { PropertyType } from "@prisma/client";

export interface FingerprintInput {
  title: string;
  district: string | null;
  bedrooms: number | null;
  propertyType: PropertyType;
  priceMonthlyUsd: number | null;
  firstImageUrl: string | null;
}

/**
 * Compute a SHA-256 content fingerprint for deduplication.
 *
 * Combines: title + district + bedrooms + propertyType + price (rounded to 10) + first image URL
 */
export function computeFingerprint(input: FingerprintInput): string {
  const parts = [
    input.title.toLowerCase().trim(),
    (input.district ?? "").toLowerCase().trim(),
    String(input.bedrooms ?? ""),
    input.propertyType,
    input.priceMonthlyUsd !== null ? String(Math.round(input.priceMonthlyUsd / 10) * 10) : "",
    (input.firstImageUrl ?? "").toLowerCase().trim(),
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex");
}
