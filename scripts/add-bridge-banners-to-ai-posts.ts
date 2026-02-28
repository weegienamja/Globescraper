/**
 * Add Bridge TEFL affiliate banner to all published AI-generated posts.
 * Inserts a "Get TEFL Certified" section with Bridge.edu affiliate links.
 *
 * Safe to re-run — skips posts that already contain a Bridge banner.
 */
import { prisma } from "../lib/prisma";

const BRIDGE_AFFILIATE = "https://bridge.edu/tefl?sid=101";
const BRIDGE_120 = "https://bridge.edu/tefl/courses/professional/120-hour-master-certificate?sid=101";
const BRIDGE_240 = "https://bridge.edu/tefl/240-hour-master-teo-bundle?sid=101";
const BRIDGE_ONLINE = "https://bridge.edu/tefl/courses/specialized/teaching-english-online?sid=101";

const BRIDGE_BANNER = `## Get TEFL Certified with Bridge

If you are planning to teach English in Cambodia, a recognised TEFL certificate makes a real difference to your job options and starting pay.

<div class="sw-banner">
  <a href="${BRIDGE_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__img-link">
    <img src="/Bridge-as-a-TEFL-Powerhouse-Horizontal-banner-ad.png" alt="Bridge TEFL — internationally recognised online TEFL certification courses" class="sw-banner__img" loading="lazy" />
  </a>
  <h3 class="sw-banner__title">Bridge TEFL Courses</h3>
  <p class="sw-banner__text"><a href="${BRIDGE_AFFILIATE}" target="_blank" rel="noopener noreferrer"><strong>Bridge</strong></a> is one of the most trusted names in TEFL certification worldwide. Their courses are internationally recognised, fully online, and self-paced.</p>
  <ul class="sw-banner__list">
    <li><a href="${BRIDGE_120}" target="_blank" rel="noopener noreferrer"><strong>120-Hour Master Certificate</strong></a> — ideal for getting started</li>
    <li><a href="${BRIDGE_240}" target="_blank" rel="noopener noreferrer"><strong>240-Hour Master TEFL/TESOL Bundle</strong></a> — stand out and unlock higher pay</li>
    <li><a href="${BRIDGE_ONLINE}" target="_blank" rel="noopener noreferrer"><strong>Teaching English Online</strong></a> — add online tutoring income</li>
  </ul>
  <a href="${BRIDGE_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__cta">Explore Bridge TEFL Courses →</a>
</div>`;

async function main() {
  const posts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, markdown: true },
  });

  console.log(`Found ${posts.length} published AI posts\n`);

  let updated = 0;

  for (const post of posts) {
    if (post.markdown.includes("bridge.edu")) {
      console.log(`SKIP  ${post.slug} — already has Bridge banner`);
      continue;
    }

    let md = post.markdown;
    const insertBlock = "\n\n" + BRIDGE_BANNER + "\n\n";

    // Try to insert before SafetyWing banner (so Bridge comes before insurance)
    const swIdx = md.indexOf("## Travel Medical Insurance");
    if (swIdx !== -1) {
      md = md.slice(0, swIdx) + insertBlock + md.slice(swIdx);
    } else {
      // Try before "## Common Mistakes"
      const cmIdx = md.indexOf("## Common Mistakes");
      if (cmIdx !== -1) {
        md = md.slice(0, cmIdx) + insertBlock + md.slice(cmIdx);
      } else {
        // Try before "## FAQ"
        const faqIdx = md.indexOf("## FAQ");
        if (faqIdx !== -1) {
          md = md.slice(0, faqIdx) + insertBlock + md.slice(faqIdx);
        } else {
          // Append before the end
          md = md.trimEnd() + insertBlock;
        }
      }
    }

    await prisma.generatedArticleDraft.update({
      where: { id: post.id },
      data: { markdown: md },
    });

    console.log(`OK    ${post.slug} — added Bridge TEFL banner`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} of ${posts.length} posts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
