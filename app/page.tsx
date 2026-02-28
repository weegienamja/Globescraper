import Image from "next/image";
import Link from "next/link";
import { getPagesMeta } from "@/lib/content";
import { OrganizationJsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/site";
import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  const meta = getPagesMeta().index;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: "/",
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-default.png"],
    },
  };
}

/* ── Flag data ────────────────────────────────────────── */
const flags = [
  { code: "vn", label: "Vietnam", emoji: "\u{1F1FB}\u{1F1F3}" },
  { code: "th", label: "Thailand", emoji: "\u{1F1F9}\u{1F1ED}" },
  { code: "kh", label: "Cambodia", emoji: "\u{1F1F0}\u{1F1ED}" },
  { code: "ph", label: "Philippines", emoji: "\u{1F1F5}\u{1F1ED}" },
];

/* ── Quick-start cards ────────────────────────────────── */
const quickCards = [
  {
    icon: "\u{1F393}",
    title: "TEFL and TESOL Courses",
    bullets: [
      "Learn about the best accredited courses",
      "Compare prices, platforms, and referrals",
    ],
  },
  {
    icon: "\u{1F4DC}",
    title: "Visa and Work Permits",
    bullets: [
      "Find the right jobs, visas, and schools",
      "Prepare for daily life in your new city",
    ],
  },
  {
    icon: "\u{1F4CD}",
    title: "Jobs and School Tips",
    bullets: [
      "Hear from teachers already on the ground",
      "Get advice on salaries and negotiations",
    ],
  },
  {
    icon: "\u{1F69C}",
    title: "Living in SE Asia",
    bullets: [
      "Cost of living, housing, and healthcare",
      "Make friends and build your new routine",
    ],
  },
];

/* ── Guide cards ──────────────────────────────────────── */
const guideCards = [
  {
    title: "Moving Abroad",
    description:
      "Everything you need to plan your move, from visas and flights to housing and bank accounts. A practical, step-by-step checklist built for teachers heading to Southeast Asia.",
    image: "/1.png",
    alt: "Moving abroad guide for teaching English in Southeast Asia",
    href: "/blog",
  },
  {
    title: "Teaching Preparation",
    description:
      "Get TEFL certified, write a strong resume, and know what to expect in the classroom. Tips from experienced teachers who have done it before you.",
    image: "/2.png",
    alt: "Teaching preparation guide for English teachers abroad",
    href: "/how-it-works-to-teach-english",
  },
];

