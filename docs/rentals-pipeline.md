# Rental Data Pipeline

The Rental Data Pipeline scrapes rental listings from **Khmer24** and **Realestate.com.kh**, limited to **condos and apartments only**. It stores listings and snapshots over time, and builds a daily rental price index for future heatmap visualization.

## Architecture Overview

```
┌────────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Discover Job      │────▶│  ScrapeQueue       │────▶│  Process Queue   │
│  (category pages)  │     │  (URLs to scrape)  │     │  (detail pages)  │
└────────────────────┘     └───────────────────┘     └──────┬───────────┘
                                                             │
                                                             ▼
                                                      ┌──────────────┐
                                                      │ RentalListing│
                                                      │ + Snapshot   │
                                                      └──────┬───────┘
                                                             │
                                                             ▼
                                                      ┌──────────────────┐
                                                      │ Build Daily Index│
                                                      │ RentalIndexDaily │
                                                      └──────────────────┘
```

## How to Run Locally

### Prerequisites
- Node.js 20+
- MySQL database (configured via `DATABASE_URL` in `.env`)
- Prisma client generated (`npx prisma generate`)

### Manual via Admin UI

1. Sign in as an admin user
2. Navigate to `/tools` → click "Rental Data Pipeline"
3. Use the three action buttons:
   - **Discover New Listings** – Scrapes category pages and enqueues listing URLs
   - **Process Queue Batch** – Fetches and parses up to 25 queued listings
   - **Build Daily Index** – Aggregates price statistics for yesterday

### Manual via CLI Scripts

```bash
# Discover listings from all sources
npx tsx scripts/rentals_discover.ts

# Discover from a specific source
npx tsx scripts/rentals_discover.ts KHMER24
npx tsx scripts/rentals_discover.ts REALESTATE_KH

# Process queued listings
npx tsx scripts/rentals_process_queue.ts

# Build daily index
npx tsx scripts/rentals_build_index.ts
```

### Manual via API

```bash
# Discover (admin auth required)
curl -X POST https://your-domain.com/api/tools/rentals/discover?source=KHMER24

# Process queue
curl -X POST https://your-domain.com/api/tools/rentals/process-queue?source=KHMER24

# Build index
curl -X POST https://your-domain.com/api/tools/rentals/build-index

# Get summary
curl https://your-domain.com/api/tools/rentals/summary

# Get job runs (paginated)
curl https://your-domain.com/api/tools/rentals/job-runs?page=1&limit=20
```

## GitHub Actions Setup

The pipeline runs automatically via GitHub Actions (`.github/workflows/rentals-pipeline.yml`).

### Schedule
| Job | Schedule | Description |
|-----|----------|-------------|
| Discover | Every 6 hours | Scrapes category pages, enqueues new URLs |
| Process Queue | Every hour | Processes up to 25 queued listings |
| Build Index | Daily at 01:15 UTC | Computes price statistics for yesterday |

### Required Secrets

Add these in your GitHub repo → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | MySQL connection string |

### Manual Dispatch

You can also trigger jobs manually from the GitHub Actions UI:
1. Go to Actions → "Rental Data Pipeline"
2. Click "Run workflow"
3. Select which job to run (discover, process-queue, build-index, or all)

## Safety Caps

All caps are configurable in `lib/rentals/config.ts`:

| Cap | Default | Description |
|-----|---------|-------------|
| `DISCOVER_MAX_PAGES` | 3 | Max category/index pages per discover run |
| `DISCOVER_MAX_URLS` | 200 | Max URLs enqueued per discover run |
| `PROCESS_QUEUE_MAX` | 25 | Max listing pages processed per run |
| `CONCURRENCY_LIMIT` | 2 | Concurrent outbound HTTP requests |
| `REQUEST_DELAY_BASE_MS` | 1200 | Base delay between requests |
| `REQUEST_DELAY_JITTER_MS` | 800 | Random jitter added to delay |
| `MAX_RETRIES` | 3 | Retry count for transient errors |

## Source Configuration

Enable/disable sources in `lib/rentals/config.ts`:

```typescript
export const enabledSources: Record<RentalSource, boolean> = {
  KHMER24: true,
  REALESTATE_KH: true,
};
```

Set a source to `false` to skip it in all jobs.

## Condo/Apartment Filtering

The pipeline only ingests listings classified as **CONDO** or **APARTMENT**:

- **Accepted**: condo, condominium, apartment, flat, service apartment, serviced apartment, studio apartment, studio
- **Rejected**: house, villa, land, borey, townhouse, shophouse, commercial, warehouse, factory, office space, penthouse

Classification runs at both the discover stage (URL filtering) and the scrape stage (content parsing). Listings classified as `OTHER` are silently dropped.

## ML Features (Optional)

All ML features are behind environment flags, disabled by default:

```env
RENTALS_ML_ENABLED=false
RENTALS_EMBEDDINGS_ENABLED=false
```

### Phase ML-1 (Rule-based, no external AI)
- District name normalization using alias tables
- Near-duplicate detection using trigram similarity
- Price outlier detection using IQR / z-score methods

### Phase ML-2 (External embeddings, requires approval)
- Batch embedding computation via Gemini API
- Vector-based clustering for deduplication
- Cached by input hash

### Phase ML-3 (Trend forecasting)
- Linear regression on daily median prices per district
- Not yet implemented

## Database Models

| Model | Purpose |
|-------|---------|
| `RentalListing` | Canonical listing record with parsed data |
| `RentalSnapshot` | Point-in-time snapshot of a listing's state |
| `RentalIndexDaily` | Aggregated daily price statistics |
| `ScrapeQueue` | URLs waiting to be scraped |
| `JobRun` | Job execution log with counts and timing |

## Heatmap

The heatmap page (`/tools/rentals/heatmap`) currently shows:
- A placeholder for a future Mapbox/Leaflet interactive map
- A data table of districts with price statistics from `RentalIndexDaily`

**TODO**: Integrate Mapbox GL JS or Leaflet with district-level GeoJSON polygons for Phnom Penh.

## Limitations

- Parsing is based on CSS selectors that may change if source websites update their layouts
- realestate.com.kh may use heavy JS rendering; a Playwright fallback is stubbed but disabled
- Price parsing assumes USD; KHR conversion is not yet implemented
- District classification is rule-based and may miss unusual spellings
- No image downloading; only URLs are stored
