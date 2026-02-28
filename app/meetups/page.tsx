import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teacher Meetups in Southeast Asia",
  description: "Find and join meetups for English teachers across Cambodia, Vietnam, Thailand, and the Philippines. Grab coffee, explore cities, and make friends.",
  alternates: { canonical: "/meetups" },
  openGraph: {
    title: "Teacher Meetups in Southeast Asia",
    description: "Find and join meetups for English teachers across Cambodia, Vietnam, Thailand, and the Philippines.",
    url: "/meetups",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "Teacher Meetups in Southeast Asia",
    description: "Find and join meetups for English teachers across Cambodia, Vietnam, Thailand, and the Philippines.",
    images: ["/og-default.png"],
  },
};

/* ── Invite page for logged-out visitors ──────────────────── */
function MeetupsInvite() {
  return (
    <div className="invite-page">
      <div className="invite-hero">
        <span className="invite-hero__emoji">📅</span>
        <h1 className="invite-hero__title">Teacher Meetups</h1>
        <p className="invite-hero__sub">
          Grab coffee, explore a new city, or swap teaching stories. Join meetups
          organised by teachers across Southeast Asia.
        </p>
        <div className="invite-hero__cta">
          <Link href="/signup?callbackUrl=/meetups" className="btn btn--primary">
            Create a free account
          </Link>
          <Link href="/login?callbackUrl=/meetups" className="btn btn--outline">
            Sign in
          </Link>
        </div>
      </div>

      <div className="invite-features">
        <div className="invite-feature">
          <span className="invite-feature__icon">🗓️</span>
          <h3 className="invite-feature__title">Browse Upcoming Events</h3>
          <p className="invite-feature__text">
            See what&apos;s happening in your area. Filter by country or city to find
            meetups near you.
          </p>
        </div>
        <div className="invite-feature">
          <span className="invite-feature__icon">🙋</span>
          <h3 className="invite-feature__title">RSVP &amp; Attend</h3>
          <p className="invite-feature__text">
            Mark yourself as going or interested. See who else is attending and
            connect before the event.
          </p>
        </div>
        <div className="invite-feature">
          <span className="invite-feature__icon">✨</span>
          <h3 className="invite-feature__title">Create Your Own</h3>
          <p className="invite-feature__text">
            Hosting a coffee morning or weekend trip? Create a meetup in seconds and
            invite the community.
          </p>
        </div>
      </div>

      <div className="invite-bottom">
        <p className="invite-bottom__text">
          Already have an account?{" "}
          <Link href="/login?callbackUrl=/meetups">Sign in</Link> to browse meetups.
        </p>
      </div>
    </div>
  );
}

export default async function MeetupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return <MeetupsInvite />;

  const params = await searchParams;
  const countryFilter = typeof params.country === "string" ? params.country : "";
  const cityFilter = typeof params.city === "string" ? params.city : "";

  // Build where clause
  const where: Record<string, unknown> = {
    status: "ACTIVE",
    dateTime: { gte: new Date() },
  };

  if (countryFilter) where.country = countryFilter;
  if (cityFilter) where.city = { contains: cityFilter };

  const meetups = await prisma.meetup.findMany({
    where,
    orderBy: { dateTime: "asc" },
    take: 50,
    include: {
      createdBy: {
        select: {
          profile: { select: { displayName: true } },
        },
      },
      _count: {
        select: {
          attendees: { where: { status: { in: ["GOING", "INTERESTED"] } } },
        },
      },
    },
  });

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="meetup-page">
      <div className="meetup-page__header">
        <h1>Meetups</h1>
        <p className="meetup-page__sub">Community meetups for teachers across Southeast Asia.</p>
        <Link href="/meetups/new" className="btn btn--primary btn--sm">
          Create a meetup
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" action="/meetups" className="community-filters">
        <select name="country" defaultValue={countryFilter} className="form__input form__input--sm">
          <option value="">All countries</option>
          {COMMUNITY_COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          name="city"
          type="text"
          placeholder="City..."
          defaultValue={cityFilter}
          className="form__input form__input--sm"
        />

        <button type="submit" className="btn btn--primary btn--sm">
          Search
        </button>
      </form>

      {/* Results */}
      {meetups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📅</div>
          <p className="empty-state__title">No upcoming meetups</p>
          <p className="empty-state__text">
            Be the first to <Link href="/meetups/new">create one</Link>!
          </p>
        </div>
      ) : (
        <div className="meetup-grid">
          {meetups.map((m) => (
            <Link key={m.id} href={`/meetups/${m.id}`} className="meetup-card">
              <h3 className="meetup-card__title">{m.title}</h3>
              <p className="meetup-card__meta">
                📍 {m.city}, {m.country}
              </p>
              <p className="meetup-card__meta">
                📅 {fmtDate(m.dateTime)}
              </p>
              {m.locationHint && (
                <p className="meetup-card__hint">Near: {m.locationHint}</p>
              )}
              <div className="meetup-card__footer">
                <span className="meetup-card__attendees">
                  {m._count.attendees} {m._count.attendees === 1 ? "person" : "people"} going
                  {m.maxAttendees ? ` / ${m.maxAttendees} max` : ""}
                </span>
                <span className="meetup-card__host">
                  By {m.createdBy.profile?.displayName ?? "Unknown"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
