/**
 * Add SafetyWing and NordVPN affiliate banners to all published AI-generated posts.
 * Inserts a "Travel Medical Insurance" section and a "Protect Your Internet" section
 * before the "## Common Mistakes" heading in each post.
 *
 * Safe to re-run — skips posts that already contain the banners.
 */
import { prisma } from "../lib/prisma";

const SW_AFFILIATE = "https://safetywing.com/?referenceID=26254350&utm_source=26254350&utm_medium=Ambassador";
const NORDVPN_AFFILIATE = "https://nordvpn.com/?utm_medium=affiliate&utm_term&utm_content&utm_source=aff&utm_campaign=off";

const SW_BANNER = `## Travel Medical Insurance

Private clinics in Cambodia handle routine care, but serious injuries or illness often mean a flight to Bangkok. Without proper cover, an emergency can cost thousands out of pocket.

<div class="sw-banner">
  <a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__img-link">
    <img src="/SafetyWing-Universe-A.jpg" alt="SafetyWing Nomad Insurance — travel medical insurance for digital nomads and teachers abroad" class="sw-banner__img" loading="lazy" />
  </a>
  <h3 class="sw-banner__title">SafetyWing Nomad Insurance</h3>
  <p class="sw-banner__text"><a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer"><strong>SafetyWing</strong></a> is travel medical insurance designed for people living and working abroad. It covers hospital stays, emergency dental, lost luggage, travel delays, and emergency evacuations across 180+ countries. Starts from $62.72 per 4 weeks for ages 18\u201339.</p>
  <a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__cta">Get Covered with SafetyWing \u2192</a>
</div>`;

const NORDVPN_BANNER = `## Protect Your Internet Connection

Public Wi-Fi in Cambodia\u2019s cafes, coworking spaces, and hotels is not always secure. A VPN protects your banking, logins, and personal data.

<div class="sw-banner">
  <a href="${NORDVPN_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__img-link">
    <img src="/nord_vpn.png" alt="NordVPN — secure your internet connection while living abroad" class="sw-banner__img" loading="lazy" />
  </a>
  <h3 class="sw-banner__title">Stay Secure Online with NordVPN</h3>
  <p class="sw-banner__text"><a href="${NORDVPN_AFFILIATE}" target="_blank" rel="noopener noreferrer"><strong>NordVPN</strong></a> encrypts your connection, keeps your banking and login credentials safe, and lets you access geo-restricted content from back home.</p>
  <a href="${NORDVPN_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__cta">Get NordVPN \u2192</a>
</div>`;

async function main() {
  const posts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, markdown: true },
  });

  console.log(`Found ${posts.length} published AI posts\n`);

  let updated = 0;

  for (const post of posts) {
    const hasSW = post.markdown.includes("SafetyWing");
    const hasNord = post.markdown.includes("NordVPN") || post.markdown.includes("nordvpn.com");

    if (hasSW && hasNord) {
      console.log(`SKIP  ${post.slug} — already has both banners`);
      continue;
    }

    let md = post.markdown;
    const insertions: string[] = [];

    if (!hasSW) insertions.push(SW_BANNER);
    if (!hasNord) insertions.push(NORDVPN_BANNER);

    const insertBlock = "\n\n" + insertions.join("\n\n") + "\n\n";

    // Try to insert before "## Common Mistakes"
    const anchor = "## Common Mistakes";
    const idx = md.indexOf(anchor);

    if (idx !== -1) {
      md = md.slice(0, idx) + insertBlock + md.slice(idx);
    } else {
      // Fallback: insert before "## FAQ"
      const faqIdx = md.indexOf("## FAQ");
      if (faqIdx !== -1) {
        md = md.slice(0, faqIdx) + insertBlock + md.slice(faqIdx);
      } else {
        // Last resort: append before the end
        md = md.trimEnd() + insertBlock;
      }
    }

    await prisma.generatedArticleDraft.update({
      where: { id: post.id },
      data: { markdown: md },
    });

    const added = [];
    if (!hasSW) added.push("SafetyWing");
    if (!hasNord) added.push("NordVPN");
    console.log(`OK    ${post.slug} — added ${added.join(" + ")}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} of ${posts.length} posts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
