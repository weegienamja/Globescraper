import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Unsubscribe" };
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.length < 10) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, emailUnsubscribed: true },
  });

  if (!user) {
    notFound();
  }

  // Unsubscribe the user
  if (!user.emailUnsubscribed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailUnsubscribed: true },
    });
  }

  // Mask the email for privacy
  const [local, domain] = user.email.split("@");
  const masked = `${local[0]}***@${domain}`;

  return (
    <div className="unsubscribe-page">
      <div className="unsubscribe-card">
        <div className="unsubscribe-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3Z" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>
        <h1 className="unsubscribe-title">You have been unsubscribed</h1>
        <p className="unsubscribe-text">
          <strong>{masked}</strong> will no longer receive marketing emails from Globescraper.
        </p>
        <p className="unsubscribe-text unsubscribe-text--muted">
          You will still receive essential account-related emails (e.g. password resets).
        </p>
        <Link href="/" className="btn btn--primary btn--sm" style={{ marginTop: "1.5rem" }}>
          Return to Globescraper
        </Link>
      </div>
    </div>
  );
}
