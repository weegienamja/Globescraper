/**
 * Hero-image mapping: each blog post slug → one or more /public images.
 * Images /1.png – /7.png are distributed across the 6 blog posts.
 */

export type PostHeroMap = Record<string, string>;

export const postHeroImages: PostHeroMap = {
  "teach-english-cambodia-no-degree": "/1.png",
  "cost-of-living-cambodia-teachers": "/2.png",
  "south-africans-moving-to-cambodia-2025": "/3.png",
  "teaching-job-in-cambodia-2025": "/4.png",
  "what-to-pack-for-teaching-english-in-cambodia-2025": "/5.png",
  "cambodia-vs-usa-uk-south-africa-disposable-income-2025": "/6.png",
};

/**
 * Secondary images available for inline use.
 * /7.png is unassigned as a hero — used as a shared fallback or future post.
 */
export const fallbackHeroImage = "/7.png";

/** Get the hero image for a slug, with fallback. */
export function getHeroImage(slug: string): string {
  return postHeroImages[slug] ?? fallbackHeroImage;
}
