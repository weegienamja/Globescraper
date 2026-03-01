"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PROPERTY_TYPES = [
  { value: "", label: "All types" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "CONDO", label: "Condo" },
  { value: "SERVICED_APARTMENT", label: "Serviced Apt" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "HOUSE", label: "House" },
  { value: "VILLA", label: "Villa" },
  { value: "TOWNHOUSE", label: "Townhouse" },
];

export function RentalFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const apply = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.set("page", "1"); // reset page on filter change
      router.push(`/rentals?${params.toString()}`);
    },
    [router, sp],
  );

  return (
    <form
      className="rentals-filters"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({
          city: (fd.get("city") as string) || "",
          district: (fd.get("district") as string) || "",
          type: (fd.get("type") as string) || "",
          beds: (fd.get("beds") as string) || "",
          min: (fd.get("min") as string) || "",
          max: (fd.get("max") as string) || "",
        });
      }}
    >
      <input
        name="city"
        className="rentals-filters__input"
        placeholder="City"
        defaultValue={sp.get("city") ?? ""}
        aria-label="Filter by city"
      />
      <input
        name="district"
        className="rentals-filters__input"
        placeholder="District"
        defaultValue={sp.get("district") ?? ""}
        aria-label="Filter by district"
      />
      <select
        name="type"
        className="rentals-filters__select"
        defaultValue={sp.get("type") ?? ""}
        aria-label="Filter by property type"
      >
        {PROPERTY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        name="beds"
        type="number"
        min="0"
        className="rentals-filters__input"
        placeholder="Beds"
        defaultValue={sp.get("beds") ?? ""}
        style={{ width: 70, minWidth: 70 }}
        aria-label="Minimum bedrooms"
      />
      <input
        name="min"
        type="number"
        min="0"
        className="rentals-filters__input"
        placeholder="Min $"
        defaultValue={sp.get("min") ?? ""}
        style={{ width: 80, minWidth: 80 }}
        aria-label="Minimum price"
      />
      <input
        name="max"
        type="number"
        min="0"
        className="rentals-filters__input"
        placeholder="Max $"
        defaultValue={sp.get("max") ?? ""}
        style={{ width: 80, minWidth: 80 }}
        aria-label="Maximum price"
      />
      <button type="submit" className="rentals-filters__btn" aria-label="Apply filters">
        Search
      </button>
    </form>
  );
}
