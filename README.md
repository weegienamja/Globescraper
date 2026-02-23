# GlobeScraper (Next.js rebuild)

This is my rebuild of globescraper.com using Next.js after moving away
from the website builder.

The builder was too restrictive for what I want to build. This version
gives me proper control over structure, SEO, lead capture, and future
scalability.

## What you get

-   Next.js App Router site
-   Same URL slugs as the current live site (to preserve SEO)
-   Blog index with crawlable links
-   `sitemap.xml` and `robots.txt`
-   Lead capture API (`POST /api/lead`)
-   Simple admin leads dashboard (`/admin`) protected by Basic Auth

    -   Prisma + SQLite for development, MySQL in production (Hostinger)

## Environment variables required

-   `DATABASE_URL` (MySQL connection string for production)
-   `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` (for /admin access)

App will fail to start if these are missing.

## Local setup

1.  Install Node 18+.

2.  Copy `.env.example` to `.env` and set values.

3.  Install deps:

    ``` bash
    npm install
    ```

4.  Create the database:

    ``` bash
    npx prisma migrate dev --name init
    ```

5.  Run dev:

    ``` bash
    npm run dev
    ```

## Lead capture

Send JSON:

``` json
{ "name": "Jamie", "email": "jamie@example.com", "message": "Interested", "source": "site-form" }
```

## Deploy on Hostinger (Node.js Web App)

-   Use GitHub deploy if possible.
-   Build command: `npm install && npm run build`
-   Start command: `npm run start`

### Switching to MySQL on Hostinger

1.  Create a MySQL DB in Hostinger.
2.  Update `prisma/schema.prisma` datasource provider to `mysql`.
3.  Set `DATABASE_URL` like: `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
4.  Run migrations: `npx prisma migrate deploy`

## Notes

The HTML content has been inserted as-is from the original site to
preserve structure and URLs.

For better SEO and long-term maintainability, the next step is to
progressively refactor the content into proper markdown and reusable
components.
