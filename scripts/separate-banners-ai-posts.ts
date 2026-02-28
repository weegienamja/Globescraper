/**
 * Separate SafetyWing and NordVPN banners in AI-generated posts.
 *
 * Currently both banners sit back-to-back before "## Common Mistakes".
 * This script moves SafetyWing earlier (before "## What This Means for Teachers"
 * or "## What This Means for Travellers") and leaves NordVPN before "## Common Mistakes".
 *
 * Safe to re-run — skips posts that are already separated.
 */
import { prisma } from "../lib/prisma";

const SW_MARKER = "## Travel Medical Insurance";
const NORD_MARKER = "## Protect Your Internet Connection";

async function main() {
  const posts = await prisma.generatedArticleDraft.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, slug: true, markdown: true },
  });

  console.log(`Found ${posts.length} published AI posts\n`);
  let updated = 0;

  for (const post of posts) {
    const md = post.markdown;

    // Find both banner blocks
    const swIdx = md.indexOf(SW_MARKER);
    const nordIdx = md.indexOf(NORD_MARKER);

    if (swIdx === -1 || nordIdx === -1) {
      console.log(`SKIP  ${post.slug} — missing one or both banners`);
      continue;
    }

    // Check if they're already separated (another heading between them)
    const textBetween = md.substring(
      Math.min(swIdx, nordIdx),
      Math.max(swIdx, nordIdx)
    );
    const headingsBetween = (textBetween.match(/^## (?!Travel Medical|Protect Your Internet)/gm) || []).length;
    if (headingsBetween >= 2) {
      console.log(`SKIP  ${post.slug} — already well separated (${headingsBetween} headings between)`);
      continue;
    }

    // Extract the full SafetyWing block (from "## Travel Medical Insurance" to just before "## Protect Your Internet Connection")
    const swEnd = md.indexOf(NORD_MARKER, swIdx);
    if (swEnd === -1) {
      console.log(`SKIP  ${post.slug} — unexpected structure`);
      continue;
    }

    const swBlock = md.substring(swIdx, swEnd).trimEnd();

    // Remove the SW block from its current position
    let newMd = md.substring(0, swIdx) + md.substring(swEnd);

    // Find a good earlier anchor — try several in order of preference
    const anchors = [
      "## What This Means for Teachers",
      "## What This Means for Travellers",
      "## What This Means for Travelers",
      "## What to Do Now",
      "## Safety and Scams",
    ];

    let insertIdx = -1;
    let anchorUsed = "";
    for (const anchor of anchors) {
      const idx = newMd.indexOf(anchor);
      if (idx !== -1) {
        insertIdx = idx;
        anchorUsed = anchor;
        break;
      }
    }

    if (insertIdx === -1) {
      console.log(`SKIP  ${post.slug} — no suitable anchor found`);
      continue;
    }

    // Insert the SW block before the anchor
    newMd = newMd.substring(0, insertIdx) + swBlock + "\n\n" + newMd.substring(insertIdx);

    await prisma.generatedArticleDraft.update({
      where: { id: post.id },
      data: { markdown: newMd },
    });

    // Count headings between them now
    const newSwIdx = newMd.indexOf(SW_MARKER);
    const newNordIdx = newMd.indexOf(NORD_MARKER);
    const newBetween = newMd.substring(newSwIdx, newNordIdx);
    const newHeadingCount = (newBetween.match(/^## /gm) || []).length - 1; // subtract the SW heading itself

    console.log(`OK    ${post.slug} — SW moved before "${anchorUsed}" (${newHeadingCount} sections between banners)`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} of ${posts.length} posts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
