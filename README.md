# GlobeScraper (Next.js rebuild)

This is a starter rebuild of globescraper.com based on the HTML content you provided.

## What you get
- Next.js App Router site
- Same URL slugs as your current live site
- Blog index with crawlable links
- `sitemap.xml` and `robots.txt`
- Lead capture API (`POST /api/lead`)
- Simple admin leads dashboard (`/admin`) protected by Basic Auth
- Prisma + SQLite for development (easy to switch to MySQL later on Hostinger)

## Local setup
1. Install Node 18+.
2. Copy `.env.example` to `.env` and set values.
3. Install deps:
   ```bash
   npm install
   ```
4. Create the database:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Run dev:
   ```bash
   npm run dev
   ```

## Lead capture
Send JSON:
```json
{ "name": "Jamie", "email": "jamie@example.com", "message": "Interested", "source": "site-form" }
```

## Deploy on Hostinger (Node.js Web App)
- Use GitHub deploy if possible.
- Build command: `npm install && npm run build`
- Start command: `npm run start`

### Switching to MySQL on Hostinger
1. Create a MySQL DB in Hostinger.
2. Update `prisma/schema.prisma` datasource provider to `mysql`.
3. Set `DATABASE_URL` like:
   `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
4. Run migrations:
   `npx prisma migrate deploy`

## Notes
The HTML content is inserted as provided. For best SEO and maintainability, we should progressively clean the content into proper markdown/components.
