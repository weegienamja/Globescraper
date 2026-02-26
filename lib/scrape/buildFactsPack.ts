/**
 * Build a structured facts pack from fetched source data.
 * This is the research material that gets sent to Gemini.
 */

export interface SourceData {
  url: string;
  title: string | null;
  publisher: string;
  text: string;
  fetchedAt: Date;
}

export interface FactsPack {
  city: string;
  topic: string;
  audience: string;
  targetKeyword?: string;
  secondaryKeywords?: string;
  sourceCount: number;
  sources: FactsSource[];
  combinedBulletPoints: string;
}

export interface FactsSource {
  url: string;
  title: string | null;
  publisher: string;
  fetchedAt: Date;
  keyPoints: string[];
}

/**
 * Extract key bullet points from source text.
 */
function extractKeyPoints(text: string): string[] {
  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300);

  // Filter for informational sentences (contain numbers, prices, facts)
  const informational = sentences.filter(
    (s) =>
      /\d/.test(s) ||
      /\$|USD|usd|riel|KHR/.test(s) ||
      /cost|price|pay|salary|rent|budget/i.test(s) ||
      /safe|danger|scam|avoid|warning/i.test(s) ||
      /visa|permit|requirement/i.test(s) ||
      /hospital|clinic|doctor|health/i.test(s) ||
      /transport|tuk|grab|bus|moto/i.test(s) ||
      /sim|phone|bank|money/i.test(s) ||
      /teach|school|student|class/i.test(s) ||
      /neighbourhood|area|district/i.test(s)
  );

  // Take up to 10 key points per source
  const selected = informational.length > 0 ? informational : sentences;
  return selected.slice(0, 10);
}

/**
 * Build the facts pack from multiple source data entries.
 */
export function buildFactsPack(
  city: string,
  topic: string,
  audience: string,
  sources: SourceData[],
  targetKeyword?: string,
  secondaryKeywords?: string
): FactsPack {
  const factsSources: FactsSource[] = sources.map((source) => ({
    url: source.url,
    title: source.title,
    publisher: source.publisher,
    fetchedAt: source.fetchedAt,
    keyPoints: extractKeyPoints(source.text),
  }));

  // Combine all bullet points into a formatted string
  const combinedBulletPoints = factsSources
    .map((source) => {
      const header = `\n--- Source: ${source.publisher} (${source.url}) ---`;
      const bullets = source.keyPoints
        .map((point) => `- ${point}`)
        .join("\n");
      return `${header}\n${bullets}`;
    })
    .join("\n");

  return {
    city,
    topic,
    audience,
    targetKeyword,
    secondaryKeywords,
    sourceCount: sources.length,
    sources: factsSources,
    combinedBulletPoints,
  };
}
