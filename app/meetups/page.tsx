import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meetups",
  description: "Browse and join community meetups for teachers in Southeast Asia.",
};

export default async function MeetupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/meetups");

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
