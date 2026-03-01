import Image from "next/image";

/**
 * Two images side-by-side (desktop) or single image (mobile via CSS).
 * Shows a photo-count badge in the bottom-left corner.
 */
export function ImagePair({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  if (images.length === 0) {
    return (
      <div className="rental-card__images">
        <div className="rental-card__no-image">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          No Image
        </div>
      </div>
    );
  }

  const img1 = images[0];
  const img2 = images.length > 1 ? images[1] : null;
  const total = images.length;

  return (
    <div className="rental-card__images">
      <div className="rental-card__image-pair">
        <div className="rental-card__image-wrap">
          <Image
            src={img1}
            alt={alt}
            fill
            sizes="(max-width: 640px) 100vw, 40vw"
            quality={60}
            unoptimized
          />
          <span className="rental-card__photo-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            1/{total}
          </span>
        </div>
        {img2 && (
          <div className="rental-card__image-wrap">
            <Image
              src={img2}
              alt={`${alt} - photo 2`}
              fill
              sizes="20vw"
              quality={60}
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  );
}
