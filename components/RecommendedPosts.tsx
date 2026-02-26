import Link from "next/link";
import Image from "next/image";
import { getHeroImage } from "@/lib/contentImages";

export interface RecommendedPost {
  slug: string;
  title: string;
  description: string;
  isAiGenerated?: boolean;
  heroImageUrl?: string | null;
}

interface Props {
  posts: RecommendedPost[];
}

/**
 * Recommended blog posts component.
 * Desktop: vertical sidebar list on the right.
 * Mobile/tablet: horizontal scrollable strip at the bottom.
 */
export function RecommendedPosts({ posts }: Props) {
  if (posts.length === 0) return null;

  const cleanTitle = (t: string) => t.replace(" | GlobeScraper", "");

  return (
    <aside className="recommended" aria-label="Recommended articles">
      <h3 className="recommended__heading">More from GlobeScraper</h3>
      <div className="recommended__list">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/${p.slug}`}
            className="recommended__card"
          >
            <div className="recommended__img-wrap">
              <Image
                src={p.heroImageUrl || getHeroImage(p.slug)}
                alt={cleanTitle(p.title)}
                width={120}
                height={68}
                className="recommended__img"
                unoptimized={!!p.heroImageUrl}
              />
            </div>
            <div className="recommended__body">
              <span className="recommended__title">{cleanTitle(p.title)}</span>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
