# GlobeScraper — Technical Documentation

> **Last updated:** 25 February 2026  
> **Repository:** `weegienamja/Globescraper` — branch `main`

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Folder & Module Structure](#2-folder--module-structure)
3. [Data Flow](#3-data-flow)
4. [Core Features](#4-core-features)
5. [Database Schema](#5-database-schema)
6. [Security Overview](#6-security-overview)
7. [External Integrations](#7-external-integrations)
8. [Potential Risks & Technical Debt](#8-potential-risks--technical-debt)
9. [Suggested Improvements](#9-suggested-improvements)

---

## 1. High-Level Architecture

### 1.1 Frontend Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 14.2.5 |
| **Language** | TypeScript | 5.5.4 |
| **UI library** | React | 18.3.1 |
| **Styling** | Global CSS with BEM class naming | — |
| **State** | React server components + `useState`/`useTransition` for client interactivity | — |
| **Session client** | `next-auth/react` `<SessionProvider>` | 5.0.0-beta.30 |
| **Schema validation** | Zod (shared client + server) | 3.23.8 |
| **Theming** | Dark/light mode via inline `<script>` (FOUC prevention) + `data-theme` attribute | — |
| **Analytics** | Google Analytics 4 via global site tag + typed event helpers | — |

There is no CSS framework (Tailwind, Bootstrap, etc.). All styles live in a single `app/globals.css` file using BEM-style class names (e.g., `.community-header__sub`, `.admin__modal-body`, `.msg-input__form`).

### 1.2 Backend Stack

| Layer | Technology | Version |
|---|---|---|
| **Runtime** | Node.js | ≥ 18.17.0 |
| **Framework** | Next.js API routes + React Server Components + Server Actions | 14.2.5 |
| **ORM** | Prisma Client | 5.18.0 |
| **Auth** | NextAuth.js v5 (Auth.js) with JWT strategy | 5.0.0-beta.30 |
| **Password hashing** | bcryptjs (cost factor 12) | 3.0.3 |
| **Rate limiting** | Upstash Redis (`@upstash/ratelimit`) | 2.0.8 |
| **File uploads** | `@vercel/blob` | 2.3.0 |
| **HTML sanitization** | DOMPurify (for scraped content) | 3.3.1 |

There is no Express, Fastify, or standalone server. The entire backend runs through Next.js's built-in routing (API route handlers + server actions).

### 1.3 Database

| Property | Detail |
|---|---|
| **Engine** | MySQL (MariaDB-compatible) |
| **Host** | `srv2112.hstgr.io:3306` (Hostinger) |
| **Database** | `u766245977_globescraper_d` |
| **ORM** | Prisma 5.18.0 with declarative schema |
| **Migrations** | Prisma Migrate (10 migration files) |

### 1.4 Auth System

The application uses **NextAuth.js v5 (beta)** with a **JWT session strategy**:

- **Providers:** Google OAuth 2.0 + Credentials (email/password)
- **Adapter:** `@auth/prisma-adapter` — auto-manages `Account`, `Session`, `VerificationToken` tables
- **Session storage:** Stateless JWT cookie (30-day max age). No server-side session store.
- **Token contents:** `sub` (user ID), `role`, `hasProfile`, `avatarUrl`
- **Cookie names:** `authjs.session-token` (HTTP) / `__Secure-authjs.session-token` (HTTPS)

### 1.5 Hosting Environment

| Signal | Detail |
|---|---|
| **Platform** | Vercel (detected from `@vercel/blob`, `start` script with `-H 0.0.0.0`, remote image patterns for `*.public.blob.vercel-storage.com`) |
| **Build command** | `prisma generate && prisma migrate deploy && next build` |
| **Start command** | `next start -H 0.0.0.0 -p $PORT` |
| **Database** | Hostinger MySQL |
| **Redis** | Upstash Redis (serverless, for rate limiting) |
| **File storage** | Vercel Blob Storage |

---

## 2. Folder & Module Structure

```
globescraper_nextjs/
├── app/                    # Next.js App Router — pages, layouts, API routes
│   ├── layout.tsx          # Root layout (fonts, theme script, GA4, providers)
│   ├── page.tsx            # Homepage (scraped HTML content)
│   ├── globals.css         # All application styles (BEM conventions)
│   ├── not-found.tsx       # Custom 404 page
│   ├── [slug]/             # Dynamic blog post pages (SSG)
│   ├── about/              # Static about page
│   ├── blog/               # Blog listing page
│   ├── login/              # Login page + form component
│   ├── signup/             # Signup page + form component
│   ├── create-profile/     # Teaching profile onboarding form
│   ├── dashboard/          # Authenticated user dashboard
│   │   ├── requests/       # Connections & requests management (tabbed)
│   │   └── messages/       # DM inbox + conversation views
│   ├── community/          # Public community directory
│   │   ├── actions.ts      # Server actions (connect, block, hide, report)
│   │   ├── image-actions.ts# Server actions (avatar + gallery upload)
│   │   ├── [userId]/       # Individual user profile page
│   │   └── edit-profile/   # Community profile editor
│   ├── meetups/            # Meetup listing, detail, creation
│   │   ├── actions.ts      # Server actions (CRUD, RSVP)
│   │   ├── [id]/           # Meetup detail page
│   │   └── new/            # Create meetup form
│   ├── admin/              # Admin dashboard & management
│   │   ├── page.tsx        # Metrics, leads, users, reports
│   │   ├── admin-actions.ts# Server actions (ban, suspend, hide, etc.)
│   │   ├── admin-client-sections.tsx  # Client-side admin panels
│   │   └── reports-section.tsx        # Reports table (server component)
│   ├── api/                # REST API route handlers
│   │   ├── auth/           # NextAuth.js catch-all route
│   │   ├── signup/         # User registration
│   │   ├── lead/           # Public lead capture
│   │   ├── profile/        # Teaching profile CRUD
│   │   ├── connections/    # Connection CRUD + pending count
│   │   ├── messages/       # Conversation list, messages, unread count
│   │   ├── health/         # Health check endpoint
│   │   └── admin/          # Admin-only APIs (users, leads, audit, IPs)
│   ├── how-it-works-to-teach-english/  # Static content page
│   ├── robots.txt/         # Dynamic robots.txt route
│   └── sitemap.xml/        # Dynamic XML sitemap route
│
├── components/             # Shared React components
│   ├── SiteLayout.tsx      # Header, footer, navigation, avatar dropdown
│   ├── Providers.tsx       # SessionProvider wrapper
│   ├── AnalyticsProvider.tsx # Auto page-view/scroll/click tracking
│   ├── JsonLd.tsx          # Structured data components (WebSite, Article, Breadcrumb)
│   ├── HtmlContent.tsx     # Scraped HTML renderer
│   ├── Lightbox.tsx        # Image gallery lightbox
│   ├── ThemeToggle.tsx     # Dark/light mode switch
│   ├── RevealOnScroll.tsx  # Intersection Observer animation wrapper
│   ├── BlogCardTracker.tsx # Blog card click analytics
│   └── SkeletonLoader.tsx  # Loading placeholder
│
├── lib/                    # Shared server-side utilities
│   ├── prisma.ts           # Singleton PrismaClient (HMR-safe)
│   ├── auth.ts             # requireAuth() / requireAdmin() guards
│   ├── security.ts         # logSecurityEvent() / isIpBlocked()
│   ├── rate-limit.ts       # Upstash Redis rate limiters (login, connection, DM)
│   ├── connections.ts      # canonicalPair(), areConnected(), isBlocked(), isUserActive()
│   ├── content.ts          # Scraped HTML content loader + cleaner
│   ├── contentImages.ts    # Blog hero image mapping
│   ├── site.ts             # Site config (name, URL, nav items, social links)
│   ├── analytics.ts        # GA4 typed event helpers with dedup
│   └── validations/        # Zod schemas + enum constants
│       ├── profile.ts      # Signup + teaching profile schemas
│       └── community.ts    # Community profile, connection, meetup, report, message schemas
│
├── prisma/
│   ├── schema.prisma       # Database schema (27 models, 14 enums)
│   └── migrations/         # 10 Prisma migration directories
│
├── content/                # Static content (scraped from Zyrosite)
│   ├── pages.json          # Page metadata (title, description)
│   ├── posts.json          # Blog post metadata (slug, title, dates, author)
│   ├── pages/              # HTML files for static pages
│   └── posts/              # HTML files for blog posts (6 articles)
│
├── public/                 # Static assets (images, favicon)
├── scripts/                # CLI utilities
│   ├── seed-admin.ts       # Create/update admin user
│   ├── check-build.js      # Verify .next exists
│   └── startup-log.js      # Log deployment diagnostics
│
├── types/
│   └── next-auth.d.ts      # NextAuth type augmentation (role, hasProfile, avatarUrl)
│
├── auth.ts                 # NextAuth.js configuration (providers, callbacks)
├── middleware.ts            # Edge middleware (rate limiting, auth cookie guard)
├── next.config.js          # Next.js config (images, security headers)
├── package.json            # Dependencies & scripts
└── tsconfig.json           # TypeScript configuration
```

### Major Modules by Responsibility

| Module | Responsibility |
|---|---|
| **Server Actions** | `community/actions.ts`, `community/image-actions.ts`, `meetups/actions.ts`, `admin/admin-actions.ts` — All business logic for mutations |
| **API Route Handlers** | `api/**/route.ts` — REST endpoints for CRUD, auth, admin operations |
| **Auth** | `auth.ts` + `middleware.ts` + `lib/auth.ts` — Three-layer auth: edge → server → helper |
| **Data Access** | `lib/prisma.ts` + `lib/connections.ts` + `lib/security.ts` — DB singleton + domain queries |
| **Validation** | `lib/validations/*.ts` — Zod schemas shared between client forms and server handlers |
| **Rate Limiting** | `lib/rate-limit.ts` — Three Upstash Redis limiters |
| **Content** | `lib/content.ts` + `content/**` — Static HTML/JSON content pipeline |
| **Analytics** | `lib/analytics.ts` + `components/AnalyticsProvider.tsx` — GA4 event system |

---

## 3. Data Flow

### 3.1 Standard Page Request (Server Component)

```
Browser GET /community
   │
   ├─▶ middleware.ts
   │     ├─ Check if route matches protected paths
   │     ├─ Verify session cookie exists
   │     └─ Redirect to /login if missing (for sub-routes)
   │
   ├─▶ app/community/page.tsx  (React Server Component)
   │     ├─ await auth()       → decode JWT → resolve session
   │     ├─ prisma.block.findMany(...)
   │     ├─ prisma.profile.findMany({ where: { hiddenFromCommunity: false, ... } })
   │     └─ Return JSX (streamed to client as HTML)
   │
   └─▶ Browser receives rendered HTML + JS hydration bundle
```

### 3.2 API Route Request

```
Browser POST /api/connections  (JSON body)
   │
   ├─▶ middleware.ts           → passes through (no special handling)
   │
   ├─▶ app/api/connections/route.ts  → POST handler
   │     ├─ await auth()              → verify JWT session
   │     ├─ Zod validation            → parse + validate body
   │     ├─ Rate limit check          → Upstash Redis (10/24h)
   │     ├─ Business logic checks     → isBlocked(), isUserActive()
   │     ├─ prisma.connection.create() → insert row
   │     ├─ prisma.connectionRequest.upsert() → legacy sync
   │     └─ Return NextResponse.json({ ok: true })
   │
   └─▶ Browser receives JSON response
```

### 3.3 Server Action Flow

```
Browser interaction (form submit / button click)
   │
   ├─▶ Client component calls server action (e.g., sendConnectionRequest)
   │
   ├─▶ app/community/actions.ts  → "use server"
   │     ├─ await auth()
   │     ├─ Rate limit check
   │     ├─ Zod validation
   │     ├─ Prisma queries/mutations
   │     └─ Return { ok: true } or { error: "..." }
   │
   └─▶ Client receives result, calls router.refresh() if needed
```

---

## 4. Core Features

### 4.1 Authentication

| Aspect | Detail |
|---|---|
| **What it does** | User registration (email/password), login (email/password + Google OAuth), session management, role-based access |
| **Routes** | `POST /api/signup`, `/api/auth/[...nextauth]` (GET + POST), `/login`, `/signup` |
| **Tables** | `User`, `Account`, `Session`, `VerificationToken` |
| **Background jobs** | None — `lastLoginAt` update and `logSecurityEvent` are fire-and-forget promises |
| **Security** | bcrypt (cost 12), JWT session (30-day), login rate limiting (5/15min), IP blocking on signup, disabled/banned/deleted user blocking in `authorize()` + `signIn()` callback |

**Registration flow:** Client-side form → POST `/api/signup` (Zod validation, IP block check, duplicate email check, bcrypt hash) → `User` record created → auto sign-in via `signIn("credentials")` → redirect to `/create-profile`.

**Login flow:** Client-side form → `signIn("credentials", { redirect: false })` → NextAuth `authorize()` (find user, bcrypt compare, status checks) → JWT minted → redirect to dashboard. Google: `signIn("google")` → OAuth flow → `signIn` callback blocks banned users → JWT minted.

### 4.2 User Profiles

There are two profile tiers:

**Teaching Profile** (created at `/create-profile`):
| Aspect | Detail |
|---|---|
| **What it does** | Captures teaching qualifications, target countries, timeline, savings |
| **Routes** | `POST /api/profile`, `GET /api/profile`, `/create-profile` |
| **Tables** | `Profile`, `ProfileTargetCountry` |
| **Fields** | passportCountry, degreeStatus, nativeEnglish, teachingExperience, certificationStatus, desiredStartTimeline, savingsBand, targetCountries |

**Community Profile** (extension via `/community/edit-profile`):
| Aspect | Detail |
|---|---|
| **What it does** | Public-facing profile with display name, bio, avatar, gallery, meetup intents, visibility settings |
| **Routes** | Server action `updateCommunityProfile`, image-actions (`uploadAvatar`, `uploadGalleryImage`, etc.), `/community/[userId]`, `/community/edit-profile` |
| **Tables** | `Profile` (same row), `ProfileImage`, `ProfileTargetCountry` |
| **Fields** | displayName, bio, currentCountry, currentCity, avatarUrl, visibility, meetupCoffee/CityTour/JobAdvice/StudyGroup/LanguageExchange, hiddenFromCommunity |

### 4.3 Connections

| Aspect | Detail |
|---|---|
| **What it does** | Send/accept/decline/remove friend-style connections between users |
| **Routes** | `GET/POST/PATCH/DELETE /api/connections`, `GET /api/connections/pending-count`, server action `sendConnectionRequest` + `respondToConnection` in `community/actions.ts` |
| **Tables** | `Connection` (canonical pair: userLowId < userHighId) + `ConnectionRequest` (legacy: fromUserId → toUserId) |
| **Security** | Rate limited (10 requests/24h), block checks, active user checks, duplicate prevention |

**Dual-write pattern:** The system maintains two connection tables. The new `Connection` table uses canonical ordering (lower UUID always goes in `userLowId`). The legacy `ConnectionRequest` table uses directional sender/receiver. All writes go to both tables with try/catch on the legacy write. Reads prefer whichever table has data, with fallback to legacy.

**Connection lifecycle:** Send → `PENDING` → Accept (`ACCEPTED`) or Decline (`DECLINED`). Accepted connections unlock messaging. Either party can remove. Declined users can re-request.

### 4.4 Messaging (Direct Messages)

| Aspect | Detail |
|---|---|
| **What it does** | 1-on-1 direct messaging between connected users |
| **Routes** | `GET /api/messages` (conversations list), `GET/POST /api/messages/[conversationId]` (messages + send), `GET /api/messages/unread-count`, `/dashboard/messages`, `/dashboard/messages/[conversationId]` |
| **Tables** | `Conversation`, `ConversationParticipant`, `Message` |
| **Security** | Rate limited (30 msg/min), connection required, block check, participant verification, Zod validation |

**Conversation creation:** When user A messages user B for the first time, `POST /api/messages/new` checks for an existing DM between them. If none exists, creates a `Conversation` + two `ConversationParticipant` rows. If one exists, reuses it.

**Read receipts:** Each `ConversationParticipant` has a `lastReadAt` timestamp. Opening a conversation updates it. Unread status is computed by comparing `lastReadAt` against the latest message timestamp.

**UI layout:** Split layout — left sidebar shows connections (quick-start new chats), right panel shows conversation list or active conversation with date-grouped messages.

### 4.5 Meetups

| Aspect | Detail |
|---|---|
| **What it does** | Create, browse, RSVP to in-person meetups in SEA cities |
| **Routes** | `/meetups`, `/meetups/[id]`, `/meetups/new`, server actions in `meetups/actions.ts` |
| **Tables** | `Meetup`, `MeetupAttendee` |
| **Actions** | `createMeetup`, `updateMeetup`, `cancelMeetup`, `rsvpMeetup`, `leaveMeetup` |
| **Security** | Auth required, profile required (displayName), future date validation, max attendee enforcement, creator/admin-only cancel |

### 4.6 Blocking & Reporting

| Aspect | Detail |
|---|---|
| **What it does** | Users can block others (bidirectional exclusion) and report users/meetups |
| **Routes** | Server actions `blockUser`, `unblockUser`, `submitReport` in `community/actions.ts` |
| **Tables** | `Block` (unique pair), `Report` (polymorphic: USER or MEETUP target, SPAM/HARASSMENT/SCAM/OTHER reason) |
| **Effect of blocking** | Blocked users are excluded from community listing, meetup attendee lists, messaging, and connection requests |

### 4.7 Leads

| Aspect | Detail |
|---|---|
| **What it does** | Public lead capture form for prospective teachers (pre-registration interest) |
| **Routes** | `POST /api/lead` (public), `PATCH /api/admin/leads` (admin) |
| **Tables** | `Lead` (email, name, message, source, status, adminNotes) |
| **Security** | In-memory rate limiting (5/min/IP), CORS origin whitelist (globescraper.com), Zod validation |
| **Admin workflow** | Leads appear in admin dashboard table. Admin can update status (NEW → CONTACTED → CONVERTED → CLOSED) and add notes. All changes audit-logged. |

### 4.8 Admin Panel

| Aspect | Detail |
|---|---|
| **What it does** | Comprehensive admin dashboard for user management, moderation, analytics |
| **Routes** | `/admin` (page), `/api/admin/users` (CRUD), `/api/admin/users/[userId]/stats`, `/api/admin/audit-log`, `/api/admin/blocked-ips`, `/api/admin/leads`, server actions in `admin-actions.ts` |
| **Tables** | All tables (read), `AdminAuditLog` (write), `BlockedIp` (CRUD), `UserSecurityEvent` (read) |

**Dashboard metrics (13 cards):**
- Total users, new users this week, total leads, total profiles
- Open reports, active meetups, total connections, total messages
- Blocked IPs, banned user count, suspended user count
- Profile completion rate

**User management modal features:**
- Search by name/email with status filter + pagination
- View user detail: email, role, status, creation date, last login, display name, location, bio, community visibility (Hidden/Visible badge)
- Edit: name, email, bio, role, status
- Actions: Suspend, Ban, Reactivate, Delete (soft), Hide/Unhide from Community
- Stats: connection count, message count, recent security events table

**Admin actions (server actions):**
- `adminDisableUser` — Suspends user, sets profile private, invalidates sessions
- `adminBanUser` — Bans user, sets profile private, invalidates sessions, deletes connections
- `adminReactivateUser` — Restores user to active
- `adminToggleHideUser` — Hides/unhides user from all community views (profile stays intact)
- `adminCancelMeetup` — Cancels a meetup
- `adminDismissReport` — Deletes a report

All admin actions are audit-logged with before/after state.

### 4.9 Content & Blog

| Aspect | Detail |
|---|---|
| **What it does** | Serves statically generated content pages and blog posts scraped from Zyrosite |
| **Routes** | `/`, `/about`, `/blog`, `/how-it-works-to-teach-english`, `/[slug]` (blog posts) |
| **Data source** | `content/pages.json`, `content/posts.json`, `content/pages/*.html`, `content/posts/*.html` |
| **Processing** | `cleanScrapedHtml()` strips Zyrosite chrome, fixes `.html` links, normalizes images |
| **SSG** | Blog posts use `generateStaticParams()` for static generation at build time |

### 4.10 SEO

- **JSON-LD:** `WebSiteJsonLd` (root layout), `ArticleJsonLd` + `BreadcrumbJsonLd` (blog posts)
- **Sitemap:** Dynamic XML sitemap at `/sitemap.xml` (static pages + blog posts)
- **Robots:** Dynamic `robots.txt` — allows all, disallows admin/api/auth routes
- **Meta tags:** OG + Twitter cards generated per-page from content metadata

---

## 5. Database Schema

### 5.1 Entity-Relationship Overview

```
User ─────────────── Profile ─────── ProfileTargetCountry
 │                      │
 │                      └──────────── ProfileImage
 │
 ├── Account (OAuth)
 ├── Session (DB sessions — unused with JWT, kept for adapter)
 │
 ├── ConnectionRequest ◄──── Legacy connection system (directional)
 ├── Connection ◄─────────── New connection system (canonical pair)
 │
 ├── ConversationParticipant ── Conversation ── Message
 │
 ├── MeetupAttendee ── Meetup
 │
 ├── Block (blocker ↔ blocked)
 ├── Report (reporter → target)
 │
 ├── AdminAuditLog
 └── UserSecurityEvent

Standalone:
 ├── Lead
 ├── WaitlistEntry
 ├── BlockedIp
 └── VerificationToken
```

### 5.2 All Tables

#### `User`
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, default uuid() | |
| name | String? | | |
| email | String | Unique, VARCHAR(255) | |
| emailVerified | DateTime? | | OAuth-based verification |
| passwordHash | String? | VARCHAR(255) | bcrypt hash (cost 12) |
| role | Enum(USER, ADMIN) | Default USER | |
| status | Enum(ACTIVE, SUSPENDED, BANNED, DELETED) | Default ACTIVE | |
| disabled | Boolean | Default false | Quick toggle for blocking login |
| image | String? | | OAuth avatar URL |
| lastLoginAt | DateTime? | | Updated on each login |
| deletedAt | DateTime? | | Soft delete timestamp |
| createdAt | DateTime | Default now() | |
| updatedAt | DateTime | Auto-updated | |

#### `Account`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User, Cascade delete |
| type | String | |
| provider | String | |
| providerAccountId | String | |
| refresh_token | Text? | |
| access_token | Text? | |
| expires_at | Int? | |
| token_type | String? | |
| scope | String? | |
| id_token | Text? | |
| session_state | String? | |

Indexes: Unique(`provider`, `providerAccountId`), Index(`userId`)

#### `Session`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| sessionToken | String | Unique |
| userId | String | FK → User |
| expires | DateTime | |

Index: `userId`. Note: With JWT strategy, this table is mostly unused but maintained for the PrismaAdapter.

#### `VerificationToken`
| Column | Type | Constraints |
|---|---|---|
| identifier | String | |
| token | String | Unique |
| expires | DateTime | |

Unique: (`identifier`, `token`)

#### `Lead`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR(255) | Indexed |
| name | String? | |
| message | Text? | |
| source | String? | |
| status | Enum(NEW, CONTACTED, CONVERTED, CLOSED) | Default NEW, Indexed |
| adminNotes | Text? | |
| deleted | Boolean | Default false |
| createdAt | DateTime | Indexed |
| updatedAt | DateTime | Auto |

#### `WaitlistEntry`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| email | String | Unique |
| createdAt | DateTime | Default now() |

#### `AdminAuditLog`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| adminUserId | String | FK → User, Indexed |
| actionType | VARCHAR(50) | e.g., BAN_USER, HIDE_USER, UPDATE_LEAD |
| targetType | VARCHAR(50) | e.g., USER, LEAD, MEETUP, REPORT |
| targetId | VARCHAR(191) | |
| targetUserId | VARCHAR(191)? | Indexed |
| metadata | Text? | |
| beforeJson | Text? | JSON snapshot of pre state |
| afterJson | Text? | JSON snapshot of post state |
| createdAt | DateTime | Indexed |

#### `Profile`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userId | String | Unique, FK → User |
| passportCountry | VARCHAR(100)? | |
| degreeStatus | Enum | Default NONE |
| nativeEnglish | Boolean | Default false |
| teachingExperience | Enum | Default NONE |
| certificationStatus | Enum | Default NONE |
| desiredStartTimeline | Enum | Default RESEARCHING |
| savingsBand | Enum | Default MEDIUM |
| displayName | VARCHAR(50)? | |
| bio | Text? | |
| currentCountry | VARCHAR(100)? | Indexed |
| currentCity | VARCHAR(100)? | Indexed |
| avatarUrl | VARCHAR(500)? | |
| visibility | Enum(PRIVATE, MEMBERS_ONLY, PUBLIC) | Default MEMBERS_ONLY, Indexed |
| meetupCoffee | Boolean | Default false |
| meetupCityTour | Boolean | Default false |
| meetupJobAdvice | Boolean | Default false |
| meetupStudyGroup | Boolean | Default false |
| meetupLanguageExchange | Boolean | Default false |
| hiddenFromCommunity | Boolean | Default false |
| createdAt | DateTime | |
| updatedAt | DateTime | Indexed |

#### `ProfileTargetCountry`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| profileId | String | FK → Profile, Indexed |
| country | Enum(VIETNAM, THAILAND, CAMBODIA, INDONESIA, PHILIPPINES, MALAYSIA) | |

Unique: (`profileId`, `country`)

#### `ProfileImage`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| profileId | String | FK → Profile, Indexed |
| url | VARCHAR(500) | |
| sortOrder | Int | Default 0 |
| createdAt | DateTime | |

#### `ConnectionRequest` (Legacy)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| fromUserId | String | FK → User |
| toUserId | String | FK → User, Indexed |
| status | Enum(PENDING, ACCEPTED, DECLINED, BLOCKED) | Default PENDING, Indexed |
| message | VARCHAR(300)? | |
| createdAt | DateTime | Indexed |
| updatedAt | DateTime | |

Unique: (`fromUserId`, `toUserId`)

#### `Connection` (New, Canonical)
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userLowId | String | FK → User |
| userHighId | String | FK → User, Indexed |
| requestedByUserId | String | Indexed |
| status | Enum(PENDING, ACCEPTED, REJECTED) | Default PENDING, Indexed |
| createdAt | DateTime | |
| acceptedAt | DateTime? | |
| updatedAt | DateTime | |

Unique: (`userLowId`, `userHighId`)

#### `Conversation`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| type | Enum(DM) | Default DM |
| createdAt | DateTime | |

#### `ConversationParticipant`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| conversationId | String | FK → Conversation |
| userId | String | FK → User, Indexed |
| lastReadAt | DateTime? | |

Unique: (`conversationId`, `userId`)

#### `Message`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| conversationId | String | Indexed with createdAt |
| senderId | String | FK → User, Indexed |
| body | Text | |
| createdAt | DateTime | |
| deletedAt | DateTime? | Soft delete |

#### `Meetup`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| createdByUserId | String | FK → User, Indexed |
| title | VARCHAR(200) | |
| description | Text | |
| country | VARCHAR(100) | Indexed |
| city | VARCHAR(100) | Indexed |
| dateTime | DateTime | Indexed |
| locationHint | VARCHAR(200)? | |
| maxAttendees | Int? | |
| visibility | Enum(MEMBERS_ONLY, PUBLIC) | Default MEMBERS_ONLY |
| status | Enum(ACTIVE, CANCELLED) | Default ACTIVE, Indexed |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### `MeetupAttendee`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| meetupId | String | FK → Meetup |
| userId | String | FK → User, Indexed |
| status | Enum(GOING, INTERESTED, LEFT) | Default GOING |
| createdAt | DateTime | |

Unique: (`meetupId`, `userId`)

#### `Block`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| blockerUserId | String | FK → User |
| blockedUserId | String | FK → User, Indexed |
| createdAt | DateTime | |

Unique: (`blockerUserId`, `blockedUserId`)

#### `Report`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| reporterUserId | String | FK → User, Indexed |
| targetType | Enum(USER, MEETUP) | |
| targetId | VARCHAR(191) | Indexed with targetType |
| reason | Enum(SPAM, HARASSMENT, SCAM, OTHER) | |
| details | VARCHAR(1000)? | |
| createdAt | DateTime | Indexed |

#### `UserSecurityEvent`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User, Indexed |
| eventType | VARCHAR(50) | Indexed (e.g., "login", "signup") |
| ipAddress | VARCHAR(45)? | IPv4 + IPv6 support |
| userAgent | VARCHAR(500)? | |
| createdAt | DateTime | Indexed |

#### `BlockedIp`
| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| ipCidr | VARCHAR(50) | Indexed |
| reason | VARCHAR(500)? | |
| createdAt | DateTime | |
| expiresAt | DateTime? | Indexed (null = permanent) |

### 5.3 Enums (14 total)

| Enum | Values |
|---|---|
| Role | USER, ADMIN |
| UserStatus | ACTIVE, SUSPENDED, BANNED, DELETED |
| LeadStatus | NEW, CONTACTED, CONVERTED, CLOSED |
| DegreeStatus | NONE, IN_PROGRESS, BACHELORS, MASTERS |
| TeachingExperience | NONE, LT1_YEAR, ONE_TO_THREE, THREE_PLUS |
| CertificationStatus | NONE, IN_PROGRESS, COMPLETED |
| TargetCountry | VIETNAM, THAILAND, CAMBODIA, INDONESIA, PHILIPPINES, MALAYSIA |
| DesiredStartTimeline | ASAP, ONE_TO_THREE_MONTHS, THREE_TO_SIX_MONTHS, RESEARCHING |
| SavingsBand | LOW, MEDIUM, HIGH |
| ProfileVisibility | PRIVATE, MEMBERS_ONLY, PUBLIC |
| ConnectionStatus | PENDING, ACCEPTED, DECLINED, BLOCKED |
| CanonicalConnectionStatus | PENDING, ACCEPTED, REJECTED |
| MeetupVisibility | MEMBERS_ONLY, PUBLIC |
| MeetupStatus | ACTIVE, CANCELLED |
| AttendeeStatus | GOING, INTERESTED, LEFT |
| ReportTargetType | USER, MEETUP |
| ReportReason | SPAM, HARASSMENT, SCAM, OTHER |
| ConversationType | DM |

---

## 6. Security Overview

### 6.1 Password Hashing

- **Algorithm:** bcrypt via `bcryptjs` (pure JavaScript, no native addon)
- **Cost factor:** 12 (used in signup route and seed script)
- **Storage:** `User.passwordHash` column (VARCHAR 255)
- **Comparison:** `bcrypt.compare()` in NextAuth `authorize()` callback
- **Note:** Migrated from argon2 to bcryptjs for Vercel serverless compatibility

### 6.2 Session Management

- **Strategy:** Stateless JWT (not database sessions)
- **Max age:** 30 days
- **Cookie:** `authjs.session-token` (HTTP) / `__Secure-authjs.session-token` (HTTPS)
- **Token payload:** `sub` (user ID), `role`, `hasProfile`, `avatarUrl`
- **Invalidation:** Banning/suspending a user deletes `Session` table rows (belt-and-suspenders) and blocks login in `authorize()` + `signIn()` callback. JWT itself cannot be forcibly revoked before expiry.

### 6.3 Rate Limiting

| Limiter | Scope | Limit | Window | Backing |
|---|---|---|---|---|
| Login attempts | Per IP | 5 | 15 minutes (sliding) | Upstash Redis |
| Connection requests | Per user | 10 | 24 hours (sliding) | Upstash Redis |
| Direct messages | Per user | 30 | 1 minute (sliding) | Upstash Redis |
| Lead submissions | Per IP | 5 | 1 minute | In-memory Map |

All Redis-backed limiters gracefully degrade to no-op if Upstash credentials are missing (local development).

### 6.4 Role-Based Authorization

Three-layer model:

1. **Edge middleware** (`middleware.ts`): Cookie presence check. Fast rejection before app code runs. Protects `/admin`, `/dashboard`, `/create-profile`, community/meetup sub-routes.
2. **Server-side auth** (`auth()` from NextAuth): Decodes JWT to get session with user ID and role. Used in every server component and API route handler.
3. **Helper guards** (`lib/auth.ts`): `requireAuth()` redirects to `/login`; `requireAdmin()` additionally checks `role === "ADMIN"` and redirects to `/`.

Admin-only routes (`/api/admin/*`) additionally check `session.user.role !== "ADMIN"` and return 403.

### 6.5 Input Validation

- **Zod schemas** for all user input: signup, profile creation, community profile, connection requests, meetups, reports, messages, admin edits, lead submissions
- **Server-side enforcement:** All Zod validation runs server-side (in API routes and server actions), never trusted from client alone
- **SQL injection:** Mitigated by Prisma's parameterized queries (no raw SQL in application code)
- **XSS:** Scraped HTML content is cleaned by `cleanScrapedHtml()` in `lib/content.ts`; DOMPurify is available as a dependency
- **Path traversal:** `lib/content.ts` validates resolved paths against content directory

### 6.6 HTTP Security Headers

Applied globally via `next.config.js`:

| Header | Value |
|---|---|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-XSS-Protection | 1; mode=block |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), interest-cohort=() |

### 6.7 Additional Security Measures

- **IP blocking:** Admin can block IPs (with optional expiry). Checked on signup. Stored in `BlockedIp` table.
- **Security event logging:** Login and signup events logged to `UserSecurityEvent` with IP + user agent. Visible in admin user detail modal.
- **Audit trail:** All admin actions logged to `AdminAuditLog` with before/after state diffs.
- **CORS:** Lead API explicitly whitelists `globescraper.com` origins only.
- **User blocking:** Bidirectional block system excludes blocked users from all social features.
- **Admin hide:** `hiddenFromCommunity` flag hides users from community listing without their knowledge. Admin-only toggle.

---

## 7. External Integrations

### 7.1 Google OAuth 2.0

- **Purpose:** Social login
- **Config:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` environment variables
- **Library:** NextAuth.js Google provider
- **Data flow:** Google redirects with authorization code → NextAuth exchanges for tokens → Creates/links `Account` record → Mints JWT

### 7.2 Upstash Redis

- **Purpose:** Distributed rate limiting
- **Config:** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- **Library:** `@upstash/ratelimit` + `@upstash/redis`
- **Usage:** Three sliding window rate limiters (login, connections, DMs)
- **Graceful degradation:** All limiters return null if credentials missing

### 7.3 Vercel Blob Storage

- **Purpose:** User-uploaded images (avatars, gallery)
- **Config:** Automatic via Vercel environment (no explicit env vars needed)
- **Library:** `@vercel/blob` (`put`, `del`)
- **File paths:** `avatars/{userId}/{timestamp}.{ext}`, `gallery/{userId}/{timestamp}.{ext}`
- **Validation:** JPEG/PNG/WebP only, 5MB max per file, max 5 gallery images per user

### 7.4 Google Analytics 4

- **Purpose:** Website analytics and event tracking
- **Config:** GA4 measurement ID in layout script tags
- **Library:** Custom typed helpers in `lib/analytics.ts`
- **Events tracked:** Page views, lead submissions, CTA clicks, outbound clicks, scroll depth (25/50/75/100%), affiliate clicks, blog card clicks, nav clicks
- **Auto-tracking:** `AnalyticsProvider` component captures route changes, outbound links, scroll milestones
- **Affiliate detection:** NordVPN, SafetyWing, Anker, TEFL/TESOL link patterns

### 7.5 Hostinger MySQL

- **Purpose:** Primary relational database
- **Connection:** `DATABASE_URL` environment variable
- **Shadow DB:** `SHADOW_DATABASE_URL` for Prisma migrations in development

---

## 8. Potential Risks & Technical Debt

### 8.1 Dual Connection Table System

**Risk: High**

Two tables (`Connection` and `ConnectionRequest`) serve the same purpose. Every write goes to both with try/catch on the legacy path. Reads fall back between them. This creates:
- Data inconsistency if one write succeeds and the other fails
- Complex query logic with fallback patterns
- Double storage cost
- Confusion for future developers

**Recommendation:** Migrate all data to the canonical `Connection` table and drop `ConnectionRequest`.

### 8.2 JWT Revocation Gap

**Risk: Medium**

JWTs have a 30-day max age and cannot be forcibly revoked. When an admin bans a user, the `Session` table rows are deleted, but since the session strategy is JWT (not database), the user's existing JWT remains valid until natural expiry. The `signIn` callback blocks new logins, but an existing token could theoretically be used for API calls.

**Recommendation:** Either switch to database session strategy, or add a server-side JWT blocklist (Redis-backed) for banned users.

### 8.3 In-Memory Rate Limiting (Lead API)

**Risk: Medium**

The lead API uses an in-memory `Map` for rate limiting. In a serverless environment (Vercel), each instance has its own memory space, making this ineffective — requests may hit different instances. The Map also resets on cold starts.

**Recommendation:** Use Upstash Redis (already available) for the lead rate limiter to match the other limiters.

### 8.4 No CIDR Parsing for IP Blocking

**Risk: Low**

`isIpBlocked()` does exact string matching on the `ipCidr` field instead of actual CIDR range matching. Blocking `192.168.1.0/24` would not match `192.168.1.50`.

**Recommendation:** Implement proper CIDR matching or clarify that only exact IPs are supported.

### 8.5 NextAuth.js Beta

**Risk: Medium**

The application uses `next-auth@5.0.0-beta.30`. Beta software may have breaking changes, security patches, or API modifications before stable release.

**Recommendation:** Pin the version (already done) and plan for migration when v5 stabilizes.

### 8.6 Unread Count Performance

**Risk: Low-Medium**

`/api/messages/unread-count` iterates all conversation participants for the user, then counts messages after `lastReadAt` for each conversation individually. This is O(n) queries where n = number of conversations.

**Recommendation:** Add a denormalized `unreadCount` field on `ConversationParticipant`, maintained via triggers or application-level increment/reset, to make unread count O(1).

### 8.7 No Email Service

**Risk: Low**

There is no email integration (no password reset, no email verification for credentials signup, no notification emails). Password recovery and email verification are absent.

### 8.8 IP Block Check Only on Signup

**Risk: Low**

`isIpBlocked()` is only called during user registration. Blocked IPs can still log in with existing accounts and use the API.

**Recommendation:** Add IP block check to the login middleware or the `authorize()` callback.

### 8.9 Single CSS File

**Risk: Low (DX)**

All styles live in a single `globals.css` file. As the application grows, this becomes harder to maintain, review, and avoid naming collisions.

### 8.10 No Automated Tests

**Risk: Medium**

There are no test files (unit, integration, or E2E). Manual testing is the only safety net for regressions.

### 8.11 Scraped HTML Content

**Risk: Low**

Blog/page content is scraped HTML from Zyrosite, cleaned at runtime. This is fragile — changes to the source site's HTML structure could break the cleaning logic. The content is also not editable through any CMS.

---

## 9. Suggested Improvements

### 9.1 Architecture

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Consolidate to single `Connection` table | Eliminate dual-write complexity and inconsistency risk |
| **Medium** | Add a proper CMS or Markdown-based content system | Replace scraped HTML with maintainable, editable content |
| **Medium** | Split `globals.css` into CSS modules per component/feature | Improve maintainability and prevent style collisions |
| **Low** | Add WebSocket or SSE for real-time messaging | Current polling-based approach doesn't scale for active conversations |

### 9.2 Security

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Add password reset flow (email-based) | Users with credentials login have no recovery mechanism |
| **High** | Add email verification on signup | Prevent account creation with unowned email addresses |
| **High** | Move to database sessions or add JWT blocklist | Enable immediate session invalidation on ban/suspend |
| **Medium** | Add IP block check on login (not just signup) | Blocked IPs can still use existing accounts |
| **Medium** | Add CSRF protection to API routes | Server actions have built-in CSRF protection, but plain API routes may need additional headers |
| **Low** | Implement proper CIDR matching | Make IP blocking more flexible |

### 9.3 Scalability

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Replace in-memory lead rate limiter with Upstash Redis | In-memory doesn't work across serverless instances |
| **Medium** | Denormalize unread message counts | Current N+1 query pattern won't scale with many conversations |
| **Medium** | Add database connection pooling | Vercel serverless can exhaust MySQL connections under load |
| **Low** | Add pagination to community profile listing | Currently capped at 50 results with no next page |
| **Low** | Add full-text search index | Current `contains` queries do full table scans |

### 9.4 Developer Experience

| Priority | Improvement | Reason |
|---|---|---|
| **High** | Add automated test suite (Vitest + Playwright) | No test coverage creates regression risk |
| **High** | Add CI/CD pipeline with build/lint/test checks | Prevent broken code from reaching production |
| **Medium** | Add API documentation (OpenAPI/Swagger) | Document API contracts for future development |
| **Medium** | Add error monitoring (Sentry or similar) | Server-side exceptions are only visible in Vercel logs |
| **Low** | Add Storybook for component development | Isolated component development and visual testing |
| **Low** | Add Prettier for consistent formatting | Currently no auto-formatting configured |

---

*End of technical documentation.*
