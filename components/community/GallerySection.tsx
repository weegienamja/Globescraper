"use client";

import { useState } from "react";
import Image from "next/image";
import { GalleryGrid } from "@/components/Lightbox";

type GalleryImage = {
  id: string;
  url: string;
  caption: string | null;
};

type Props = {
  images: GalleryImage[];
  displayName: string;
};

export function GallerySection({ images, displayName }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (images.length === 0) return null;

  const previewImages = showAll ? images : images.slice(0, 6);

  return (
    <div className="profile-section">
      <div className="profile-section__header-row">
        <h2 className="profile-section__title">Gallery</h2>
        {images.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="btn btn--ghost btn--sm"
          >
            {showAll ? "Show less" : `View All`}
            <span className="gallery-count">{images.length}</span>
          </button>
        )}
      </div>
      <GalleryGrid
        images={previewImages.map((img) => ({
          url: img.url,
          alt: img.caption ?? `Photo by ${displayName}`,
        }))}
        className="gallery-grid"
      />
    </div>
  );
}
