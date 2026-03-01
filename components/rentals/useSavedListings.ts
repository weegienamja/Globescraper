"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "globescraper_saved_listings";

/**
 * Hook to manage saved/favourited listings in localStorage.
 * Works without login — persisted per-browser.
 */
export function useSavedListings() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSavedIds(new Set(arr));
      }
    } catch {
      // Silently ignore corrupt data
    }
  }, []);

  // Persist to localStorage whenever savedIds changes
  const persist = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  const toggleSaved = useCallback(
    (id: string) => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { isSaved, toggleSaved };
}
