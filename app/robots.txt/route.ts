export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: https://globescraper.com/sitemap.xml
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
