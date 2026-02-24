import { siteConfig } from "@/lib/site";

export function GET() {
  const body = `User-agent: *
Allow: /

Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /signup
Disallow: /dashboard
Disallow: /create-profile

Sitemap: ${siteConfig.url}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
