"use client";

import Image from "next/image";
import { useState } from "react";

export function ListingGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="listing-gallery">
        <div className="listing-gallery__hero" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          No images available
        </div>
      </div>
    );
  }

  return (
    <div className="listing-gallery">
      <div className="listing-gallery__hero">
        <Image
          src={images[activeIdx]}
          alt={`${alt} - photo ${activeIdx + 1}`}
          fill
          sizes="(max-width: 900px) 100vw, 60vw"
          quality={75}
          priority={activeIdx === 0}
          unoptimized
        />
        <span className="listing-gallery__count">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          {activeIdx + 1}/{images.length}
        </span>
      </div>

      {images.length > 1 && (
        <div className="listing-gallery__thumbs">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`listing-gallery__thumb${i === activeIdx ? " listing-gallery__thumb--active" : ""}`}
              onClick={() => setActiveIdx(i)}
              aria-label={`View photo ${i + 1}`}
            >
              <Image
                src={src}
                alt={`${alt} - thumbnail ${i + 1}`}
                fill
                sizes="72px"
                quality={40}
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
