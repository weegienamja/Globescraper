/**
 * Hero-image mapping: each blog post slug → one or more /public images.
 * Images /1.png – /7.png are distributed across the 6 blog posts.
 */

export type PostHeroMap = Record<string, string>;

export const postHeroImages: PostHeroMap = {
  "teach-english-cambodia-no-degree": "/1.png",
  "cost-of-living-cambodia-teachers": "/2.png",
  "south-africans-moving-to-cambodia-2026": "/3.png",
  "teaching-job-in-cambodia-2026": "/4.png",
  "what-to-pack-for-teaching-english-in-cambodia-2026": "/5.png",
  "cambodia-vs-usa-uk-south-africa-disposable-income-2026": "/6.png",
  "best-tefl-courses-cambodia-2026": "/teaching%20in%20cambodia.png",
};

/**
 * Secondary images available for inline use.
 * /7.png is unassigned as a hero — used as a shared fallback or future post.
 */
export const fallbackHeroImage = "/7.png";

/** All available fallback hero images for posts without a dedicated hero. */
const fallbackHeroes = ["/7.png", "/1.png", "/2.png", "/3.png", "/4.png", "/5.png", "/6.png"];

/**
 * Get the hero image for a slug, with fallback.
 * For unmapped slugs, deterministically picks from the pool based on the
 * slug string so the same slug always gets the same image (no flicker).
 */
export function getHeroImage(slug: string): string {
  if (postHeroImages[slug]) return postHeroImages[slug];
  // Simple hash: sum char-codes and mod by pool length
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash += slug.charCodeAt(i);
  return fallbackHeroes[hash % fallbackHeroes.length];
}
