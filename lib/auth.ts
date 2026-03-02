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

/**
 * Require teacher or student role for community social features.
 */
export async function requireCommunityMember() {
  const session = await requireAuth();
  const role = session.user.role;
  if (role !== "TEACHER" && role !== "STUDENT") {
    redirect("/community");
  }
  return session;
}

/**
 * Require recruiter role.
 */
export async function requireRecruiter() {
  const session = await requireAuth();
  if (session.user.role !== "RECRUITER") {
    redirect("/");
  }
  return session;
}
