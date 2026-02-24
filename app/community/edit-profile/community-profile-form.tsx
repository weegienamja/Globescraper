"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { updateCommunityProfile } from "@/app/community/actions";
import {
  uploadAvatar,
  removeAvatar,
  uploadGalleryImage,
  deleteGalleryImage,
} from "@/app/community/image-actions";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

const MAX_CLIENT_SIZE = 2 * 1024 * 1024; // 2 MB — compress above this
const COMPRESS_QUALITY = 0.8;
const MAX_DIMENSION = 2048; // max width/height after compression

/**
 * Compress an image file in the browser using Canvas.
 * Returns the original file if already under MAX_CLIENT_SIZE.
 */
async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_CLIENT_SIZE) return file;

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      // Scale down if either dimension exceeds MAX_DIMENSION
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          });
          // If compression didn't help, return the original
          resolve(compressed.size < file.size ? compressed : file);
        },
        "image/jpeg",
        COMPRESS_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });
}

type GalleryImage = { id: string; url: string };

type ProfileData = {
  displayName: string;
  bio: string;
  currentCountry: string;
  currentCity: string;
  targetCountries: string[];
  visibility: string;
  meetupCoffee: boolean;
  meetupCityTour: boolean;
  meetupJobAdvice: boolean;
  meetupStudyGroup: boolean;
  avatarUrl: string | null;
  galleryImages: GalleryImage[];
};

