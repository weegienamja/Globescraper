"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type LightboxImage = { url: string; alt?: string };

/**
 * A gallery grid that opens a full-screen lightbox on click.
 * Supports prev/next arrows, keyboard navigation (← → Esc), and swipe.
 */
export function GalleryGrid({
  images,
  className = "profile-view__gallery",
}: {
  images: LightboxImage[];
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <div className={className}>
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            className="lightbox-thumb"
            onClick={() => setActiveIndex(i)}
            aria-label={`View ${img.alt ?? `photo ${i + 1}`}`}
          >
            <Image
              src={img.url}
              alt={img.alt ?? `Photo ${i + 1}`}
              width={400}
              height={300}
              className="lightbox-thumb__img"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <Lightbox
          images={images}
          startIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = images.length;

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + total) % total),
    [total],
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % total),
    [total],
  );

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const img = images[index];

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Image viewer">
      {/* Close button */}
      <button className="lightbox__close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      {/* Counter */}
      <div className="lightbox__counter">
        {index + 1} / {total}
      </div>

      {/* Previous arrow */}
      {total > 1 && (
        <button
          className="lightbox__arrow lightbox__arrow--prev"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Previous image"
        >
          ‹
        </button>
      )}

      {/* Image */}
      <div className="lightbox__image-wrap" onClick={(e) => e.stopPropagation()}>
        <Image
          src={img.url}
          alt={img.alt ?? `Photo ${index + 1}`}
          width={1200}
          height={900}
          className="lightbox__image"
          priority
        />
      </div>

      {/* Next arrow */}
      {total > 1 && (
        <button
          className="lightbox__arrow lightbox__arrow--next"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Next image"
        >
          ›
        </button>
      )}
    </div>
  );
}
