"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useState } from "react";
import {
  TARGET_COUNTRIES,
  DEGREE_STATUSES,
  TEACHING_EXPERIENCES,
  CERTIFICATION_STATUSES,
  DESIRED_START_TIMELINES,
  SAVINGS_BANDS,
  COUNTRY_LABELS,
  DEGREE_LABELS,
  EXPERIENCE_LABELS,
  CERTIFICATION_LABELS,
  TIMELINE_LABELS,
  SAVINGS_LABELS,
} from "@/lib/validations/profile";

type TargetCountry = (typeof TARGET_COUNTRIES)[number];

export function CreateProfileForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<TargetCountry[]>([]);
  const { update: updateSession } = useSession();
  const router = useRouter();

  function toggleCountry(country: TargetCountry) {
    setSelectedCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country],
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    const payload = {
      passportCountry: (fd.get("passportCountry") as string).trim(),
      degreeStatus: fd.get("degreeStatus") as string,
      nativeEnglish: fd.get("nativeEnglish") === "true",
      teachingExperience: fd.get("teachingExperience") as string,
      certificationStatus: fd.get("certificationStatus") as string,
      targetCountries: selectedCountries,
      desiredStartTimeline: fd.get("desiredStartTimeline") as string,
      savingsBand: fd.get("savingsBand") as string,
    };

    if (selectedCountries.length === 0) {
      setError("Please select at least one target country.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    setLoading(false);
    // Refresh JWT so hasProfile is updated
    await updateSession();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="profile-card">
        <h1 className="auth-title">Complete Your Profile</h1>
        <p className="auth-subtitle">
          Tell us about yourself so we can match you with the right teaching
          opportunities.
        </p>

        {error && <p className="auth-error">{error}</p>}

        {/* Passport Country */}
        <label className="auth-label">
          <span className="auth-label-text">Passport Country</span>
          <input
            name="passportCountry"
            type="text"
            required
            placeholder="e.g. United States, South Africa, United Kingdom"
            className="auth-input"
          />
        </label>

        {/* Degree Status */}
        <label className="auth-label">
          <span className="auth-label-text">Highest Degree</span>
          <select name="degreeStatus" required className="auth-input">
            {DEGREE_STATUSES.map((val) => (
              <option key={val} value={val}>
                {DEGREE_LABELS[val]}
              </option>
            ))}
          </select>
        </label>

        {/* Native English */}
        <label className="auth-label">
          <span className="auth-label-text">Native English Speaker?</span>
          <select name="nativeEnglish" required className="auth-input">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>

        {/* Teaching Experience */}
        <label className="auth-label">
          <span className="auth-label-text">Teaching Experience</span>
          <select name="teachingExperience" required className="auth-input">
            {TEACHING_EXPERIENCES.map((val) => (
              <option key={val} value={val}>
                {EXPERIENCE_LABELS[val]}
              </option>
            ))}
          </select>
        </label>

        {/* Certification */}
        <label className="auth-label">
          <span className="auth-label-text">
            TEFL / TESOL / CELTA Certification
          </span>
          <select name="certificationStatus" required className="auth-input">
            {CERTIFICATION_STATUSES.map((val) => (
              <option key={val} value={val}>
                {CERTIFICATION_LABELS[val]}
              </option>
            ))}
          </select>
        </label>

        {/* Target Countries — checkbox group */}
        <fieldset className="profile-fieldset">
          <legend className="auth-label-text">
            Target Countries (select all that apply)
          </legend>
          <div className="profile-checkbox-grid">
            {TARGET_COUNTRIES.map((country) => (
              <label key={country} className="profile-checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedCountries.includes(country)}
                  onChange={() => toggleCountry(country)}
                  className="profile-checkbox"
                />
                <span>{COUNTRY_LABELS[country]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Desired Start Timeline */}
        <label className="auth-label">
          <span className="auth-label-text">When do you want to start?</span>
          <select name="desiredStartTimeline" required className="auth-input">
            {DESIRED_START_TIMELINES.map((val) => (
              <option key={val} value={val}>
                {TIMELINE_LABELS[val]}
              </option>
            ))}
          </select>
        </label>

        {/* Savings Band */}
        <label className="auth-label">
          <span className="auth-label-text">Available Savings</span>
          <select name="savingsBand" required className="auth-input">
            {SAVINGS_BANDS.map((val) => (
              <option key={val} value={val}>
                {SAVINGS_LABELS[val]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={loading} className="auth-button">
          {loading ? "Saving…" : "Complete Profile"}
        </button>
      </form>
    </div>
  );
}
