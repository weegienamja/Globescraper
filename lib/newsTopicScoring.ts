/**
 * Topic scoring and ranking for the Cambodia News Blog Generator.
 *
 * Sorts curated topics by a composite score that weighs:
 * - Search query quality (more queries = better research potential)
 * - Outline depth (more outline angles = more substance)
 * - Audience fit breadth (fits both audiences = slight bonus)
 * - Keyword quality (has target + secondary keywords)
 * - Legacy: freshnessScore / sourceCount / riskLevel if present
 */

import type { NewsTopic } from "@/lib/newsTopicTypes";

/**
 * Calculate a composite quality score for a topic.
 * Returns a number 0-100.
 */
function calculateTopicScore(topic: NewsTopic): number {
  let score = 0;

  // Search queries quality: 0-30 points (3 queries = 15, 6 = 30)
  const queryCount = topic.searchQueries?.length ?? 0;
  score += Math.min(30, queryCount * 5);

  // Outline depth: 0-25 points (3 angles = 12.5, 6 = 25)
  const outlineCount = topic.outlineAngles?.length ?? 0;
  score += Math.min(25, Math.round(outlineCount * 4.2));

  // Keyword quality: 0-20 points
  if (topic.suggestedKeywords?.target) score += 10;
  const secondaryCount = topic.suggestedKeywords?.secondary?.length ?? 0;
  score += Math.min(10, secondaryCount * 3);

  // Audience breadth: 0-15 points
  if (topic.audienceFit.length >= 2) score += 15;
  else score += 10;

  // Intent present: 0-10 points
  if (topic.intent && topic.intent.length > 5) score += 10;

  // Legacy fields (if present from USE_EXTERNAL_SOURCES mode)
  if (typeof topic.freshnessScore === "number") {
    score += topic.freshnessScore * 2; // 0-20 bonus
  }
  if (typeof topic.sourceCount === "number") {
    score += Math.min(10, topic.sourceCount * 3); // 0-10 bonus
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Score and rank topics by quality.
 * Returns topics sorted best-first.
 */
export function scoreAndRankTopics(topics: NewsTopic[]): NewsTopic[] {
  // Calculate scores and sort
  const scored = topics.map((topic) => ({
    topic,
    score: calculateTopicScore(topic),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.topic);
}
