import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cambodia Rental Heatmap — GlobeScraper",
  robots: "noindex", // embeds shouldn't be indexed separately
};

/**
 * Bare layout for the embeddable heatmap — SiteLayout already skips
 * chrome for this route, so this just sets metadata.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
