import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRY_LABELS } from "@/lib/validations/profile";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    include: { targetCountries: true },
  });

  // If no profile yet, redirect to complete it
  if (!profile) {
    redirect("/create-profile");
  }

  const countries = profile.targetCountries
    .map((tc) => COUNTRY_LABELS[tc.country as keyof typeof COUNTRY_LABELS])
    .join(", ");

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 40 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Welcome, {session.user.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
        Your profile is complete. We&apos;ll match you with opportunities in:{" "}
        <strong style={{ color: "var(--text)" }}>{countries}</strong>
      </p>

      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius)",
          padding: 24,
          border: "1px solid var(--border)",
        }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 16 }}>What&apos;s Next</h2>
        <ul style={{ lineHeight: 1.8, paddingLeft: 20 }}>
          <li>We&apos;re building curated job matches for your profile.</li>
          <li>You&apos;ll receive email alerts when new positions open.</li>
          <li>Check back soon for your personalised dashboard.</li>
        </ul>
      </div>
    </div>
  );
}