export function CommunityProfileForm({
  initial,
}: {
  initial: ProfileData | null;
}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [error, setError] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    initial?.targetCountries ?? [],
  );
  const [pending, startTransition] = useTransition();

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initial?.avatarUrl ?? null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [gallery, setGallery] = useState<GalleryImage[]>(
    initial?.galleryImages ?? [],
  );
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function toggleCountry(c: string) {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("file", compressed);
      const res = await uploadAvatar(fd);
    setAvatarUploading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setAvatarUrl(res.url);
    await updateSession(); // refresh JWT with new avatarUrl
    } catch {
      setAvatarUploading(false);
      setError("Failed to process image. Try a different file.");
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    setError("");
    const res = await removeAvatar();
    setAvatarUploading(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setAvatarUrl(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    await updateSession();
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("file", compressed);
    const res = await uploadGalleryImage(fd);
    setGalleryUploading(false);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if ("error" in res) {
      setError(res.error);
      return;
    }
    // Add new image to local state immediately
    if (res.id) {
      setGallery((prev) => [...prev, { id: res.id!, url: res.url }]);
    }
    } catch {
      setGalleryUploading(false);
      setError("Failed to process image. Try a different file.");
    }
  }

  async function handleGalleryDelete(imageId: string) {
    setError("");
    const res = await deleteGalleryImage(imageId);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setGallery((prev) => prev.filter((img) => img.id !== imageId));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      displayName: (fd.get("displayName") as string).trim(),
      bio: (fd.get("bio") as string).trim(),
      currentCountry: (fd.get("currentCountry") as string).trim(),
      currentCity: (fd.get("currentCity") as string).trim(),
      targetCountries: selectedCountries,
      visibility: fd.get("visibility") as string,
      meetupCoffee: fd.has("meetupCoffee"),
      meetupCityTour: fd.has("meetupCityTour"),
      meetupJobAdvice: fd.has("meetupJobAdvice"),
      meetupStudyGroup: fd.has("meetupStudyGroup"),
    };

    if (selectedCountries.length === 0) {
      setError("Please select at least one target country.");
      return;
    }

    startTransition(async () => {
      const res = await updateCommunityProfile(payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/community");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="community-form">
      {error && <div className="form__error">{error}</div>}

      {/* ── Avatar upload ─────────────────────────── */}
      <div className="form__avatar-section">
        <div className="form__avatar-preview">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Your profile photo"
              width={96}
              height={96}
              className="form__avatar-img"
            />
          ) : (
            <div className="form__avatar-placeholder">
              {(initial?.displayName?.[0] ?? "?").toUpperCase()}
            </div>
          )}
        </div>
        <div className="form__avatar-actions">
          <label className="btn btn--outline btn--sm form__avatar-upload-label">
            {avatarUploading ? "Uploading..." : avatarUrl ? "Change Photo" : "Upload Photo"}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              disabled={avatarUploading}
              className="sr-only"
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleAvatarRemove}
              disabled={avatarUploading}
              className="btn btn--ghost btn--sm"
            >
              Remove
            </button>
          )}
          <span className="form__avatar-hint">JPEG, PNG, or WebP. Max 2 MB.</span>
        </div>
      </div>

      <label className="form__label">
        Display Name *
        <input
          name="displayName"
          type="text"
          required
          minLength={2}
          maxLength={50}
          defaultValue={initial?.displayName ?? ""}
          className="form__input"
          placeholder="How others will see you"
        />
      </label>

      <label className="form__label">
        Bio
        <textarea
          name="bio"
          maxLength={500}
          rows={3}
          defaultValue={initial?.bio ?? ""}
          className="form__input"
          placeholder="Tell the community a bit about yourself..."
        />
      </label>

      <label className="form__label">
        Current Country
        <input
          name="currentCountry"
          type="text"
          maxLength={100}
          defaultValue={initial?.currentCountry ?? ""}
          className="form__input"
          placeholder="e.g. United Kingdom"
        />
      </label>

      <label className="form__label">
        Current City
        <input
          name="currentCity"
          type="text"
          maxLength={100}
          defaultValue={initial?.currentCity ?? ""}
          className="form__input"
          placeholder="e.g. Glasgow"
        />
      </label>

      <fieldset className="form__fieldset">
        <legend>Target Countries *</legend>
        <div className="form__checkbox-grid">
          {COMMUNITY_COUNTRIES.map((c) => (
            <label key={c} className="form__checkbox-label">
              <input
                type="checkbox"
                checked={selectedCountries.includes(c)}
                onChange={() => toggleCountry(c)}
              />
              {c}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form__fieldset">
        <legend>Meetup Interests</legend>
        <div className="form__checkbox-grid">
          <label className="form__checkbox-label">
            <input
              type="checkbox"
              name="meetupCoffee"
              defaultChecked={initial?.meetupCoffee}
            />
            ☕ Coffee meetup
          </label>
          <label className="form__checkbox-label">
            <input
              type="checkbox"
              name="meetupCityTour"
              defaultChecked={initial?.meetupCityTour}
            />
            🏙️ City tour
          </label>
          <label className="form__checkbox-label">
            <input
              type="checkbox"
              name="meetupJobAdvice"
              defaultChecked={initial?.meetupJobAdvice}
            />
            💼 Job advice
          </label>
          <label className="form__checkbox-label">
            <input
              type="checkbox"
              name="meetupStudyGroup"
              defaultChecked={initial?.meetupStudyGroup}
            />
            📚 Study group
          </label>
        </div>
      </fieldset>

      <label className="form__label">
        Profile Visibility
        <select
          name="visibility"
          defaultValue={initial?.visibility ?? "MEMBERS_ONLY"}
          className="form__input"
        >
          <option value="PUBLIC">Public — anyone can view</option>
          <option value="MEMBERS_ONLY">Members only — logged-in users</option>
          <option value="PRIVATE">Private — only you and admins</option>
        </select>
      </label>

      {/* ── Gallery images ────────────────────────── */}
      <fieldset className="form__fieldset">
        <legend>Gallery Photos (up to 5)</legend>
        <p className="form__hint">Share photos with the community — travel, teaching, etc.</p>

        <div className="form__gallery-grid">
          {gallery.map((img) => (
            <div key={img.id} className="form__gallery-item">
              <Image
                src={img.url}
                alt="Gallery photo"
                width={200}
                height={200}
                className="form__gallery-img"
              />
              <button
                type="button"
                onClick={() => handleGalleryDelete(img.id)}
                className="form__gallery-delete"
                aria-label="Delete photo"
              >
                ✕
              </button>
            </div>
          ))}

          {gallery.length < 5 && (
            <label className="form__gallery-add">
              <span>{galleryUploading ? "Uploading..." : "+"}</span>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleGalleryUpload}
                disabled={galleryUploading}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="btn btn--primary"
      >
        {pending ? "Saving..." : "Save Community Profile"}
      </button>
    </form>
  );
}
