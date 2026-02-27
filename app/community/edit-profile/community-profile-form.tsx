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
import {
  COMMUNITY_COUNTRIES,
  RELOCATION_STAGES,
  LOOKING_FOR_OPTIONS,
  CERTIFICATION_OPTIONS,
  SUGGESTED_INTERESTS,
} from "@/lib/validations/community";

const MAX_CLIENT_SIZE = 2 * 1024 * 1024;
const COMPRESS_QUALITY = 0.8;
const MAX_DIMENSION = 2048;

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_CLIENT_SIZE) return file;
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
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
          const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
          resolve(compressed.size < file.size ? compressed : file);
        },
        "image/jpeg",
        COMPRESS_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

type GalleryImage = { id: string; url: string; caption: string };

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
  meetupLanguageExchange: boolean;
  meetupVisaHelp: boolean;
  meetupSchoolReferrals: boolean;
  meetupExploring: boolean;
  avatarUrl: string | null;
  galleryImages: GalleryImage[];
  relocationStage: string;
  lookingFor: string | null;
  certifications: string[];
  languagesTeaching: string[];
  interests: string[];
  showCityPublicly: boolean;
};

export function CommunityProfileForm({
  initial,
  userId,
}: {
  initial: ProfileData | null;
  userId: string;
}) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Form state
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [currentCountry, setCurrentCountry] = useState(initial?.currentCountry ?? "");
  const [currentCity, setCurrentCity] = useState(initial?.currentCity ?? "");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initial?.targetCountries ?? []);
  const [visibility, setVisibility] = useState(initial?.visibility ?? "MEMBERS_ONLY");
  const [showCityPublicly, setShowCityPublicly] = useState(initial?.showCityPublicly ?? true);

  // Meetup interests
  const [meetupCoffee, setMeetupCoffee] = useState(initial?.meetupCoffee ?? false);
  const [meetupCityTour, setMeetupCityTour] = useState(initial?.meetupCityTour ?? false);
  const [meetupJobAdvice, setMeetupJobAdvice] = useState(initial?.meetupJobAdvice ?? false);
  const [meetupStudyGroup, setMeetupStudyGroup] = useState(initial?.meetupStudyGroup ?? false);
  const [meetupLanguageExchange, setMeetupLanguageExchange] = useState(initial?.meetupLanguageExchange ?? false);
  const [meetupVisaHelp, setMeetupVisaHelp] = useState(initial?.meetupVisaHelp ?? false);
  const [meetupSchoolReferrals, setMeetupSchoolReferrals] = useState(initial?.meetupSchoolReferrals ?? false);
  const [meetupExploring, setMeetupExploring] = useState(initial?.meetupExploring ?? false);

  // New fields
  const [relocationStage, setRelocationStage] = useState(initial?.relocationStage ?? "PLANNING");
  const [lookingFor, setLookingFor] = useState<string | null>(initial?.lookingFor ?? null);
  const [certifications, setCertifications] = useState<string[]>(initial?.certifications ?? []);
  const [customCert, setCustomCert] = useState("");
  const [languagesTeaching, setLanguagesTeaching] = useState<string[]>(initial?.languagesTeaching ?? []);
  const [customLang, setCustomLang] = useState("");
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [customInterest, setCustomInterest] = useState("");

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [gallery, setGallery] = useState<GalleryImage[]>(initial?.galleryImages ?? []);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Handlers

  function toggleCountry(c: string) {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleChip(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function addCustomChip(
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
  ) {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
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
      if ("error" in res) { setError(res.error); return; }
      setAvatarUrl(res.url);
      await updateSession();
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
    if ("error" in res) { setError(res.error); return; }
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
      if ("error" in res) { setError(res.error); return; }
      if (res.id) {
        setGallery((prev) => [...prev, { id: res.id!, url: res.url, caption: "" }]);
      }
    } catch {
      setGalleryUploading(false);
      setError("Failed to process image. Try a different file.");
    }
  }

  async function handleGalleryDelete(imageId: string) {
    setError("");
    const res = await deleteGalleryImage(imageId);
    if ("error" in res) { setError(res.error); return; }
    setGallery((prev) => prev.filter((img) => img.id !== imageId));
  }

  function handleGalleryReorder(fromIndex: number, toIndex: number) {
    const newGallery = [...gallery];
    const [moved] = newGallery.splice(fromIndex, 1);
    newGallery.splice(toIndex, 0, moved);
    setGallery(newGallery);
  }

  function updateGalleryCaption(imageId: string, caption: string) {
    setGallery((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, caption } : img)),
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (selectedCountries.length === 0) {
      setError("Please select at least one target country.");
      return;
    }

    const payload = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      currentCountry: currentCountry.trim(),
      currentCity: currentCity.trim(),
      targetCountries: selectedCountries,
      visibility,
      meetupCoffee,
      meetupCityTour,
      meetupJobAdvice,
      meetupStudyGroup,
      meetupLanguageExchange,
      meetupVisaHelp,
      meetupSchoolReferrals,
      meetupExploring,
      relocationStage,
      lookingFor: lookingFor || null,
      certifications,
      languagesTeaching,
      interests,
      showCityPublicly,
    };

    startTransition(async () => {
      const res = await updateCommunityProfile(payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/community/${userId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="community-form">
      {error && <div className="form__error">{error}</div>}

      {/* Section 1: Basics */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Profile Basics</legend>

        <div className="form__avatar-section">
          <div className="form__avatar-preview">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Your profile photo" width={96} height={96} className="form__avatar-img" />
            ) : (
              <div className="form__avatar-placeholder">
                {(displayName[0] ?? "?").toUpperCase()}
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
              <button type="button" onClick={handleAvatarRemove} disabled={avatarUploading} className="btn btn--ghost btn--sm">
                Remove
              </button>
            )}
            <span className="form__avatar-hint">JPEG, PNG, or WebP. Max 2 MB.</span>
          </div>
        </div>

        <label className="form__label">
          Display Name *
          <input
            type="text"
            required
            minLength={2}
            maxLength={40}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="form__input"
            placeholder="How others will see you"
          />
          <span className="form__char-count">{displayName.length}/40</span>
        </label>

        <label className="form__label">
          Bio *
          <textarea
            required
            minLength={10}
            maxLength={240}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="form__input"
            placeholder="Tell the community a bit about yourself..."
          />
          <span className="form__char-count">{bio.length}/240</span>
          <span className="form__hint">Tip: mention your interests &amp; what you&apos;re looking for</span>
        </label>

        <div className="form__row">
          <label className="form__label form__label--half">
            Current Country
            <input
              type="text"
              maxLength={100}
              value={currentCountry}
              onChange={(e) => setCurrentCountry(e.target.value)}
              className="form__input"
              placeholder="e.g. United Kingdom"
            />
          </label>
          <label className="form__label form__label--half">
            Current City
            <input
              type="text"
              maxLength={100}
              value={currentCity}
              onChange={(e) => setCurrentCity(e.target.value)}
              className="form__input"
              placeholder="e.g. Glasgow"
            />
          </label>
        </div>

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
      </fieldset>

      {/* Section 2: Relocation */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Relocation Journey</legend>

        <label className="form__label">
          Current Stage
          <select
            value={relocationStage}
            onChange={(e) => setRelocationStage(e.target.value)}
            className="form__input"
          >
            {RELOCATION_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="form__hint">Where are you on your relocation journey?</span>
        </label>

      </fieldset>

      {/* Section 3: Experience */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Experience &amp; Teaching</legend>

        <div className="form__label">
          Certifications
          <div className="chip-picker">
            {CERTIFICATION_OPTIONS.map((cert) => (
              <button
                key={cert}
                type="button"
                onClick={() => toggleChip(certifications, setCertifications, cert)}
                className={`chip chip--selectable ${certifications.includes(cert) ? "chip--selected" : ""}`}
              >
                {cert}
              </button>
            ))}
          </div>
          <div className="form__inline-add">
            <input
              type="text"
              value={customCert}
              onChange={(e) => setCustomCert(e.target.value)}
              placeholder="Add custom certification..."
              className="form__input form__input--sm"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomChip(customCert, certifications, setCertifications, setCustomCert);
                }
              }}
            />
            <button
              type="button"
              onClick={() => addCustomChip(customCert, certifications, setCertifications, setCustomCert)}
              className="btn btn--outline btn--sm"
            >
              Add
            </button>
          </div>
          {certifications.length > 0 && (
            <div className="chip-row chip-row--selected">
              {certifications.map((c) => (
                <span key={c} className="chip chip--removable" onClick={() => toggleChip(certifications, setCertifications, c)}>
                  {c} ✕
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="form__label">
          Looking For
          <select
            value={lookingFor ?? ""}
            onChange={(e) => setLookingFor(e.target.value || null)}
            className="form__input"
          >
            <option value="">Not specified</option>
            {LOOKING_FOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <div className="form__label">
          Comfortable Teaching Languages
          <div className="chip-picker">
            {["English", "Spanish", "French", "German", "Mandarin", "Japanese", "Korean"].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleChip(languagesTeaching, setLanguagesTeaching, lang)}
                className={`chip chip--selectable ${languagesTeaching.includes(lang) ? "chip--selected" : ""}`}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="form__inline-add">
            <input
              type="text"
              value={customLang}
              onChange={(e) => setCustomLang(e.target.value)}
              placeholder="Add language..."
              className="form__input form__input--sm"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomChip(customLang, languagesTeaching, setLanguagesTeaching, setCustomLang);
                }
              }}
            />
            <button
              type="button"
              onClick={() => addCustomChip(customLang, languagesTeaching, setLanguagesTeaching, setCustomLang)}
              className="btn btn--outline btn--sm"
            >
              Add
            </button>
          </div>
          {languagesTeaching.length > 0 && (
            <div className="chip-row chip-row--selected">
              {languagesTeaching.map((l) => (
                <span key={l} className="chip chip--removable" onClick={() => toggleChip(languagesTeaching, setLanguagesTeaching, l)}>
                  {l} ✕
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* Section 4: Meetups & Interests */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Meetups &amp; Interests</legend>

        <div className="form__label">
          Available For
          <div className="form__checkbox-grid form__checkbox-grid--chips">
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupCoffee} onChange={(e) => setMeetupCoffee(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupCoffee ? "chip--selected" : ""}`}>☕ Coffee meetups</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupCityTour} onChange={(e) => setMeetupCityTour(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupCityTour ? "chip--selected" : ""}`}>🏙️ City tour</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupJobAdvice} onChange={(e) => setMeetupJobAdvice(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupJobAdvice ? "chip--selected" : ""}`}>💼 Job advice</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupStudyGroup} onChange={(e) => setMeetupStudyGroup(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupStudyGroup ? "chip--selected" : ""}`}>📚 Study group</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupLanguageExchange} onChange={(e) => setMeetupLanguageExchange(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupLanguageExchange ? "chip--selected" : ""}`}>🗣️ Language exchange</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupVisaHelp} onChange={(e) => setMeetupVisaHelp(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupVisaHelp ? "chip--selected" : ""}`}>🛂 Visa help chat</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupSchoolReferrals} onChange={(e) => setMeetupSchoolReferrals(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupSchoolReferrals ? "chip--selected" : ""}`}>🏫 School referrals</span>
            </label>
            <label className="form__chip-label">
              <input type="checkbox" checked={meetupExploring} onChange={(e) => setMeetupExploring(e.target.checked)} className="sr-only" />
              <span className={`chip chip--selectable ${meetupExploring ? "chip--selected" : ""}`}>🏛️ Exploring temples</span>
            </label>
          </div>
        </div>

        <div className="form__label">
          Interests
          <div className="chip-picker">
            {SUGGESTED_INTERESTS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleChip(interests, setInterests, interest)}
                className={`chip chip--selectable ${interests.includes(interest) ? "chip--selected" : ""}`}
              >
                {interest}
              </button>
            ))}
          </div>
          <div className="form__inline-add">
            <input
              type="text"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              placeholder="Add custom interest..."
              className="form__input form__input--sm"
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomChip(customInterest, interests, setInterests, setCustomInterest);
                }
              }}
            />
            <button
              type="button"
              onClick={() => addCustomChip(customInterest, interests, setInterests, setCustomInterest)}
              className="btn btn--outline btn--sm"
            >
              Add
            </button>
          </div>
          {interests.filter((i) => !(SUGGESTED_INTERESTS as readonly string[]).includes(i)).length > 0 && (
            <div className="chip-row chip-row--selected">
              {interests.filter((i) => !(SUGGESTED_INTERESTS as readonly string[]).includes(i)).map((i) => (
                <span key={i} className="chip chip--removable" onClick={() => toggleChip(interests, setInterests, i)}>
                  {i} ✕
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* Section 5: Gallery */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Gallery Photos (up to 9)</legend>
        <p className="form__hint">Share photos with the community. Travel, teaching, etc. Drag to reorder.</p>

        <div className="form__gallery-grid">
          {gallery.map((img, index) => (
            <div
              key={img.id}
              className="form__gallery-item"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromIndex = Number(e.dataTransfer.getData("text/plain"));
                if (!isNaN(fromIndex)) handleGalleryReorder(fromIndex, index);
              }}
            >
              <Image src={img.url} alt="Gallery photo" width={200} height={200} className="form__gallery-img" />
              <button
                type="button"
                onClick={() => handleGalleryDelete(img.id)}
                className="form__gallery-delete"
                aria-label="Delete photo"
              >
                ✕
              </button>
              <input
                type="text"
                value={img.caption}
                onChange={(e) => updateGalleryCaption(img.id, e.target.value)}
                placeholder="Caption (optional)"
                maxLength={200}
                className="form__gallery-caption"
              />
              <span className="form__gallery-drag-handle" title="Drag to reorder">⋮⋮</span>
            </div>
          ))}

          {gallery.length < 9 && (
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

      {/* Section 6: Privacy */}
      <fieldset className="form__fieldset form__section">
        <legend className="form__section-title">Privacy &amp; Safety</legend>

        <label className="form__label">
          Profile Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="form__input"
          >
            <option value="PUBLIC">Public (anyone can view)</option>
            <option value="MEMBERS_ONLY">Members only (logged-in users)</option>
            <option value="PRIVATE">Private (only you and admins)</option>
          </select>
        </label>

        <label className="form__checkbox-label">
          <input
            type="checkbox"
            checked={showCityPublicly}
            onChange={(e) => setShowCityPublicly(e.target.checked)}
          />
          Show city publicly (if off, only your country will be shown)
        </label>
      </fieldset>

      {/* Sticky save bar */}
      <div className="form__sticky-bar">
        <a
          href={`/community/${userId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--outline btn--sm"
        >
          Preview public profile ↗
        </a>
        <button type="submit" disabled={pending} className="btn btn--primary">
          {pending ? "Saving..." : "Save Community Profile"}
        </button>
      </div>
    </form>
  );
}
