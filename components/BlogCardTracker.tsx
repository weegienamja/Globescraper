"use client";

import { trackBlogCardClick } from "@/lib/analytics";

/**
 * Thin wrapper that fires a blog_card_click event when any link
 * inside the card is clicked.
 */
export function BlogCardTracker({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <div onClick={() => trackBlogCardClick(slug)}>
      {children}
    </div>
  );
}
