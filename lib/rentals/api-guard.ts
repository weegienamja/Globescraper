/**
 * Shared API guard for admin-only rental pipeline endpoints.
 * Validates session and checks ADMIN role.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Returns the session if the user is an ADMIN, otherwise a 403 response.
 * Usage: const session = await requireAdminApi(); if (session instanceof NextResponse) return session;
 */
export async function requireAdminApi() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}
