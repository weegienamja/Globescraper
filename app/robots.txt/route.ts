import { siteConfig } from "@/lib/site";

export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: ${siteConfig.url}/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
