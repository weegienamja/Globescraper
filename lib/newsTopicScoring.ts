/**
 * Topic scoring and ranking for the Cambodia News Blog Generator.
 *
 * Sorts curated topics by a composite score that weighs:
 * - Freshness (recent news scores higher)
 * - Source quality (more reputable sources = higher)
 * - Risk level (lower risk = higher score)
 * - Audience fit breadth (fits both audiences = slight bonus)
 */

import type { NewsTopic } from "@/lib/newsTopicTypes";

/**
 * Calculate a composite quality score for a topic.
 * Returns a number 0-100.
 */
function calculateTopicScore(topic: NewsTopic): number {
  let score = 0;

  // Freshness: 0-40 points
  // freshnessScore is 1-10, map to 0-40
  score += topic.freshnessScore * 4;

  // Source count: 0-25 points
  // 2 sources = 10, 3 = 15, 4+ = 20-25
  const sourcePoints = Math.min(25, topic.sourceCount * 5 + 5);
  score += sourcePoints;

  // Risk level: 0-20 points
  // LOW = 20, MEDIUM = 10, HIGH = 0
  if (topic.riskLevel === "LOW") score += 20;
  else if (topic.riskLevel === "MEDIUM") score += 10;

  // Audience breadth: 0-15 points
  // Both audiences = 15, one = 10
  if (topic.audienceFit.length >= 2) score += 15;
  else score += 10;

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
