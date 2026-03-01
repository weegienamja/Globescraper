"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  images: string[];
  alt: string;
}

/**
 * Per-card swipeable image carousel.
 *
 * - Each card manages its own image index locally.
 * - Touch-event based swipe preserves vertical scroll.
 * - Desktop: hover arrows for prev/next (triggered by .rental-card:hover).
 * - No global listeners; everything scoped to the viewport element.
 */
export function ListingCardImageCarousel({ images, alt }: Props) {
  const total = images.length;
  const [index, setIndex] = useState(0);

  // ── Refs for drag tracking (avoids rerenders mid-gesture) ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const deltaXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const directionRef = useRef<"h" | "v" | null>(null); // null = undecided
  const didSwipeRef = useRef(false);
  const indexRef = useRef(0); // mirror of index state for use in listeners

  // Keep indexRef in sync
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // ── Apply transform directly to DOM (no rerender) ──
  const applyTranslate = useCallback(
    (idx: number, dx: number, animate: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      const pct = -idx * 100;
      track.style.transition = animate ? "transform 220ms ease" : "none";
      track.style.transform = `translateX(calc(${pct}% + ${dx}px))`;
    },
    [],
  );

  // ── Touch event handlers (attached via ref for { passive: false }) ──
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || total <= 1) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      isDraggingRef.current = true;
      directionRef.current = null;
      didSwipeRef.current = false;
      startXRef.current = t.clientX;
      startYRef.current = t.clientY;
      deltaXRef.current = 0;
      applyTranslate(indexRef.current, 0, false);
    }

    function onTouchMove(e: TouchEvent) {
      if (!isDraggingRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - startXRef.current;
      const dy = t.clientY - startYRef.current;

      // Decide direction once past threshold
      if (directionRef.current === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          if (Math.abs(dx) > Math.abs(dy)) {
            directionRef.current = "h";
          } else {
            directionRef.current = "v";
            isDraggingRef.current = false;
            return; // let browser handle vertical scroll
          }
        } else {
          return;
        }
      }

      if (directionRef.current !== "h") return;

      // Prevent vertical scroll while swiping horizontally
      e.preventDefault();
      deltaXRef.current = dx;
      applyTranslate(indexRef.current, dx, false);
    }

    function onTouchEnd() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const dx = deltaXRef.current;
      const width = el!.offsetWidth || 300;
      const threshold = width * 0.18;

      if (directionRef.current === "h") {
        didSwipeRef.current = Math.abs(dx) > 8;

        let newIdx = indexRef.current;
        if (dx <= -threshold) {
          newIdx = indexRef.current >= total - 1 ? 0 : indexRef.current + 1;
        } else if (dx >= threshold) {
          newIdx = indexRef.current <= 0 ? total - 1 : indexRef.current - 1;
        }
        setIndex(newIdx);
        applyTranslate(newIdx, 0, true);
      } else {
        applyTranslate(indexRef.current, 0, true);
      }

      deltaXRef.current = 0;
    }

    function onTouchCancel() {
      isDraggingRef.current = false;
      deltaXRef.current = 0;
      applyTranslate(indexRef.current, 0, true);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [total, applyTranslate]);

  // ── Click guard: block navigation if user swiped ──
  const onClick = useCallback((e: React.MouseEvent) => {
    if (didSwipeRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didSwipeRef.current = false;
    }
  }, []);

  // ── Desktop arrows ──
  const goPrev = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIndex((prev) => (prev <= 0 ? total - 1 : prev - 1));
    },
    [total],
  );

  const goNext = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIndex((prev) => (prev >= total - 1 ? 0 : prev + 1));
    },
    [total],
  );

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="card-carousel card-carousel--empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        No Image
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="card-carousel"
      onClick={onClick}
    >
      <div
        ref={trackRef}
        className="card-carousel__track"
        style={{ transform: `translateX(${-index * 100}%)` }}
      >
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="card-carousel__slide">
            <Image
              src={src}
              alt={`${alt} - photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 100vw, 40vw"
              quality={60}
              unoptimized
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Badge */}
      <span className="card-carousel__badge">
        {index + 1}/{total}
      </span>

      {/* Desktop arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            className="card-carousel__arrow card-carousel__arrow--left"
            onClick={goPrev}
            aria-label="Previous image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="card-carousel__arrow card-carousel__arrow--right"
            onClick={goNext}
            aria-label="Next image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
