"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { BlogCardTracker } from "@/components/BlogCardTracker";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readingTime: number;
  heroImageUrl?: string | null;
}

const CATEGORIES = [
  "All",
  "Teaching",
  "Visas",
  "Safety",
  "Airports",
  "Healthcare",
  "Digital Nomad",
  "Travel",
  "Border News",
  "Rentals",
];

type SortKey = "newest" | "oldest";

export function BlogPageClient({ posts }: { posts: BlogPost[] }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    let result = posts;

    if (activeCategory !== "All") {
      result = result.filter((p) => p.category === activeCategory);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) =>
      sort === "newest"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    );

    return result;
  }, [posts, activeCategory, search, sort]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  // Popular posts: newest 5 from full list (TODO: use view count when available)
  const popular = useMemo(() => {
    return [...posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [posts]);

  return (
    <div className="blog-layout">
      {/* Main column */}
      <div className="blog-main">
        {/* Category chips */}
        <div className="blog-controls">
          <div className="blog-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={
                  "blog-chip" + (activeCategory === cat ? " blog-chip--active" : "")
                }
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="blog-controls__right">
            <div className="blog-search-wrap">
              <svg
                className="blog-search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search blog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="blog-search"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="blog-sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        {/* Featured post */}
        {featured && (
          <BlogCardTracker slug={featured.slug}>
            <Link
              href={`/${featured.slug}`}
              className="blog-featured"
            >
              <div className="blog-featured__image-wrap">
                <Image
                  src={featured.heroImageUrl || "/7.png"}
                  alt={cleanTitle(featured.title)}
                  width={640}
                  height={340}
                  className="blog-featured__image"
                  unoptimized
                />
              </div>
              <div className="blog-featured__body">
                <span className="blog-meta">
                  {featured.date} &middot; {featured.readingTime} min read
                </span>
                <h2 className="blog-featured__title">{cleanTitle(featured.title)}</h2>
                <div className="blog-featured__tags">
                  <span className="blog-badge blog-badge--cat">{featured.category}</span>
                  {extractTags(featured.title, featured.description).map((t) => (
                    <span key={t} className="blog-badge">#{t}</span>
                  ))}
                </div>
                <p className="blog-featured__excerpt">{featured.description}</p>
                {extractTags(featured.title, featured.description).length > 0 && (
                  <div className="blog-featured__bottom-tags">
                    {extractTags(featured.title, featured.description).map((t) => (
                      <span key={t} className="blog-badge blog-badge--outline">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          </BlogCardTracker>
        )}

        {/* Post list */}
        <div className="blog-list">
          {rest.map((p) => (
            <BlogCardTracker key={p.slug} slug={p.slug}>
              <Link href={`/${p.slug}`} className="blog-card">
                <div className="blog-card__image-wrap">
                  <Image
                    src={p.heroImageUrl || "/7.png"}
                    alt={cleanTitle(p.title)}
                    width={160}
                    height={100}
                    className="blog-card__image"
                    unoptimized
                  />
                </div>
                <div className="blog-card__body">
                  <span className="blog-meta">
                    {p.date} &middot; {p.readingTime} min read
                  </span>
                  <h2 className="blog-card__title">{cleanTitle(p.title)}</h2>
                  <p className="blog-card__excerpt">{p.description}</p>
                  <div className="blog-card__tags">
                    <span className="blog-badge blog-badge--cat">{p.category}</span>
                    {extractTags(p.title, p.description).map((t) => (
                      <span key={t} className="blog-badge">#{t}</span>
                    ))}
                  </div>
                </div>
              </Link>
            </BlogCardTracker>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 0" }}>
            No posts found matching your criteria.
          </p>
        )}
      </div>

      {/* Sidebar */}
      <aside className="blog-sidebar">
        {/* Popular Posts */}
        <div className="blog-sidebar__card">
          <h3 className="blog-sidebar__heading">Popular Posts</h3>
          <div className="blog-sidebar__list">
            {popular.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="blog-sidebar__item">
                <div className="blog-sidebar__thumb-wrap">
                  <Image
                    src={p.heroImageUrl || "/7.png"}
                    alt={cleanTitle(p.title)}
                    width={64}
                    height={64}
                    className="blog-sidebar__thumb"
                    unoptimized
                  />
                </div>
                <div className="blog-sidebar__item-body">
                  <span className="blog-sidebar__item-title">{cleanTitle(p.title)}</span>
                  <span className="blog-sidebar__item-meta">
                    {p.date} &middot; {p.readingTime} min read
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Start Here CTA */}
        <div className="blog-sidebar__card blog-sidebar__cta">
          <h3 className="blog-sidebar__heading">New to Cambodia?</h3>
          <p className="blog-sidebar__cta-highlight">Start Here</p>
          <p className="blog-sidebar__cta-text">
            Practical tips and essential guides for expats.
          </p>
          <Link href="/how-it-works-to-teach-english" className="blog-sidebar__cta-btn">
            See Starter Guides
          </Link>
        </div>
      </aside>
    </div>
  );
}

/* Utilities */

function cleanTitle(title: string): string {
  return title.replace(/\s*\|\s*GlobeScraper\s*$/, "");
}

/** Extract hashtag-like words from title/description for badge display */
function extractTags(title: string, desc: string): string[] {
  const combined = (title + " " + desc).toLowerCase();
  const tags: string[] = [];
  const knownTags: [string, RegExp][] = [
    ["TEFL", /tefl/i],
    ["PhnomPenh", /phnom\s?penh/i],
    ["Visa", /visa/i],
    ["Airport", /airport/i],
    ["Kave", /kave/i],
    ["travel", /travel/i],
  ];
  for (const [label, re] of knownTags) {
    if (re.test(combined) && tags.length < 3) {
      tags.push(label);
    }
  }
  return tags;
}
