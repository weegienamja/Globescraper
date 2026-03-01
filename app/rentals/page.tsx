import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { RentalResultsList } from "@/components/rentals/RentalResultsList";
import { RentalFilters } from "@/components/rentals/RentalFilters";
import { Pagination } from "@/components/rentals/Pagination";
import {
  buildRentalsWhere,
  buildRentalsOrderBy,
  buildFilterSummary,
  buildPaginationHref,
  type RentalSearchParams,
} from "@/lib/rentalsQuery";
import "./rentals.css";

export const metadata: Metadata = {
  title: "Properties to Rent",
  description:
    "Browse rental properties in Cambodia. Apartments, condos, houses and more.",
};

const PER_PAGE = 7;

interface Props {
  searchParams: Promise<RentalSearchParams>;
}

export default async function RentalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = buildRentalsWhere(sp);
  const orderBy = buildRentalsOrderBy(sp.sort);

  // Fetch listings, total count, and distinct city / district values in parallel.
  // Districts are scoped to the selected city when one is chosen.
  const [listings, total, cities, districts] = await Promise.all([
    prisma.rentalListing.findMany({
      where,
      select: {
        id: true,
        title: true,
        titleRewritten: true,
        city: true,
        district: true,
        propertyType: true,
        bedrooms: true,
        bathrooms: true,
        sizeSqm: true,
        priceMonthlyUsd: true,
        imageUrlsJson: true,
        description: true,
        descriptionRewritten: true,
        postedAt: true,
        firstSeenAt: true,
      },
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.rentalListing.count({ where }),
    // All distinct cities (active listings only)
    prisma.rentalListing
      .findMany({
        where: { isActive: true, NOT: { city: "" } },
        select: { city: true },
        distinct: ["city"],
        orderBy: { city: "asc" },
      })
      .then((rows) => rows.map((r) => r.city).filter((c): c is string => !!c)),
    // Distinct districts, optionally scoped to the selected city
    prisma.rentalListing
      .findMany({
        where: {
          isActive: true,
          NOT: { district: "" },
          ...(sp.city ? { city: sp.city } : {}),
        },
        select: { district: true },
        distinct: ["district"],
        orderBy: { district: "asc" },
      })
      .then((rows) =>
        rows.map((r) => r.district).filter((d): d is string => !!d),
      ),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filterSummary = buildFilterSummary(sp, total);

  // Pagination href builder preserves all active query params
  function buildHref(p: number): string {
    return buildPaginationHref(sp, p);
  }

  return (
    <main className="rentals-page">
      <header className="rentals-page__header">
        <h1 className="rentals-page__title">Properties to Rent</h1>
        <p className="rentals-page__count">{filterSummary}</p>
      </header>

      <Suspense fallback={null}>
        <RentalFilters cities={cities} districts={districts} />
      </Suspense>

      <RentalResultsList listings={listings} />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        buildHref={buildHref}
      />
    </main>
  );
}
