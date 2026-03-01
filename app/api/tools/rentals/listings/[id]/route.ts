/**
 * PATCH /api/tools/rentals/listings/[id]
 *
 * Update a listing — currently supports:
 *   { action: "deactivate" }   — mark listing inactive (hides from UI)
 *   { action: "activate" }     — re-activate a deactivated listing
 *   { action: "pass" }         — manual pass (creates 100% AI review)
 *   { propertyType: "HOUSE" }  — correct the property type
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PropertyType } from "@prisma/client";

const VALID_TYPES = new Set(Object.values(PropertyType));

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const listing = await prisma.rentalListing.findUnique({
    where: { id },
    select: { id: true, title: true, isActive: true, propertyType: true },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  // Action: deactivate / activate
  if (body.action === "deactivate") {
    updates.isActive = false;
    updates.manualOverride = true;
    changes.push("deactivated (manual override — scraper will skip)");
  } else if (body.action === "activate") {
    updates.isActive = true;
    updates.manualOverride = false;
    changes.push("activated (scraper will manage normally)");
  }

  // Correct property type
  if (body.propertyType && VALID_TYPES.has(body.propertyType)) {
    updates.propertyType = body.propertyType;
    changes.push(`type: ${listing.propertyType} → ${body.propertyType}`);
  }

  // Action: manual pass — create AI review at 100% confidence
  if (body.action === "pass") {
    await prisma.rentalAiReview.create({
      data: {
        listingId: id,
        suggestedType: listing.propertyType,
        isResidential: true,
        confidence: 1.0,
        reason: "Manual pass — confirmed by admin",
        flagged: false,
      },
    });
    return NextResponse.json({
      ok: true,
      changes: ["manually passed (100% confidence AI review created)"],
      listing,
    });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 });
  }

  const updated = await prisma.rentalListing.update({
    where: { id },
    data: updates,
    select: { id: true, title: true, isActive: true, propertyType: true },
  });

  return NextResponse.json({
    ok: true,
    changes,
    listing: updated,
  });
}
