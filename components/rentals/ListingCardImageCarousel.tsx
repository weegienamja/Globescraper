"use client";

import Image from "next/image";
import { useState, useRef, useCallback } from "react";

interface Props {
  images: string[];
  alt: string;
}

/**
 * Per-card swipeable image carousel.
 *
 * - Each card manages its own image index locally.
 * - Pointer-event based swipe (touch only) preserves vertical scroll.
 * - Desktop: hover arrows for prev/next.
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
  const isHorizontalRef = useRef<boolean | null>(null); // null = undecided
  const didSwipeRef = useRef(false);

  // ── Apply transform directly (no rerender) ──
  const applyTranslate = useCallback(
    (dx: number, animate: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      const pct = -index * 100;
      const pxOffset = dx;
      track.style.transition = animate ? "transform 220ms ease" : "none";
      track.style.transform = `translateX(calc(${pct}% + ${pxOffset}px))`;
    },
    [index],
  );

  // ── Pointer handlers (touch only) ──
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch" || total <= 1) return;
      e.stopPropagation();
      isDraggingRef.current = true;
      isHorizontalRef.current = null;
      didSwipeRef.current = false;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      deltaXRef.current = 0;
      applyTranslate(0, false);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [total, applyTranslate],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || e.pointerType !== "touch") return;
      e.stopPropagation();

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;

      // Decide direction once past threshold
      if (isHorizontalRef.current === null) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (Math.abs(dx) > Math.abs(dy)) {
            isHorizontalRef.current = true;
          } else {
            // Vertical - release, let page scroll
            isHorizontalRef.current = false;
            isDraggingRef.current = false;
            applyTranslate(0, true);
            return;
          }
        } else {
          return; // not enough movement yet
        }
      }

      if (!isHorizontalRef.current) return;

      e.preventDefault(); // prevent scroll while swiping horizontally
      deltaXRef.current = dx;
      applyTranslate(dx, false);
    },
    [applyTranslate],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || e.pointerType !== "touch") return;
      e.stopPropagation();
      isDraggingRef.current = false;

      const dx = deltaXRef.current;
      const width = viewportRef.current?.offsetWidth ?? 300;
      const threshold = width * 0.18;

      if (isHorizontalRef.current) {
        didSwipeRef.current = Math.abs(dx) > 8;

        if (dx <= -threshold) {
          // swipe left -> next
          setIndex((prev) => (prev >= total - 1 ? 0 : prev + 1));
        } else if (dx >= threshold) {
          // swipe right -> prev
          setIndex((prev) => (prev <= 0 ? total - 1 : prev - 1));
        }
      }

      // Animate to final position (the setIndex above triggers rerender with new index)
      // For snap-back case or when setIndex fires, we animate in the effect below
      deltaXRef.current = 0;
      applyTranslate(0, true);
    },
    [total, applyTranslate],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      isDraggingRef.current = false;
      deltaXRef.current = 0;
      applyTranslate(0, true);
    },
    [applyTranslate],
  );

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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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

      {/* Desktop arrows (hidden on touch via CSS) */}
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