export default function HomePage() {
  /* ── ItemList schema — lists key content pages for carousel eligibility ── */
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "GlobeScraper Teaching Guides",
    description:
      "Practical guides for teaching English in Southeast Asia — visas, TEFL, jobs, costs, and daily life.",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog — Teaching English in Southeast Asia",
        url: `${siteConfig.url}/blog`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "How It Works to Teach English Abroad",
        url: `${siteConfig.url}/how-it-works-to-teach-english`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Community — Connect with Expat Teachers",
        url: `${siteConfig.url}/community`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Meetups — Teacher Events in Southeast Asia",
        url: `${siteConfig.url}/meetups`,
      },
      {
        "@type": "ListItem",
        position: 5,
        name: "About GlobeScraper",
        url: `${siteConfig.url}/about`,
      },
    ],
  };

  return (
    <main className="hp">
      <OrganizationJsonLd />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />

      {/* ── Hero ───────────────────────────────────── */}
      <section className="hp-hero">
        <div className="hp-hero__glow" aria-hidden="true" />
        <div className="hp-hero__inner">
          <div className="hp-hero__text">
            <h1 className="hp-hero__h1">
              Your Honest Guide to Teaching English in Southeast Asia
            </h1>
            <p className="hp-hero__sub">
              Clear, Real Advice on Visas, Jobs, Money and Everyday Life in
              Vietnam, Thailand, Cambodia and the Philippines.
            </p>

            <div className="hp-hero__ctas">
              <Link href="/blog" className="hp-hero__btn hp-hero__btn--primary">
                Read My Blogs
              </Link>
              <Link
                href="/how-it-works-to-teach-english"
                className="hp-hero__btn hp-hero__btn--secondary"
              >
                Start here: Beginner guide
              </Link>
            </div>

            <ul className="hp-hero__trust" aria-label="Trust indicators">
              <li className="hp-hero__trust-item">
                <span className="hp-hero__trust-icon" aria-hidden="true">
                  {"\u{1F465}"}
                </span>
                500+ readers
              </li>
              <li className="hp-hero__trust-item">
                <span className="hp-hero__trust-icon" aria-hidden="true">
                  {"\u2705"}
                </span>
                No degree needed
              </li>
              <li className="hp-hero__trust-item">
                <span className="hp-hero__trust-icon" aria-hidden="true">
                  {"\u{1F30F}"}
                </span>
                Built for SE Asia
              </li>
            </ul>
          </div>

          <div className="hp-hero__image">
            <Image
              src="/og-default.png"
              alt="Teaching English in Southeast Asia, backpacker arriving at a golden temple"
              width={720}
              height={480}
              priority
              className="hp-hero__img"
            />
          </div>
        </div>

        {/* Flag pills */}
        <div className="hp-hero__flags" aria-label="Countries covered">
          {flags.map((f) => (
            <span key={f.code} className="hp-hero__flag">
              <span aria-hidden="true">{f.emoji}</span> {f.label}
            </span>
          ))}
          <span className="hp-hero__flag hp-hero__flag--tagline">
            No Sign Ups. No Spam. Just Honest, Practical Guides
          </span>
        </div>
      </section>

      {/* ── Intro ──────────────────────────────────── */}
      <section className="hp-intro">
        <div className="hp-intro__inner">
          <div className="hp-intro__text">
            <h2 className="hp-intro__h2">
              Your Guide to Teaching in Southeast Asia
            </h2>
            <p>
              Want to teach English abroad? Start fresh in Vietnam, Thailand,
              Cambodia, or the Philippines with practical, no-nonsense tips from
              experienced expats. Whether you are from the UK, US, South Africa,
              or anywhere else, we will help you{" "}
              <strong>get started with confidence.</strong>
            </p>
            <p>
              Learn how to choose the right TEFL/TESOL course,{" "}
              <strong>understand visa requirements</strong>, find the best jobs,
              and prepare for life in cities like Ho Chi Minh City, Bangkok,
              Phnom Penh, or Manila.
            </p>
            <Link
              href="/how-it-works-to-teach-english"
              className="hp-intro__cta"
            >
              Read the Starter Guide
            </Link>
          </div>
          <div className="hp-intro__image">
            <Image
              src="/3.png"
              alt="Young teacher with backpack exploring a Southeast Asian city"
              width={560}
              height={560}
              className="hp-intro__img"
            />
          </div>
        </div>
      </section>

      {/* ── Quick Start Cards ──────────────────────── */}
      <section className="hp-quick">
        <h2 className="hp-quick__h2">
          {"\u{1F4E3}"} Want to teach English
          abroad?
        </h2>
        <p className="hp-quick__sub">
          Start fresh in Vietnam, Thailand, Cambodia, or the Philippines with
          practical, no-nonsense tips from experienced expats.
        </p>
        <div className="hp-quick__grid">
          {quickCards.map((card) => (
            <div key={card.title} className="hp-quick__card">
              <span className="hp-quick__icon" aria-hidden="true">
                {card.icon}
              </span>
              <h3 className="hp-quick__card-title">{card.title}</h3>
              <ul className="hp-quick__bullets">
                {card.bullets.map((b, i) => (
                  <li key={i}>
                    <span className="hp-quick__check" aria-hidden="true">
                      {"\u2713"}
                    </span>{" "}
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Guides ─────────────────────────────────── */}
      <section className="hp-guides">
        <h2 className="hp-guides__h2">Our Guides</h2>
        <div className="hp-guides__grid">
          {guideCards.map((g) => (
            <Link key={g.title} href={g.href} className="hp-guides__card">
              <div className="hp-guides__card-img-wrap">
                <Image
                  src={g.image}
                  alt={g.alt}
                  width={600}
                  height={340}
                  className="hp-guides__card-img"
                />
              </div>
              <div className="hp-guides__card-body">
                <h3 className="hp-guides__card-title">{g.title}</h3>
                <p className="hp-guides__card-desc">{g.description}</p>
                <span className="hp-guides__card-cta">Read this guide</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
