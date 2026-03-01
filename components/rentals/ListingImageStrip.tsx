"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";

interface Props {
  images: string[];
  title: string;
  listingId?: string;
}

/**
 * Horizontal scroll strip with infinite loop feel.
 * Duplicates the images array so scrolling past the end seamlessly
 * wraps back to the beginning.
 */
export function ListingImageStrip({ images, title, listingId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = images.length;

  // For single or no images, skip loop logic
  const shouldLoop = total > 1;
  // Duplicate array for looping
  const displayImages = shouldLoop ? [...images, ...images] : images;

  /* --- Infinite scroll reset --- */
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !shouldLoop) return;

    const itemWidth = el.scrollWidth / displayImages.length;
    const setWidth = itemWidth * total;

    // Reset to equivalent position in first set
    if (el.scrollLeft >= setWidth) {
      el.scrollLeft -= setWidth;
    } else if (el.scrollLeft < 0) {
      el.scrollLeft += setWidth;
    }

    // Compute visible index
    const idx = Math.round(el.scrollLeft / itemWidth) % total;
    setCurrentIndex(idx);
  }, [shouldLoop, displayImages.length, total]);

  /* --- Desktop arrow handlers --- */
  const scrollBy = useCallback(
    (dir: 1 | -1) => {
      const el = containerRef.current;
      if (!el) return;
      const itemWidth = el.scrollWidth / displayImages.length;
      el.scrollBy({ left: dir * itemWidth, behavior: "smooth" });
    },
    [displayImages.length],
  );

  /* --- Set initial scroll for loop --- */
  useEffect(() => {
    // No need to offset; we start at index 0 of the first set
  }, []);

  if (total === 0) {
    return (
      <div className="image-strip image-strip--empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        No Image
      </div>
    );
  }

  if (total === 1) {
    return (
      <div className="image-strip image-strip--single">
        <Image
          src={images[0]}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, 40vw"
          quality={60}
          unoptimized
        />
        <span className="image-strip__badge">1/1</span>
      </div>
    );
  }

  return (
    <div
      className="image-strip"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div
        ref={containerRef}
        className="image-strip__scroll"
        onScroll={handleScroll}
        id={listingId ? `strip-${listingId}` : undefined}
      >
        {displayImages.map((src, i) => (
          <div key={`${src}-${i}`} className="image-strip__item">
            <Image
              src={src}
              alt={`${title} - photo ${(i % total) + 1}`}
              fill
              sizes="(max-width: 640px) 80vw, 280px"
              quality={60}
              unoptimized
            />
          </div>
        ))}
      </div>
      <span className="image-strip__badge">
        {currentIndex + 1}/{total}
      </span>
      {/* Desktop arrows */}
      <button
        type="button"
        className="image-strip__arrow image-strip__arrow--left"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollBy(-1); }}
        aria-label="Previous image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        className="image-strip__arrow image-strip__arrow--right"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); scrollBy(1); }}
        aria-label="Next image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
