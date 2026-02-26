/**
 * Extract main readable text content from HTML.
 * Strips navigation, ads, scripts, and boilerplate.
 */

/**
 * Remove HTML tags and extract clean text.
 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to extract text from the main content area of an HTML page.
 * Falls back to full body text if no main content found.
 */
export function extractMainText(html: string): string {
  // Try to find article/main content regions
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*(?:content|article|post|entry|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*role="main"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const extracted = stripTags(match[1]);
      if (extracted.length > 200) {
        return truncateText(extracted);
      }
    }
  }

  // Fallback: try body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) {
    return truncateText(stripTags(bodyMatch[1]));
  }

  return truncateText(stripTags(html));
}

/**
 * Extract the page title from HTML.
 */
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match?.[1]) {
    return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

/**
 * Truncate text to a sensible max length for the facts pack.
 */
function truncateText(text: string, maxLength = 3000): string {
  if (text.length <= maxLength) return text;
  // Cut at the last sentence boundary before maxLength
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxLength * 0.5) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated + "...";
}
