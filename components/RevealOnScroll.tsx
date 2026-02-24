"use client";

import { useEffect } from "react";

/**
 * Lightweight scroll-reveal using IntersectionObserver.
 * Adds a fade-in + upward motion to major page sections on first view.
 * Respects prefers-reduced-motion. No external libraries.
 */
export function RevealOnScroll() {
  useEffect(() => {
    // Respect users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = document.querySelectorAll(
      ".prose .block, .card, .admin__card"
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-section--visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        // Already visible above the fold — don't animate, just show
        return;
      }
      el.classList.add("reveal-section");
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
