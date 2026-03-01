# GlobeScraper

**The all-in-one platform for English teachers relocating to Southeast Asia** -- guides, community, meetups, rental marketplace, and AI-powered content.

Live at [globescraper.com](https://globescraper.com)

---

## Overview

GlobeScraper is a full-stack content, community, and data platform built with Next.js 14 (App Router). It started as a migration from a website builder to gain full control over SEO, lead capture, and scalability -- and has since grown into a multi-feature hub combining community networking, an AI blog engine, an email campaign system, and a large-scale rental property marketplace powered by a custom scraping pipeline.

### Key Features

| Area | What it does |
|---|---|
| **Content & Blog** | Static pages + AI-generated articles with server-rendered HTML, automatic `sitemap.xml` and `robots.txt`, Open Graph meta, JSON-LD structured data, SEO auditing |
| **AI Content Generator** | End-to-end article pipeline: competitor research, gap analysis, Gemini 3 Flash generation, AI image creation (Imagen 4.0), auto-publish with SEO scoring |
| **AI News Generator** | Multi-strategy topic discovery, coverage gap analysis, source grounding from 30+ trusted outlets, topic rotation to avoid duplication |
| **Lead Capture** | `POST /api/lead` endpoint with Zod validation, admin CRM with status tracking |
| **Auth** | Auth.js v5 (NextAuth) with Google OAuth + credentials, JWT sessions, bcrypt hashing, rate-limited login |
| **Community Profiles** | Public/members-only/private profiles with location, bio, target countries, meetup intent tags, gallery, trust panels |
| **Connections & DMs** | Send/accept/decline connections (rate-limited), 1-on-1 direct messaging with read receipts and unread counts |
| **Meetups** | Create and browse meetups filtered by country/city, RSVP (Going/Interested), capacity limits |
| **Rental Marketplace** | Public search with filters (city, district, beds, type, price, sort), pagination, detail pages, image carousels, saved listings |
| **Rental Data Pipeline** | Multi-source scraper (7 sources, 6 active) with parallel workers, atomic queue claiming, AI-powered listing review and description rewriting |
| **Rental Analytics** | Interactive heatmap (Leaflet + GeoJSON), daily/monthly price indices, KPI cards, trend charts, volatility analysis, top movers |
| **Email Campaigns** | Block-based template system, AI content generation, Resend integration, subscriber management, webhook tracking, scheduled delivery |
| **Safety & Moderation** | Block users, report users/meetups, admin tools to disable accounts, cancel meetups, dismiss reports |
| **Admin Dashboard** | KPI metrics (13 cards), user management, lead CRM, audit log, IP blocking, report queue, blog management, pipeline controls |
| **Dark/Light Theme** | CSS custom-property design system with `[data-theme]` toggle -- no Tailwind |
| **Security** | HSTS, CSP, X-Frame-Options, rate limiting (Redis), input validation (Zod), HTML sanitization (DOMPurify) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router, Server Components, Server Actions) |
| Language | TypeScript 5.5 |
| Database | MySQL via [Prisma](https://www.prisma.io/) 5.18 (30+ models, 970-line schema) |
| Auth | [Auth.js v5](https://authjs.dev/) (NextAuth) -- JWT strategy, Google OAuth + Credentials |
| AI | Google Gemini 3 Flash Preview (articles), Imagen 4.0 (images), Serper.dev (research) |
| Rate Limiting | [Upstash Redis](https://upstash.com/) -- sliding-window limiters for login, connections, DMs |
| Email | [Resend](https://resend.com/) -- transactional + campaign delivery with webhook tracking |
| Validation | [Zod](https://zod.dev/) 3.23 |
| Scraping | Cheerio (HTML parsing), Undici (HTTP + proxy), Playwright (Cloudflare bypass) |
| Maps | Leaflet + React-Leaflet with custom GeoJSON (300+ Cambodia district boundaries) |
| Markdown | react-markdown + remark-gfm + rehype-raw/sanitize |
| File Storage | Vercel Blob |
| Styling | Vanilla CSS with custom properties (dark/light themes, BEM naming) |
| Deployment | Vercel (with cron jobs, Speed Insights) |
| Testing | Vitest, Playwright |

---

## Project Structure

```
app/
  page.tsx                        # Homepage
  blog/                           # Blog index (static + AI posts, category filters)
  [slug]/                         # Dynamic blog posts + static pages
  about/                          # About page
  how-it-works-to-teach-english/  # Guide page
  rentals/                        # Rental listings search + filters
    [id]/                         # Listing detail page
    heatmap/                      # Public interactive heatmap
    heatmap/embed/                # Embeddable heatmap (iframe-friendly)
  community/                      # Community directory
    [userId]/                     # Public profile view + actions
    edit-profile/                 # Edit community profile
  meetups/                        # Browse upcoming meetups
    new/                          # Create meetup
    [id]/                         # Meetup detail + RSVP
  dashboard/                      # User dashboard
    messages/                     # DM inbox + conversation threads
    requests/                     # Connection request management
  admin/                          # Admin dashboard + management
    blog/                         # Blog post management
    content-generator/            # AI article generator
    email/                        # Email campaign dashboard
  tools/                          # Admin tools hub
    rentals/                      # Rental pipeline dashboard + analytics
  login/ signup/ create-profile/  # Auth flows
  api/                            # 55 REST API endpoints
    auth/ signup/ lead/ profile/ connections/ messages/ health/
    admin/                        # Users, leads, audit, IPs, blog, content-generator, email
    tools/rentals/                # Pipeline control, listings CRUD, analytics, heatmap data
    webhooks/resend/              # Email delivery tracking

components/
  SiteLayout.tsx                  # Header, footer, nav, avatar dropdown
  community/                      # Profile cards, activity feed, trust panel
  rentals/                        # Filters, result cards, image carousel, gallery, heatmap
  analytics/                      # KPI cards, trend charts, volatility, distribution
  tools/                          # Pipeline dashboard, listings table, job runs, log viewer
  admin/                          # Hero editor, post toolbar, image manager

lib/
  prisma.ts                       # Singleton PrismaClient
  auth.ts                         # requireAuth() / requireAdmin() guards
  security.ts                     # IP blocking, security event logging
  rate-limit.ts                   # Upstash Redis limiters (login, connections, DMs)
  connections.ts                  # Canonical connection helpers
  content.ts                      # Static HTML content pipeline
  analytics.ts                    # GA4 typed event helpers
  ai/                             # Gemini client, prompts, image generation
  scrape/                         # Competitor research, content discovery, fact extraction
  news/                           # Topic discovery, coverage analysis, title similarity
  email/                          # Resend client, block-based templates, AI generation
  rentals/                        # Scraper config, HTTP client, sources, jobs, parsing, GeoJSON
  validations/                    # Zod schemas for all user input

prisma/
  schema.prisma                   # 30+ models, 20+ enums, 970 lines
  migrations/                     # Database migrations

scripts/                          # 45+ CLI tools
  realestate-daily.ts             # Daily new-listing scraper (5-15 min)
  realestate-weekly.ts            # Weekly full scrape (2-6 hours, parallel workers)
  scrape-realestate-full.ts       # Full discovery scraper (40 query sets)
  scrape-all-sources.ts           # Multi-source parallel launcher
  ai-review-listings.ts           # Gemini AI listing classification
  ai-rewrite-descriptions.ts     # Gemini AI description rewriting
  backfill-*.ts                   # Data backfill scripts (amenities, districts, titles)
  fix-*.ts                        # Data cleaning scripts

content/                          # Static HTML content + JSON manifests
data/                             # Cambodia GeoJSON boundaries (adm2 + adm3)
public/geo/                       # Processed GeoJSON for heatmap
tests/                            # Vitest test suites
types/                            # TypeScript type augmentations
```

---

## Rental Data Pipeline

A multi-source scraping and analytics system for Cambodian rental properties.

### Sources (7 adapters, 6 active)

| Source | Method | Notes |
|---|---|---|
| Realestate.com.kh | JSON API | 5 categories, 40 query sets, ~35k listings |
| Khmer24 | Playwright | Cloudflare WAF bypass, headless Chromium |
| IPS Cambodia | HTTP/Cheerio | Pagination scraping |
| CamRealty | HTTP/Cheerio | WordPress site |
| LongTermLettings | HTTP/Cheerio | Small site |
| FazWaz | HTTP/Cheerio | Sangkat-level location data |
| HomeToGo | Disabled | GBP pricing, poor fit |

### Pipeline Jobs

1. **Discover** -- Crawl category pages, extract listing URLs, enqueue in ScrapeQueue
2. **ProcessQueue** -- Atomic claiming (SQL UPDATE...LIMIT), fetch + parse listings, upsert with content fingerprinting, reverse-geocoded titles
3. **BuildIndex** -- Daily price aggregation (median, mean, p25, p75 by city/district/beds/type)
4. **MarkStaleListings** -- Deactivate listings not seen in 7+ days

### AI Enhancements

- **AI Review** (Gemini) -- Batch classification: residential vs non-residential, property type correction, confidence scoring
- **AI Rewrite** (Gemini) -- Standardize descriptions to professional English

### Parallel Workers

- `--workers N` flag spawns N child processes with atomic queue claiming
- Each worker independently claims and processes batches
- Human-like pacing: jittered delays, random breathers, night idle simulation

---

## AI Blog Generator

End-to-end article generation using Gemini 3 Flash Preview:

1. **Research** -- Competitor URL discovery (Serper.dev), outline extraction, gap analysis
2. **Generate** -- Structured prompts with style rules, depth instructions, JSON output
3. **Images** -- Imagen 4.0 (hero/OG/inline), real photos via Google Image Search for landmarks
4. **Publish** -- Auto-slug, SEO scoring, revision tracking, admin review workflow

### News Articles

- Multi-strategy topic discovery with priority-ordered search
- Coverage gap analysis against existing posts (46 intent vocabulary terms)
- Deterministic topic rotation (15 gap categories)
- Near-duplicate detection (Jaccard + bigram similarity)
- Source grounding from 30+ trusted outlets (government, news, expat community)

---

## Email System

- **Block-based templates** (9 block types: Hero, CTA, FeatureGrid, TipsBox, AlertBanner, etc.)
- **5 template presets** (Welcome, News Alert, Weekly Digest, Visa Update, New Places)
- **AI generation** via Gemini for email content
- **Resend integration** with webhook tracking (delivery, bounces, opens, clicks)
- **Scheduled delivery** via Vercel cron (daily at 08:00 UTC)

---

## Getting Started

### Prerequisites

- Node.js 18.17+
- MySQL 5.7+ (or MariaDB 10.3+)
- Upstash Redis account (for rate limiting)

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
SHADOW_DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/SHADOW_DATABASE"
AUTH_SECRET="generate-with-openssl-rand-base64-33"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
GEMINI_API_KEY="your-gemini-api-key"
SERPER_API_KEY="your-serper-api-key"
RESEND_API_KEY="your-resend-api-key"
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"
```

### Installation

```bash
npm install
npx prisma migrate dev
npm run seed:admin      # Optional: create admin user
npm run dev
```

### Build & Deploy

```bash
npm run build    # prisma generate + migrate deploy + next build
npm run start    # Start production server
```

### Scraper Usage

```bash
# Daily new listings (fast, 5-15 min)
npx tsx scripts/realestate-daily.ts

# Weekly full scrape with parallel workers (2-6 hours)
npx tsx scripts/realestate-weekly.ts --workers 3

# Process queued items only
npx tsx scripts/realestate-weekly.ts --workers 3 --process-only

# All sources in parallel
npx tsx scripts/scrape-all-sources.ts --workers 2

# AI review + rewrite
npx tsx scripts/ai-review-listings.ts
npx tsx scripts/ai-rewrite-descriptions.ts
```

---

## API Endpoints (55 total)

| Category | Count | Examples |
|---|---|---|
| Auth | 2 | `/api/auth/[...nextauth]`, `/api/signup` |
| User | 5 | `/api/profile`, `/api/connections`, `/api/messages` |
| Admin - Users | 6 | `/api/admin/users`, `/api/admin/audit-log`, `/api/admin/blocked-ips` |
| Admin - Blog | 8 | `/api/admin/blog/[id]`, `/api/admin/blog/[id]/seo-check` |
| Admin - Content | 7 | `/api/admin/content-generator/generate`, `/api/admin/content-generator/news/*` |
| Admin - Email | 9 | `/api/admin/email/campaigns`, `/api/admin/email/send-campaign` |
| Rentals | 14 | `/api/tools/rentals/discover`, `/api/tools/rentals/listings`, `/api/tools/rentals/heatmap-data` |
| Infrastructure | 4 | `/api/health`, `/api/heartbeat`, `/api/webhooks/resend` |

---

## Security

- **Password hashing** -- bcryptjs with cost factor 12
- **Rate limiting** -- Login (5/15min), connections (10/24h), DMs (30/min) via Upstash Redis
- **Input validation** -- Zod schemas on all user input, server-side
- **HTML sanitization** -- DOMPurify on rendered content
- **Auth middleware** -- Edge cookie guard + server-side JWT decode + role-based guards
- **Security headers** -- HSTS, X-Frame-Options DENY, CSP, XSS protection, Permissions-Policy
- **IP blocking** -- Admin-managed with optional expiration
- **Audit trail** -- All admin actions logged with before/after state diffs
- **User blocking** -- Bidirectional exclusion from all social features

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Prisma generate + migrate + Next.js build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:admin` | Seed an admin user |

---

## License

Private -- not open-source.
