# GlobeScraper

**Teach English in Southeast Asia** — guides, community, meetups, and support for Vietnam, Thailand, Cambodia, and the Philippines.

Live at [globescraper.com](https://globescraper.com)

---

## Overview

GlobeScraper is a full-stack content + community platform built with Next.js 14 (App Router). It started as a migration from a website builder to gain full control over SEO, lead capture, and scalability — and has since grown into a community hub where teachers can connect, organise meetups, and share advice.

### Key Features

| Area | What it does |
|---|---|
| **Content & Blog** | Static pages and blog posts with server-rendered HTML, automatic `sitemap.xml` and `robots.txt`, Open Graph meta, and structured data |
| **Lead Capture** | `POST /api/lead` endpoint with Zod validation, stored in MySQL |
| **Auth** | Auth.js v5 (NextAuth) with credentials provider, JWT sessions, bcrypt password hashing, rate-limited login |
| **Community Profiles** | Public/members-only/private profiles with location, bio, target countries, and meetup intent tags |
| **Connections** | Send/accept/decline connection requests — rate-limited (10/24h), block-aware, no open DMs |
| **Meetups** | Create and browse public meetups filtered by country/city, RSVP (Going / Interested), capacity limits |
| **Safety & Moderation** | Block users, report users or meetups, admin tools to disable accounts / cancel meetups / dismiss reports |
| **Admin Dashboard** | Leads table, user/connection/meetup/report metrics, report queue with one-click actions |
| **Dark / Light Theme** | CSS custom-property design system with `[data-theme]` toggle — no Tailwind |
| **Security Headers** | HSTS, X-Frame-Options DENY, CSP-adjacent headers, XSS protection via `next.config.js` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router, Server Components, Server Actions) |
| Language | TypeScript 5.5 |
| Database | MySQL via [Prisma](https://www.prisma.io/) 5.18 |
| Auth | [Auth.js v5](https://authjs.dev/) (NextAuth) — JWT strategy, Credentials provider |
| Rate Limiting | [Upstash Redis](https://upstash.com/) — sliding-window rate limiters for login + connection requests |
| Validation | [Zod](https://zod.dev/) 3.23 |
| Sanitisation | [isomorphic-dompurify](https://github.com/kkomelin/isomorphic-dompurify) |
| Styling | Vanilla CSS with custom properties (dark/light themes) |
| Deployment | Vercel |

---

## Project Structure

```
app/
├── page.tsx                        # Homepage
├── blog/                           # Blog index
├── [slug]/                         # Dynamic blog posts + static pages
├── about/                          # About page
├── how-it-works-to-teach-english/  # Guide page
├── community/                      # Browse community profiles
│   ├── [userId]/                   # Public profile view + actions
│   └── edit-profile/               # Edit community profile form
├── meetups/                        # Browse upcoming meetups
│   ├── new/                        # Create meetup form
│   └── [id]/                       # Meetup detail + RSVP
├── dashboard/                      # User dashboard
│   └── requests/                   # Connection requests (tabs)
├── admin/                          # Admin dashboard + reports
├── login/                          # Login page
├── signup/                         # Signup page
├── create-profile/                 # Basic profile creation
└── api/
    ├── auth/[...nextauth]/         # Auth.js route handler
    ├── lead/                       # Lead capture endpoint
    ├── admin/leads/                # Admin leads API
    ├── signup/                     # Signup endpoint
    ├── profile/                    # Profile API
    └── health/                     # Health check
components/                         # Shared UI components
content/                            # Static HTML content + JSON manifests
lib/                                # Utilities, Prisma client, validations
prisma/                             # Schema + migrations
scripts/                            # Seed scripts
```

---

## Data Models

The Prisma schema defines these core models:

- **User** — Auth.js user with role (USER / ADMIN), disabled flag
- **Profile** — Extended community profile (displayName, bio, location, visibility, meetup intents, target countries)
- **ConnectionRequest** — Directional connection with status (PENDING → ACCEPTED / DECLINED / BLOCKED)
- **Meetup** — Public meetup with title, location, date/time, capacity, visibility, status
- **MeetupAttendee** — RSVP join table (GOING / INTERESTED)
- **Block** — User-to-user block
- **Report** — User-submitted reports against users or meetups with reason + details
- **Lead** — Captured lead from site forms
- **AuditLog** — Admin action audit trail

---

## Getting Started

### Prerequisites

- Node.js 18.17+
- MySQL 5.7+ (or MariaDB 10.3+)
- Upstash Redis account (for rate limiting)

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
SHADOW_DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/SHADOW_DATABASE"
AUTH_SECRET="generate-with-openssl-rand-base64-33"
NEXTAUTH_URL="http://localhost:3000"
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# (Optional) Seed an admin user
npm run seed:admin

# Start development server
npm run dev
```

The site will be available at `http://localhost:3000`.

### Build

```bash
npm run build    # Runs prisma generate → prisma migrate deploy → next build
npm run start    # Start production server
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/lead` | No | Submit a lead (name, email, message, source) |
| `POST` | `/api/signup` | No | Create a new user account |
| `GET/POST` | `/api/auth/[...nextauth]` | — | Auth.js route handler |
| `GET/PUT` | `/api/profile` | Yes | Get or update the authenticated user's profile |
| `GET` | `/api/admin/leads` | Admin | List all leads |
| `GET` | `/api/health` | No | Health check |

Community and meetup mutations use **Server Actions** (not API routes) for type safety and automatic revalidation.

---

## Security

- **Password hashing** — bcryptjs with cost factor 12
- **Rate limiting** — Login: 5 attempts / 15 min; Connection requests: 10 / 24h (Upstash sliding window)
- **Input validation** — Zod schemas on all user input, server-side
- **HTML sanitisation** — DOMPurify on rendered content
- **Auth middleware** — `/dashboard`, `/community`, `/meetups`, `/admin`, `/create-profile` require authentication
- **Disabled accounts** — Blocked from login; profile set to PRIVATE
- **Security headers** — HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- **No email/password leakage** — Profiles never expose email addresses

---

## Deployment

The project is configured for **Vercel** deployment:

- Build command: `npm run build` (includes `prisma generate` + `prisma migrate deploy`)
- Framework: Next.js
- Node.js: 18.17+
- Set all environment variables in the Vercel dashboard

For other Node.js hosts (e.g. Hostinger):

```bash
npm install && npm run build
npm run start
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Generate Prisma client + deploy migrations + build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:admin` | Seed an admin user |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run Prisma migrations (dev) |

---

## License

Private — not open-source.
