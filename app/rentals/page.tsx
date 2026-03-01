import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { RentalResultsList } from "@/components/rentals/RentalResultsList";
import { RentalFilters } from "@/components/rentals/RentalFilters";
import { Pagination } from "@/components/rentals/Pagination";
import type { Prisma } from "@prisma/client";
import "./rentals.css";

export const metadata: Metadata = {
  title: "Properties to Rent",
  description: "Browse rental properties in Cambodia. Apartments, condos, houses and more.",
};

const PER_PAGE = 7;

interface Props {
  searchParams: Promise<{
    page?: string;
    city?: string;
    district?: string;
    min?: string;
    max?: string;
    type?: string;
    beds?: string;
  }>;
}

export default async function RentalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = buildWhere(sp);
  const [listings, total] = await Promise.all([
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
        priceMonthlyUsd: true,
        imageUrlsJson: true,
        description: true,
        descriptionRewritten: true,
        postedAt: true,
        firstSeenAt: true,
      },
      orderBy: [{ lastSeenAt: "desc" }, { firstSeenAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.rentalListing.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filterSummary = buildFilterSummary(sp, total);

  function buildHref(p: number): string {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (sp.city) params.set("city", sp.city);
    if (sp.district) params.set("district", sp.district);
    if (sp.type) params.set("type", sp.type);
    if (sp.beds) params.set("beds", sp.beds);
    if (sp.min) params.set("min", sp.min);
    if (sp.max) params.set("max", sp.max);
    return `/rentals?${params.toString()}`;
  }

  return (
    <main className="rentals-page">
      <header className="rentals-page__header">
        <h1 className="rentals-page__title">Properties to Rent</h1>
        <p className="rentals-page__count">{filterSummary}</p>
      </header>

      <Suspense fallback={null}>
        <RentalFilters />
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

/* ── Helpers ─────────────────────────────────────────────── */

function buildWhere(sp: {
  city?: string;
  district?: string;
  min?: string;
  max?: string;
  type?: string;
  beds?: string;
}): Prisma.RentalListingWhereInput {
  const where: Prisma.RentalListingWhereInput = { isActive: true };

  if (sp.city) {
    where.city = { contains: sp.city };
  }
  if (sp.district) {
    where.district = { contains: sp.district };
  }
  if (sp.type) {
    where.propertyType = sp.type as Prisma.RentalListingWhereInput["propertyType"];
  }
  if (sp.beds) {
    const n = parseInt(sp.beds, 10);
    if (!isNaN(n)) where.bedrooms = { gte: n };
  }

  const minPrice = sp.min ? parseFloat(sp.min) : null;
  const maxPrice = sp.max ? parseFloat(sp.max) : null;
  if (minPrice != null || maxPrice != null) {
    where.priceMonthlyUsd = {};
    if (minPrice != null) where.priceMonthlyUsd.gte = minPrice;
    if (maxPrice != null) where.priceMonthlyUsd.lte = maxPrice;
  }

  return where;
}

function buildFilterSummary(
  sp: { city?: string; district?: string; type?: string },
  total: number,
): string {
  const parts: string[] = [];
  if (sp.city) parts.push(sp.city);
  if (sp.district) parts.push(sp.district);
  if (sp.type) parts.push(sp.type.replace(/_/g, " ").toLowerCase());
  const suffix = parts.length > 0 ? ` in ${parts.join(", ")}` : "";
  return `${total.toLocaleString()} result${total !== 1 ? "s" : ""}${suffix}`;
}
