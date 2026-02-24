import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Require an authenticated session. Redirects to /login if not signed in.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Require an ADMIN role. Redirects to /login if unauthenticated,
 * returns 403-style redirect if authenticated but not an admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
