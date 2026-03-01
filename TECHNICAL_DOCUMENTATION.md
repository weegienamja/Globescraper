# GlobeScraper -- Technical Documentation

> **Last updated:** 1 March 2026
> **Repository:** `weegienamja/Globescraper` -- branch `main`

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Folder & Module Structure](#2-folder--module-structure)
3. [Data Flow](#3-data-flow)
4. [Core Features](#4-core-features)
5. [Rental Data Pipeline](#5-rental-data-pipeline)
6. [AI Blog Generator](#6-ai-blog-generator)
7. [Email System](#7-email-system)
8. [Database Schema](#8-database-schema)
9. [API Routes](#9-api-routes)
10. [Security Overview](#10-security-overview)
11. [External Integrations](#11-external-integrations)
12. [CLI Scripts](#12-cli-scripts)
13. [Potential Risks & Technical Debt](#13-potential-risks--technical-debt)
14. [Suggested Improvements](#14-suggested-improvements)

---

## 1. High-Level Architecture

### 1.1 Frontend Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 14.2.5 |
| **Language** | TypeScript | 5.5.4 |
| **UI library** | React | 18.3.1 |
| **Styling** | Global CSS with BEM class naming | -- |
| **State** | React Server Components + `useState`/`useTransition` for client interactivity | -- |
| **Session client** | `next-auth/react` `<SessionProvider>` | 5.0.0-beta.30 |
| **Schema validation** | Zod (shared client + server) | 3.23.8 |
| **Theming** | Dark/light mode via inline `<script>` (FOUC prevention) + `data-theme` attribute | -- |
| **Analytics** | Google Analytics 4 via global site tag + typed event helpers | -- |
| **Maps** | Leaflet + React-Leaflet with custom GeoJSON | 1.9.4 |
| **Markdown** | react-markdown + remark-gfm + rehype-raw/sanitize | 10.1.0 |

There is no CSS framework (Tailwind, Bootstrap, etc.). All styles live in `app/globals.css` and feature-specific CSS files (e.g., `app/rentals/rentals.css`) using BEM-style class names.

### 1.2 Backend Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | >=18.17.0 |
| **Framework** | Next.js API routes + React Server Components + Server Actions | 14.2.5 |
| **ORM** | Prisma Client | 5.18.0 |
| **Auth** | NextAuth.js v5 (Auth.js) with JWT strategy | 5.0.0-beta.30 |
| **Password hashing** | bcryptjs (cost factor 12) | 3.0.3 |
| **Rate limiting** | Upstash Redis (`@upstash/ratelimit`) | 2.0.8 |
| **File uploads** | `@vercel/blob` | 2.3.0 |
| **HTML sanitization** | DOMPurify / isomorphic-dompurify | 3.3.1 |
| **HTTP client** | Undici (with proxy support) | 7.22.0 |
| **HTML parsing** | Cheerio | 1.0.0 |
| **Browser automation** | Playwright (Cloudflare bypass) | 1.58.2 |
| **Email** | Resend | 6.9.2 |
| **AI** | Google Gemini REST API (direct client) | -- |

There is no Express, Fastify, or standalone server. The entire backend runs through Next.js's built-in routing.

### 1.3 Database

| Property | Detail |
|---|---|
| **Engine** | MySQL (MariaDB-compatible) |
| **Host** | Hostinger shared MySQL (see `.env`) |
| **Database** | Configured via `DATABASE_URL` env var |
| **ORM** | Prisma 5.18.0 with declarative schema |
| **Schema size** | 970 lines, 30+ models, 20+ enums |

### 1.4 Auth System

- **Providers:** Google OAuth 2.0 + Credentials (email/password)
- **Adapter:** `@auth/prisma-adapter`
- **Session storage:** Stateless JWT cookie (30-day max age)
- **Token contents:** `sub` (user ID), `role`, `hasProfile`, `avatarUrl`
- **Cookie names:** `authjs.session-token` (HTTP) / `__Secure-authjs.session-token` (HTTPS)

### 1.5 Hosting Environment

| Property | Detail |
|---|---|
| **Platform** | Vercel |
| **Build command** | `prisma generate && prisma migrate deploy && next build` |
| **Start command** | `next start -H 0.0.0.0 -p $PORT` |
| **Database** | Hostinger MySQL |
| **Redis** | Upstash Redis (serverless, rate limiting) |
| **File storage** | Vercel Blob Storage |
| **Cron** | Vercel cron: daily email schedule at 08:00 UTC |

---

## 2. Folder & Module Structure

```
globescraper_nextjs/
  app/                            # Next.js App Router
    layout.tsx                    # Root layout (fonts, theme, GA4, providers)
    globals.css                   # Global styles (BEM)
    page.tsx                      # Homepage
    not-found.tsx                 # Custom 404
    [slug]/                       # Dynamic blog posts + static pages
    about/                        # Static about page
    blog/                         # Blog listing (static + AI posts)
    how-it-works-to-teach-english/# Guide page
    rentals/                      # Public rental marketplace
      page.tsx                    # Search with filters, pagination
      rentals.css                 # Rental-specific styles
      [id]/                       # Listing detail page
      heatmap/                    # Public interactive heatmap
        embed/                    # Embeddable heatmap (iframe-friendly)
    community/                    # Community directory
      actions.ts                  # Server actions (connect, block, report)
      image-actions.ts            # Avatar + gallery upload actions
      [userId]/                   # Individual profile
      edit-profile/               # Profile editor
    meetups/                      # Meetup listing + detail + creation
      actions.ts                  # CRUD, RSVP actions
      [id]/                       # Meetup detail
      new/                        # Create meetup
    dashboard/                    # User dashboard
      messages/                   # DM inbox
        [conversationId]/         # Conversation thread
      requests/                   # Connection requests
    admin/                        # Admin dashboard
      admin-actions.ts            # Ban, suspend, hide, etc.
      blog/                       # Blog management
        [id]/                     # Post editor
      content-generator/          # AI article generator
        drafts/                   # Draft management
      email/                      # Email campaign dashboard
    tools/                        # Admin tools hub
      rentals/                    # Pipeline dashboard
        analytics/                # Rental analytics
        heatmap/                  # Admin heatmap
        listings/                 # Listings table
    login/ signup/ create-profile/
    robots.txt/                   # Dynamic robots.txt
    sitemap.xml/                  # Dynamic XML sitemap
    unsubscribe/                  # Email unsubscribe
    api/                          # 55 REST endpoints (see Section 9)
  
  components/
    SiteLayout.tsx                # Header, footer, nav, avatar dropdown
    Providers.tsx                 # SessionProvider wrapper
    AnalyticsProvider.tsx         # GA4 auto-tracking
    ActivityTracker.tsx           # User activity tracking
    JsonLd.tsx                    # Structured data (WebSite, Article, FAQ, Breadcrumb)
    HtmlContent.tsx               # Sanitized HTML renderer
    MarkdownContent.tsx           # Markdown renderer (react-markdown)
    BlogPageClient.tsx            # Blog index with category filters + search
    BlogCardTracker.tsx           # Blog card analytics
    RecommendedPosts.tsx          # Related post suggestions
    Lightbox.tsx                  # Image lightbox
    ThemeToggle.tsx               # Dark/light switch
    RevealOnScroll.tsx            # Intersection Observer animations
    SkeletonLoader.tsx            # Loading placeholders
    community/                    # ProfileHeaderCard, ActivityFeed, ConnectionsPreview,
                                  # GallerySection, RelocationStepper, TrustPanel,
                                  # StatCards, Chips, SidebarAccordion
    rentals/                      # RentalFilters, RentalResultsList, RentalResultCard,
                                  # ListingDetailClient, ListingGallery, ListingImageStrip,
                                  # ListingCardImageCarousel, ImagePair, ListingFactsCard,
                                  # PriceBlock, SpecIcons, AmenitiesList,
                                  # HeatmapPreviewCard, Pagination, useSavedListings
    analytics/                    # AnalyticsDashboardClient, KpiCards, MedianTrendChart,
                                  # DistributionChart, MarketPressureChart,
                                  # HistoricalHeatmap, TopMoversTable
    tools/                        # RentalPipelineDashboard, ListingsTable,
                                  # ListingsTableWrapper, JobRunsTable,
                                  # InteractiveHeatmap, LiveLogViewer
    admin/                        # AdminHeroEditor, AdminPostToolbar,
                                  # AdminImageManager, email components
  
  lib/
    prisma.ts                     # Singleton PrismaClient (HMR-safe)
    auth.ts                       # requireAuth() / requireAdmin() guards
    security.ts                   # logSecurityEvent(), isIpBlocked()
    rate-limit.ts                 # Upstash Redis limiters (login, connections, DMs)
    connections.ts                # canonicalPair(), areConnected(), isBlocked()
    community-profile.ts          # Community profile view model (234 lines)
    content.ts                    # Static content loader + HTML cleaner
    contentImages.ts              # Blog hero image mapping
    published-posts.ts            # AI-published post merger with categories
    affiliate-links.ts            # Affiliate link registry (SafetyWing, NordVPN, Bridge, etc.)
    site.ts                       # Site config (name, URL, nav, social)
    analytics.ts                  # GA4 typed event helpers with dedup
    tableMobile.ts                # Mobile table utilities
    ai/                           # Gemini client (463 lines), prompts (263 lines),
                                  # image generation (Imagen 4.0, 350 lines),
                                  # image search (Serper.dev, 358 lines)
    scrape/                       # contentDiscovery, competitorAnalysis,
                                  # buildFactsPack, fetchPage, extractMainText
    news/                         # searchTopicsPipeline (1,232 lines),
                                  # coverageAnalysis (487 lines), topicRotation,
                                  # titleSimilarity
    newsSourcePolicy.ts           # 30+ trusted source registry
    newsTopicTypes.ts             # Topic type definitions
    newsTopicScoring.ts           # Composite quality scoring
    newsTopicDiscovery.ts         # Topic discovery helpers
    robots/                       # Robots.txt compliance checker with caching
    email/                        # Resend client, AI prompts/schemas,
                                  # 9 block types, 5 template presets,
                                  # HTML + plain text rendering
    rentals/                      # (see Section 5)
    validations/                  # Zod schemas (profile.ts, community.ts)
  
  prisma/
    schema.prisma                 # 30+ models, 20+ enums (970 lines)
    migrations/                   # Database migrations
  
  scripts/                        # 45+ CLI tools (see Section 12)
  content/                        # Static HTML + JSON manifests
  data/                           # Cambodia GeoJSON (adm2 + adm3)
  public/geo/                     # Processed GeoJSON for heatmap
  tests/                          # Vitest suites
  types/                          # next-auth.d.ts, gtag.d.ts
  
  auth.ts                         # NextAuth config (providers, callbacks, 128 lines)
  middleware.ts                   # Edge middleware (rate limit, cookie guard, 96 lines)
  next.config.js                  # Images, security headers, rewrites
  vercel.json                     # Cron jobs
  vitest.config.ts                # Test config
```

---

## 3. Data Flow

### 3.1 Standard Page Request (Server Component)

```
Browser GET /community
  |
  +-> middleware.ts
  |     +- Check if route matches protected paths
  |     +- Verify session cookie exists
  |     +- Redirect to /login if missing
  |
  +-> app/community/page.tsx  (React Server Component)
  |     +- await auth()       -> decode JWT -> session
  |     +- prisma.block.findMany(...)
  |     +- prisma.profile.findMany({ where: { hiddenFromCommunity: false } })
  |     +- Return JSX (streamed as HTML)
  |
  +-> Browser receives HTML + JS hydration bundle
```

### 3.2 API Route Request

```
Browser POST /api/connections  (JSON body)
  |
  +-> middleware.ts           -> passes through
  |
  +-> app/api/connections/route.ts  -> POST handler
  |     +- await auth()              -> verify JWT
  |     +- Zod validation            -> parse body
  |     +- Rate limit check          -> Upstash Redis (10/24h)
  |     +- Business logic checks     -> isBlocked(), isUserActive()
  |     +- prisma.connection.create()
  |     +- prisma.connectionRequest.upsert()  -> legacy sync
  |     +- Return NextResponse.json({ ok: true })
  |
  +-> Browser receives JSON
```

### 3.3 Server Action Flow

```
Browser interaction (form submit / button click)
  |
  +-> Client component calls server action
  |
  +-> app/community/actions.ts  -> "use server"
  |     +- await auth()
  |     +- Rate limit check
  |     +- Zod validation
  |     +- Prisma mutations
  |     +- Return { ok: true } or { error: "..." }
  |
  +-> Client receives result, calls router.refresh()
```

### 3.4 Rental Pipeline Flow

```
CLI: npx tsx scripts/realestate-weekly.ts --workers 3
  |
  +-> Main process: discoverAll()
  |     +- 40 query sets across 5 categories
  |     +- Paginate JSON API, collect listing URLs
  |     +- Enqueue new + stale URLs in ScrapeQueue
  |
  +-> spawnWorkers(3)  -> 3 child processes
  |     +- Each runs --process-only --_worker
  |     +- Atomic claiming: UPDATE ScrapeQueue SET status='PROCESSING'
  |       WHERE status IN ('PENDING','RETRY') LIMIT N
  |     +- Fetch listing page, parse fields
  |     +- Upsert RentalListing + create RentalSnapshot
  |     +- Generate reverse-geocoded title via Nominatim
  |
  +-> Main process (after workers finish):
        +- buildDailyIndexJob()  -> aggregate price stats
        +- markStaleListingsJob() -> deactivate old listings
```

### 3.5 AI Article Generation Flow

```
Admin: /admin/content-generator -> Generate
  |
  +-> POST /api/admin/content-generator/generate
  |     +- Discover competitor URLs (Serper.dev)
  |     +- Fetch competitor pages, extract outlines
  |     +- Run gap analysis (headings, depth, coverage)
  |     +- Build facts pack from sources
  |     +- Generate article via Gemini 3 Flash
  |     +- Parse structured JSON output
  |     +- Generate images (Imagen 4.0 / Serper image search)
  |     +- Save GeneratedArticleDraft + images + sources
  |
  +-> Admin reviews draft -> Publish
        +- Slug assigned, SEO score computed
        +- Appears in /blog alongside static posts
```

---

## 4. Core Features

### 4.1 Authentication

| Aspect | Detail |
|---|---|
| **Routes** | `POST /api/signup`, `/api/auth/[...nextauth]`, `/login`, `/signup` |
| **Tables** | `User`, `Account`, `Session`, `VerificationToken` |
| **Security** | bcrypt (cost 12), JWT (30-day), login rate limiting (5/15min), IP blocking, status checks (disabled/banned/suspended/deleted) |

**Registration:** Form -> POST `/api/signup` (Zod, IP block check, dupe check, bcrypt) -> `User` created -> auto sign-in -> redirect `/create-profile`.

**Login:** `signIn("credentials")` -> `authorize()` (find user, bcrypt compare, status checks) -> JWT minted. Google: OAuth flow -> `signIn` callback blocks banned users.

### 4.2 User Profiles

**Teaching Profile** (created at `/create-profile`):
- Fields: passportCountry, degreeStatus, nativeEnglish, teachingExperience, certificationStatus, desiredStartTimeline, savingsBand, targetCountries

**Community Profile** (extension at `/community/edit-profile`):
- Fields: displayName, bio, currentCountry, currentCity, avatarUrl, visibility (PRIVATE/MEMBERS_ONLY/PUBLIC), meetup intents (Coffee/CityTour/JobAdvice/StudyGroup/LanguageExchange/VisaHelp/SchoolReferrals), relocationStage, certifications JSON, languages JSON, interests JSON, gallery images

### 4.3 Connections

- **Tables:** `Connection` (canonical pair: userLowId < userHighId) + `ConnectionRequest` (legacy directional)
- **Dual-write pattern:** Writes to both tables with try/catch on legacy. Reads prefer canonical with fallback.
- **Rate limited:** 10 requests per 24 hours via Upstash Redis
- **Lifecycle:** Send -> PENDING -> Accept (ACCEPTED) or Decline (DECLINED). Accepted unlocks messaging.

### 4.4 Direct Messages

- **Tables:** `Conversation`, `ConversationParticipant`, `Message`
- **Rate limited:** 30 messages per minute
- **Read receipts:** `lastReadAt` on ConversationParticipant, unread computed per conversation
- **UI:** Split layout with connection sidebar + conversation list/thread

### 4.5 Meetups

- **Tables:** `Meetup`, `MeetupAttendee`
- **Actions:** Create, update, cancel, RSVP (GOING/INTERESTED), leave
- **Filters:** Country, city
- **Security:** Auth + profile required, future date validation, max attendees, creator/admin cancel only

### 4.6 Blocking & Reporting

- **Block:** Bidirectional exclusion from community listing, messaging, connections, meetup attendee lists
- **Report:** Polymorphic (USER or MEETUP target, SPAM/HARASSMENT/SCAM/OTHER reason)

### 4.7 Leads

- **Route:** `POST /api/lead` (public, in-memory rate limit 5/min/IP, CORS whitelist)
- **Admin:** Status tracking (NEW -> CONTACTED -> CONVERTED -> CLOSED), notes, audit log

### 4.8 Admin Panel

**Dashboard metrics (13 cards):**
Total users, new users this week, total leads, total profiles, open reports, active meetups, total connections, total messages, blocked IPs, banned count, suspended count, profile completion rate

**User management:** Search/filter, view detail (email, role, status, creation, last login, bio, visibility), edit (name, email, bio, role, status), actions (Suspend, Ban, Reactivate, Delete, Hide/Unhide)

**Admin actions:** `adminDisableUser`, `adminBanUser`, `adminReactivateUser`, `adminToggleHideUser`, `adminCancelMeetup`, `adminDismissReport` -- all audit-logged with before/after state.

### 4.9 Content & Blog

- **Static content:** HTML files in `content/posts/` + `content/pages/`, metadata in JSON manifests, HTML cleaning pipeline for Zyrosite migration
- **AI content:** Published drafts served alongside static posts, category inference from keywords (Teaching, Visas, Safety, Airports, Healthcare, Digital Nomad, Travel, Border News, Rentals)
- **Blog index:** Category filtering, search, card grid with analytics tracking
- **SEO:** JSON-LD (WebSite, Article, FAQ, Breadcrumb, BlogCollection), dynamic sitemap (ISR @ 1h), dynamic robots.txt, OG + Twitter cards

### 4.10 Analytics Tracking

GA4 events with dedup guard (300ms): `trackPageView`, `trackLeadSubmission`, `trackCTAClick`, `trackOutboundClick`, `trackBlogView`, `trackBlogScroll`, affiliate detection (NordVPN, SafetyWing, Anker, TEFL/TESOL)

---

## 5. Rental Data Pipeline

### 5.1 Architecture Overview

A multi-source scraping and analytics pipeline for Cambodian rental listings. The system discovers listing URLs, scrapes individual pages, normalizes data, generates AI-enhanced content, and produces aggregated price analytics.

### 5.2 Sources (7 adapters in `lib/rentals/sources/`)

| Source | Status | Method | Notes |
|---|---|---|---|
| **Realestate.com.kh** | Enabled | JSON API (`/api/portal/pages/results/`) | 5 property categories, 40 overlapping query sets, ~35k listings |
| **Khmer24** | Enabled | Playwright (headless Chromium) | Behind Cloudflare WAF, 2 categories |
| **IPS Cambodia** | Enabled | HTTP/Cheerio | `/rent/?paging=N` pagination |
| **CamRealty** | Enabled | HTTP/Cheerio | WordPress site, category pages |
| **LongTermLettings** | Enabled | HTTP/Cheerio | Small site (~37 listings) |
| **FazWaz** | Enabled | HTTP/Cheerio | Good sangkat-level location data |
| **HomeToGo** | Disabled | -- | GBP pricing, JS SPA, poor fit |

### 5.3 Pipeline Jobs (`lib/rentals/jobs/`)

| Job | Purpose |
|---|---|
| **Discover** | Crawl category pages, extract listing URLs, enqueue in ScrapeQueue |
| **ProcessQueue** | Atomic claiming via raw SQL (`UPDATE...LIMIT`), fetch + parse listings, upsert RentalListing + create RentalSnapshot, generate reverse-geocoded titles |
| **BuildIndex** | Aggregate daily snapshots into RentalIndexDaily (median, mean, p25, p75 by city/district/beds/type) |
| **MarkStaleListings** | Deactivate listings not seen in N days |

### 5.4 Pipeline Infrastructure (`lib/rentals/`)

| Module | Purpose |
|---|---|
| `config.ts` | Caps, concurrency limits (4 workers, 6 concurrent), source toggles, human-like pacing (jittered delays 1.2-2s, breathers every 40-70 pages, night idle 2-5s, skip probability 1%) |
| `http.ts` | Concurrency-limited fetcher, exponential backoff, polite delays, proxy support (`SCRAPE_PROXY` env), night idle, breathers |
| `playwright.ts` | Headless Chromium for Cloudflare-protected sites (Khmer24) |
| `classify.ts` | Property type classifier (keyword-based, prioritized matching) |
| `parse.ts` | Price parsing ($50-$50K range), beds/baths/size extraction, district/city parsing, amenity extraction |
| `fingerprint.ts` | SHA-256 content fingerprinting for deduplication |
| `district-geo.ts` | Cambodia district GeoJSON normalization (sangkat-level for PP inner city, khan-level otherwise), 300+ district alias mappings |
| `title-geocode.ts` | Reverse geocoding via OpenStreetMap Nominatim for listing titles |
| `url.ts` | URL canonicalization |
| `api-guard.ts` | Admin API auth guard for pipeline endpoints |
| `pipelineLogger.ts` | Pipeline logging utilities |

### 5.5 Queue System

- **Table:** `ScrapeQueue` with status enum: PENDING, PROCESSING, DONE, RETRY
- **Atomic claiming:** Raw SQL `UPDATE ScrapeQueue SET status='PROCESSING', lastError=claimTag WHERE source=? AND status IN ('PENDING','RETRY') ORDER BY priority DESC, createdAt ASC LIMIT ?`
- **Claim tags:** Unique per worker (`w{timestamp_base36}`) to prevent double-processing
- **Retry:** Failed items set to RETRY status for future attempts

### 5.6 Parallel Workers

- `--workers N` CLI flag spawns N child processes via `execFile("npx", ["tsx", ...], { shell: true })`
- Each worker runs `--process-only --_worker` mode
- `MAX_PROCESS` divided evenly across workers
- `Promise.allSettled` -- one worker failure doesn't kill others
- Available in: `realestate-weekly.ts`, `scrape-realestate-full.ts`, `scrape-all-sources.ts`

### 5.7 AI Enhancements

| Feature | Model | Batch Size | Cost Estimate |
|---|---|---|---|
| **AI Review** (`ai-review.ts`) | Gemini | 15/batch | $0.02-0.05 per 3,000 listings |
| **AI Rewrite** (`ai-rewrite.ts`) | Gemini | 5/batch | $0.05-0.15 per 3,000 listings |

- **AI Review:** Classifies residential vs non-residential, suggests correct PropertyType, confidence scoring, flags problematic listings
- **AI Rewrite:** Standardizes descriptions to professional English, stored in `descriptionAi` field

### 5.8 ML Features (`lib/rentals/ml.ts`)

Behind feature flags (`RENTALS_ML_ENABLED`, `RENTALS_EMBEDDINGS_ENABLED`):
- District normalization via alias mapping
- Near-duplicate detection via trigram similarity
- Price outlier detection (IQR method + Z-score)
- Embedding stubs for future clustering

### 5.9 Analytics (`lib/analytics/`)

| Module | Purpose |
|---|---|
| `calculateStats.ts` | KPI computation (median rent, 1-bed/2-bed medians, 1m/3m % changes, volatility, supply signal), district distribution, time-series, top movers |
| `volatility.ts` | Rolling window volatility, annualized volatility, district rankings |

### 5.10 Public Rental Pages

| Route | Purpose |
|---|---|
| `/rentals` | Search with filters (city, district, beds, type, price range, sort), 7 results/page, heatmap preview card |
| `/rentals/[id]` | Detail page: image gallery, map, amenities (Facilities + Amenities split), AI description, price, specs |
| `/rentals/heatmap` | Interactive choropleth (Leaflet + GeoJSON), ISR @ 1h, SEO content, source links |
| `/rentals/heatmap/embed` | Iframe-embeddable version with attribution backlink |

### 5.11 Admin Rental Tools

| Route | Purpose |
|---|---|
| `/tools/rentals` | Pipeline dashboard: trigger jobs, view stats, live log viewer |
| `/tools/rentals/listings` | Listings table with search, filters, inline edit, delete |
| `/tools/rentals/analytics` | KPI cards, trend charts, distribution, volatility, top movers |
| `/tools/rentals/heatmap` | Admin heatmap tool |

---

## 6. AI Blog Generator

### 6.1 Architecture

End-to-end article generation using Google Gemini 3 Flash Preview.

### 6.2 Core Components (`lib/ai/`)

| Module | Lines | Purpose |
|---|---|---|
| `geminiClient.ts` | 463 | Direct Gemini REST API client, JSON/text modes, schema validation, retry logic |
| `prompts.ts` | 263 | Prompt system: banned words, style rules (no em dashes, active voice, short sentences), structured JSON output |
| `imageGen.ts` | 350 | Imagen 4.0 generation via Gemini API, Vercel Blob storage. Per article: 1 HERO (1344x768), 1 OG (1200x630), 3 INLINE |
| `imageSearch.ts` | 358 | Hybrid image sourcing: Serper.dev for landmarks, AI-generated fallbacks |

### 6.3 Research Pipeline (`lib/scrape/`)

| Module | Purpose |
|---|---|
| `contentDiscovery.ts` | Competitor URL discovery (Serper.dev API or heuristic fallback from 16 known competitor domains) |
| `competitorAnalysis.ts` | Outline extraction (H2/H3 headings), gap analysis, depth recommendations |
| `buildFactsPack.ts` | Structure source data into fact bullets for prompt injection |
| `fetchPage.ts` | Polite fetcher with 24h cache, proper User-Agent |
| `extractMainText.ts` | HTML content extraction (strips nav, ads, scripts) |

### 6.4 News Article Generator (`lib/news/`)

| Module | Lines | Purpose |
|---|---|---|
| `searchTopicsPipeline.ts` | 1,232 | Multi-strategy topic discovery: stable query generation, priority-ordered search, multi-round fallback, Gemini variation |
| `coverageAnalysis.ts` | 487 | Scan existing posts, map covered intents (46 vocabulary terms), identify gaps, generate candidate titles |
| `topicRotation.ts` | 176 | Deterministic rotation (15 gap topics: airport, visa, scams, transport, etc.), exclude last 3 used |
| `titleSimilarity.ts` | 173 | Near-duplicate detection: Jaccard word similarity + bigram overlap |

### 6.5 Supporting Infrastructure

- `newsSourcePolicy.ts` (175 lines) -- Trusted source registry: 30+ sources across OFFICIAL_GOV, OFFICIAL_TOURISM, INTERNATIONAL_NEWS, LOCAL_NEWS, EXPAT_COMMUNITY, TRAVEL_INFO, TEACHING. Blocked domain list.
- `newsTopicScoring.ts` -- Composite quality scoring (source grounding, query quality, outline depth, keyword quality, audience breadth)
- `robots/robotsCheck.ts` -- Robots.txt compliance checker with caching

### 6.6 Admin Interface

| Route | Purpose |
|---|---|
| `/admin/content-generator` | Generate articles with topic input |
| `/admin/content-generator/drafts` | Draft management + publish workflow |
| `/admin/blog` | Published article management |
| `/admin/blog/[id]` | Post editor with hero image, SEO check/fix, republish |

---

## 7. Email System

### 7.1 Architecture

Full email campaign management using Resend, with AI-powered content generation via Gemini.

### 7.2 Block-Based Template System (`lib/email/blocks/`)

9 block types: Hero, Paragraphs, CTA, FeatureGrid3, TipsBox, AlertBanner, Divider, SectionHeading, PostList

### 7.3 Template Catalog (`lib/email/templates/catalog.ts`)

5 presets: `welcome_v1`, `news_alert_v1`, `weekly_digest_v1`, `visa_update_v1`, `new_places_v1`

### 7.4 Rendering

- `renderEmail.ts` -- HTML render from block data
- `renderTextVersion.ts` -- Plain text version
- Base layout with responsive helpers and design tokens

### 7.5 AI Generation

- `lib/email/ai/prompts.ts` -- Gemini prompt builders for template generation
- `lib/email/ai/schemas.ts` -- Zod validation for AI-generated blocks

### 7.6 Delivery & Tracking

- **Provider:** Resend (`lib/email/resendClient.ts`)
- **Webhooks:** `/api/webhooks/resend` -- delivery, bounce, open, click tracking
- **Cron:** `/api/admin/email/schedule/run` at `0 8 * * *` (daily 08:00 UTC)
- **Models:** `EmailCampaign` (DRAFT/SCHEDULED/SENDING/SENT), `EmailLog` (per-recipient tracking)

---

## 8. Database Schema

### 8.1 Entity-Relationship Overview

```
User
  +-- Account (OAuth)
  +-- Session
  +-- Profile
  |     +-- ProfileTargetCountry
  |     +-- ProfileImage
  |     +-- ActivityEvent
  +-- ConnectionRequest (legacy, directional)
  +-- Connection (canonical, userLow/userHigh)
  +-- ConversationParticipant -- Conversation -- Message
  +-- MeetupAttendee -- Meetup
  +-- Block (blocker <-> blocked)
  +-- Report (reporter -> target)
  +-- AdminAuditLog
  +-- UserSecurityEvent

AI Blog:
  GeneratedArticleDraft
    +-- BlogRevision
    +-- GeneratedArticleImage
    +-- GeneratedArticleSource
    +-- GeneratedArticleRun
  TitleGenerationLog

Email:
  EmailCampaign
  EmailLog

Rentals:
  RentalListing
    +-- RentalSnapshot
    +-- RentalAiReview
  RentalIndexDaily
  RentalIndexMonthly
  ScrapeQueue
  JobRun

Standalone:
  Lead, WaitlistEntry, BlockedIp, VerificationToken
```

### 8.2 Key Models

#### Auth & User
| Model | Key Fields | Notes |
|---|---|---|
| **User** | id, email, passwordHash, role (USER/ADMIN), status (ACTIVE/SUSPENDED/BANNED/DELETED), disabled, lastLoginAt | Central identity |
| **Account** | provider, providerAccountId, access_token | OAuth (Google) |
| **Profile** | 40+ fields: passport, degree, experience, bio, avatar, visibility, meetup intents, relocation stage, certifications/languages/interests JSON | Single row per user |

#### Community
| Model | Key Fields | Notes |
|---|---|---|
| **Connection** | userLowId, userHighId, requestedByUserId, status (PENDING/ACCEPTED/REJECTED) | Canonical pair ordering |
| **ConnectionRequest** | fromUserId, toUserId, status (PENDING/ACCEPTED/DECLINED/BLOCKED) | Legacy, dual-write |
| **Conversation** | type (DM) | Container for messages |
| **Message** | conversationId, senderId, body, deletedAt | Soft delete |
| **Meetup** | title, country, city, dateTime, maxAttendees, status (ACTIVE/CANCELLED) | |
| **MeetupAttendee** | status (GOING/INTERESTED/LEFT) | |
| **Block** | blockerUserId, blockedUserId | Unique pair |
| **Report** | targetType (USER/MEETUP), reason (SPAM/HARASSMENT/SCAM/OTHER) | Polymorphic |

#### AI Blog
| Model | Key Fields | Notes |
|---|---|---|
| **GeneratedArticleDraft** | title, slug, markdown, html, heroImage, ogImage, status (DRAFT/PUBLISHED), confidence, seoScore, contentHash, category | Main article storage |
| **BlogRevision** | revision history | |
| **GeneratedArticleImage** | kind (HERO/OG/INLINE), prompt, altText, storageUrl | Imagen 4.0 + Serper |
| **GeneratedArticleSource** | Source citations | |
| **GeneratedArticleRun** | model, tokens, status | Generation tracking |
| **TitleGenerationLog** | Topic rotation tracking | |

#### Email
| Model | Key Fields | Notes |
|---|---|---|
| **EmailCampaign** | subject, html, text, segment, status (DRAFT/SCHEDULED/SENDING/SENT), delivery metrics | |
| **EmailLog** | type (TRANSACTIONAL/MARKETING), delivery status, open/click tracking | Per-recipient |

#### Rentals
| Model | Key Fields | Notes |
|---|---|---|
| **RentalListing** | source, title, description, city, district, propertyType, beds/baths/sqm, priceMonthlyUsd, images JSON, amenities JSON, lat/lng, active, contentFingerprint, descriptionAi, titleGeocoded | Central listing |
| **RentalSnapshot** | listingId, priceMonthlyUsd, scrapedAt | Price history |
| **RentalAiReview** | residential classification, suggested type, confidence, flagged | Gemini output |
| **RentalIndexDaily** | date, city, district, beds, type, median/mean/p25/p75 | Aggregated stats |
| **RentalIndexMonthly** | Monthly aggregation | |
| **ScrapeQueue** | url, source, status (PENDING/PROCESSING/DONE/RETRY), priority, lastError | Atomic claiming |
| **JobRun** | type (DISCOVER/PROCESS_QUEUE/BUILD_INDEX), counts, timing, errors | Pipeline tracking |

### 8.3 Enums (20+)

| Category | Enums |
|---|---|
| **Auth** | Role, UserStatus |
| **Profile** | DegreeStatus, TeachingExperience, CertificationStatus, TargetCountry, DesiredStartTimeline, SavingsBand, RelocationStage, LookingFor, ReplyTimeHint, ProfileVisibility |
| **Community** | ConnectionStatus, CanonicalConnectionStatus, MeetupVisibility, MeetupStatus, AttendeeStatus, ReportTargetType, ReportReason, ConversationType, ActivityEventType |
| **Blog** | ArticleStatus, ArticleConfidence, ArticleRunStatus, ArticleImageKind |
| **Email** | CampaignStatus, EmailLogType, EmailLogStatus |
| **Rentals** | RentalSource, PropertyType, JobType, JobStatus, QueueStatus |
| **Leads** | LeadStatus |

---

## 9. API Routes

### 9.1 Auth (2 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST` | `/api/auth/[...nextauth]` | -- | NextAuth route handler |
| `POST` | `/api/signup` | No | User registration |

### 9.2 User-Facing (5 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST` | `/api/profile` | Yes | Profile CRUD |
| `GET/POST` | `/api/connections` | Yes | Connection management |
| `GET` | `/api/connections/pending-count` | Yes | Pending request count |
| `GET/POST` | `/api/messages` | Yes | Conversations and sending |
| `GET` | `/api/messages/[conversationId]` | Yes | Thread messages |
| `GET` | `/api/messages/unread-count` | Yes | Unread count |

### 9.3 Admin -- User Management (6 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | Admin | List users with filters |
| `GET/PATCH` | `/api/admin/users/[userId]` | Admin | User detail + edit |
| `GET` | `/api/admin/users/[userId]/stats` | Admin | User activity stats |
| `GET` | `/api/admin/leads` | Admin | Lead management |
| `GET` | `/api/admin/audit-log` | Admin | Audit log |
| `GET/POST/DELETE` | `/api/admin/blocked-ips` | Admin | IP blocking |

### 9.4 Admin -- Blog (8 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/PATCH/DELETE` | `/api/admin/blog/[id]` | Admin | Article CRUD |
| `GET` | `/api/admin/blog/by-slug/[slug]` | Admin | Lookup by slug |
| `POST` | `/api/admin/blog/[id]/hero-image` | Admin | Hero image |
| `POST` | `/api/admin/blog/[id]/images` | Admin | Image management |
| `POST` | `/api/admin/blog/[id]/republish` | Admin | Republish |
| `GET` | `/api/admin/blog/[id]/seo-check` | Admin | SEO audit |
| `POST` | `/api/admin/blog/[id]/seo-fix` | Admin | Auto SEO fix |

### 9.5 Admin -- Content Generator (7 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/content-generator/generate` | Admin | Generate AI article |
| `GET/DELETE` | `/api/admin/content-generator/drafts/[id]` | Admin | Draft management |
| `POST` | `/api/admin/content-generator/drafts/[id]/publish` | Admin | Publish draft |
| `POST` | `/api/admin/content-generator/drafts/[id]/regenerate-images` | Admin | Regenerate images |
| `POST` | `/api/admin/content-generator/drafts/regenerate-all-images` | Admin | Batch image regen |
| `POST` | `/api/admin/content-generator/news/search` | Admin | Discover news topics |
| `POST` | `/api/admin/content-generator/news/generate-title` | Admin | Generate title from gap |
| `POST` | `/api/admin/content-generator/news/generate` | Admin | Generate news article |

### 9.6 Admin -- Email (9 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST` | `/api/admin/email/campaigns` | Admin | Campaign CRUD |
| `GET/PATCH` | `/api/admin/email/campaigns/[id]` | Admin | Campaign management |
| `POST` | `/api/admin/email/generate-with-ai` | Admin | AI content generation |
| `POST` | `/api/admin/email/send-campaign` | Admin | Send campaign |
| `POST` | `/api/admin/email/send-single` | Admin | Send single email |
| `GET` | `/api/admin/email/subscribers` | Admin | Subscriber list |
| `PATCH` | `/api/admin/email/subscribers/update` | Admin | Update preferences |
| `POST` | `/api/admin/email/templates/generate-options` | Admin | AI template options |
| `POST` | `/api/admin/email/templates/render` | Admin | Render template |
| `GET` | `/api/admin/email/schedule/run` | Cron | Scheduled execution |

### 9.7 Rental Pipeline (14 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/tools/rentals/discover` | Admin | Run discovery job |
| `POST` | `/api/tools/rentals/process-queue` | Admin | Process scrape queue |
| `POST` | `/api/tools/rentals/build-index` | Admin | Build daily index |
| `POST` | `/api/tools/rentals/run` | Admin | Full pipeline |
| `POST` | `/api/tools/rentals/cleanup` | Admin | Cleanup stale |
| `POST` | `/api/tools/rentals/ai-reviews` | Admin | AI review batch |
| `POST` | `/api/tools/rentals/ai-rewrite` | Admin | AI rewrite batch |
| `GET` | `/api/tools/rentals/summary` | Admin | Pipeline stats |
| `GET` | `/api/tools/rentals/listings` | Admin | Paginated listings |
| `GET/PATCH/DELETE` | `/api/tools/rentals/listings/[id]` | Admin | Single listing |
| `GET` | `/api/tools/rentals/listings/[id]/snapshots` | Admin | Price history |
| `GET` | `/api/tools/rentals/job-runs` | Admin | Job history |
| `GET` | `/api/tools/rentals/job-runs/[id]/logs` | Admin | Job logs |
| `GET` | `/api/tools/rentals/heatmap-data` | Public | Heatmap aggregation |
| `GET` | `/api/tools/rentals/listing-points` | Public | Map lat/lng points |
| `GET` | `/api/tools/rentals/analytics` | Admin | Analytics time-series |

### 9.8 Infrastructure (4 endpoints)
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/api/heartbeat` | No | Heartbeat |
| `POST` | `/api/lead` | No | Lead capture |
| `POST` | `/api/webhooks/resend` | Webhook | Email delivery tracking |

---

## 10. Security Overview

### 10.1 Password Hashing
- **Algorithm:** bcrypt via bcryptjs (cost factor 12)
- **Storage:** `User.passwordHash` (VARCHAR 255)

### 10.2 Session Management
- **Strategy:** Stateless JWT (30-day max age)
- **Token payload:** `sub`, `role`, `hasProfile`, `avatarUrl`
- **Invalidation:** Ban/suspend deletes Session rows + blocks in authorize/signIn callbacks

### 10.3 Rate Limiting

| Limiter | Scope | Limit | Window | Backing |
|---|---|---|---|---|
| Login attempts | Per IP | 5 | 15 min (sliding) | Upstash Redis |
| Connection requests | Per user | 10 | 24 hours (sliding) | Upstash Redis |
| Direct messages | Per user | 30 | 1 minute (sliding) | Upstash Redis |
| Lead submissions | Per IP | 5 | 1 minute | In-memory Map |

### 10.4 Role-Based Authorization (3 layers)

1. **Edge middleware** (`middleware.ts`): Cookie presence check, fast rejection
2. **Server-side auth** (`auth()`): JWT decode -> session with user ID + role
3. **Helper guards** (`lib/auth.ts`): `requireAuth()` redirects to `/login`; `requireAdmin()` checks role

### 10.5 Input Validation
- Zod schemas on all user input (signup, profile, connections, meetups, reports, messages, admin, leads)
- Server-side enforcement only (never trusted from client)
- Prisma parameterized queries (no raw SQL in application code, except atomic queue claiming)
- DOMPurify for HTML sanitization

### 10.6 HTTP Security Headers

| Header | Value |
|---|---|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY (except embeddable heatmap) |
| Referrer-Policy | strict-origin-when-cross-origin |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-XSS-Protection | 1; mode=block |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), interest-cohort=() |

### 10.7 Additional Measures
- **IP blocking** with optional expiration (admin-managed)
- **Security event logging** (login/signup with IP + user agent)
- **Audit trail** for all admin actions (before/after state)
- **CORS whitelist** on lead API
- **Bidirectional blocking** for all social features
- **Admin hide** (`hiddenFromCommunity`) for stealth moderation

---

## 11. External Integrations

| Service | Purpose | Config |
|---|---|---|
| **Google OAuth 2.0** | Social login | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` |
| **Upstash Redis** | Distributed rate limiting | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel Blob** | Image storage (avatars, gallery, AI images) | Automatic via Vercel env |
| **Google Analytics 4** | Website analytics | GA4 measurement ID in layout |
| **Google Gemini** | AI article + email generation | `GEMINI_API_KEY` |
| **Imagen 4.0** | AI image generation (via Gemini API) | Same key |
| **Serper.dev** | Web search + image search for research | `SERPER_API_KEY` |
| **Resend** | Email delivery + webhooks | `RESEND_API_KEY` |
| **OpenStreetMap Nominatim** | Reverse geocoding for listing titles | Free API (rate-limited) |
| **Hostinger MySQL** | Primary database | `DATABASE_URL` |

---

## 12. CLI Scripts

### 12.1 Scraper Scripts

| Script | Purpose | Usage |
|---|---|---|
| `realestate-daily.ts` | Daily new-listing scraper (5-15 min) | `npx tsx scripts/realestate-daily.ts` |
| `realestate-weekly.ts` | Weekly full scrape (2-6h, parallel workers) | `npx tsx scripts/realestate-weekly.ts --workers 3` |
| `scrape-realestate-full.ts` | Full discovery (40 query sets) | `npx tsx scripts/scrape-realestate-full.ts --workers 3` |
| `scrape-all-sources.ts` | Multi-source parallel launcher | `npx tsx scripts/scrape-all-sources.ts --workers 2` |

### 12.2 AI Scripts

| Script | Purpose |
|---|---|
| `ai-review-listings.ts` | Gemini batch classification (residential/non-residential) |
| `ai-rewrite-descriptions.ts` | Gemini batch description rewriting |
| `generate-tefl-blog.ts` | TEFL blog post generation |

### 12.3 Data Backfill Scripts

| Script | Purpose |
|---|---|
| `backfill-amenities.ts` | Re-extract amenities from descriptions |
| `backfill-districts.ts` | Normalize district names |
| `backfill-titles.ts` | Generate geocoded titles for existing listings |
| `backfill-sr-sangkats.ts` | Siem Reap sangkat normalization |
| `backfill-email-verified.ts` | Backfill email verification status |

### 12.4 Data Cleaning Scripts

| Script | Purpose |
|---|---|
| `fix-bad-prices.ts` | Correct pricing anomalies |
| `fix-broken-images.ts` | Remove broken image references |
| `fix-city-contamination.ts` | Clean cross-city data leakage |
| `fix-post-images.ts` | Fix blog post images |
| `delete-no-price.ts` | Remove listings without prices |
| `deactivate-listing.ts` | Manually deactivate a listing |
| `purge-khmer24-data.ts` | Remove Khmer24 data |
| `reclassify-listings.ts` | Re-run property type classification |

### 12.5 Pipeline Scripts

| Script | Purpose |
|---|---|
| `rentals_discover.ts` | Run discovery only |
| `rentals_process_queue.ts` | Run queue processing only |
| `rentals_build_index.ts` | Build daily index |
| `rentals_bulk_scrape.ts` | Bulk scraping |
| `rentals_daily_scrape.ts` | Daily scrape orchestration |
| `build-monthly-index.ts` | Monthly price aggregation |
| `build-cambodia-geojson.ts` | Process Cambodia GeoJSON boundaries |

### 12.6 Blog Scripts

| Script | Purpose |
|---|---|
| `add-banners-to-ai-posts.ts` | Add promotional banners to AI articles |
| `add-bridge-banners-to-ai-posts.ts` | Add Bridge TEFL banners |

### 12.7 Utility Scripts

| Script | Purpose |
|---|---|
| `seed-admin.ts` | Create/update admin user |
| `check-build.js` | Verify .next build exists |

---

## 13. Potential Risks & Technical Debt

### 13.1 Dual Connection Table System -- HIGH

Two tables (`Connection` and `ConnectionRequest`) serve the same purpose with dual-write pattern. Risk of data inconsistency.

**Recommendation:** Migrate to single `Connection` table.

### 13.2 JWT Revocation Gap -- MEDIUM

30-day JWTs cannot be forcibly revoked. Banned users retain valid tokens until expiry.

**Recommendation:** Add Redis-backed JWT blocklist or switch to database sessions.

### 13.3 In-Memory Lead Rate Limiting -- MEDIUM

In-memory Map doesn't work across Vercel serverless instances.

**Recommendation:** Use Upstash Redis (already available).

### 13.4 NextAuth.js Beta -- MEDIUM

Using `next-auth@5.0.0-beta.30`. Beta software may have breaking changes.

**Recommendation:** Pin version (done), plan migration when v5 stabilizes.

### 13.5 No CIDR Parsing -- LOW

IP blocking uses exact string match, not CIDR range matching.

### 13.6 Unread Count Performance -- LOW-MEDIUM

O(n) queries per conversation for unread counts.

**Recommendation:** Denormalize to `unreadCount` field on `ConversationParticipant`.

### 13.7 IP Block Only on Signup -- LOW

Blocked IPs can still log in with existing accounts.

### 13.8 Single Global CSS File -- LOW

`globals.css` is large. Feature-specific CSS files (e.g., `rentals.css`) are a good pattern to continue.

---

## 14. Suggested Improvements

### Architecture

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Consolidate to single Connection table | Eliminate dual-write complexity |
| **Medium** | Add WebSocket/SSE for real-time messaging | Polling doesn't scale for active conversations |
| **Low** | Split remaining global CSS into feature modules | Continue the rentals.css pattern |

### Security

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Password reset flow (email-based) | No recovery mechanism |
| **High** | Email verification on signup | Prevent unowned email accounts |
| **High** | JWT blocklist or database sessions | Enable immediate session invalidation |
| **Medium** | IP block check on login | Currently only on signup |

### Scalability

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Redis-based lead rate limiter | In-memory doesn't work serverless |
| **Medium** | Denormalize unread counts | N+1 query pattern |
| **Medium** | Database connection pooling | Serverless can exhaust connections |

### Developer Experience

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Expand test suite (Vitest + Playwright) | Limited test coverage |
| **High** | CI/CD with build/lint/test checks | Prevent broken deployments |
| **Medium** | API documentation (OpenAPI) | Document contracts |
| **Medium** | Error monitoring (Sentry) | Server errors only in Vercel logs |

---

## Summary Statistics

| Metric | Value |
|---|---|
| Source files | ~335 |
| Prisma schema lines | 970 |
| Prisma models | 30+ |
| Prisma enums | 20+ |
| API routes | 55 |
| App pages/routes | 30+ |
| React components | 50+ |
| CLI scripts | 45+ |
| Rental sources | 7 (6 active) |
| Email templates | 5 |
| Email block types | 9 |
| Trusted news sources | 30+ |
| Affiliate partners | 10+ |
| GeoJSON district aliases | 300+ |
| Total commits | 259 |
| Project started | 22 February 2026 |

---

*End of technical documentation.*
