"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { completeTeacherOnboarding } from "@/app/onboarding/actions";
import {
  ONBOARDING_COUNTRIES,
  TEACHING_LANGUAGES,
  TEACHER_LOOKING_FOR,
  TEACHER_INTERESTS,
} from "@/lib/validations/onboarding";

export function TeacherOnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState(defaultName);
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [teflTesol, setTeflTesol] = useState(false);
  const [teachingLanguage, setTeachingLanguage] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const res = await completeTeacherOnboarding({
        displayName,
        currentCountry,
        currentCity,
        targetCountries,
        teflTesol,
        teachingLanguage,
        lookingFor,
        interests,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      await updateSession();
      router.push("/community");
    });
  }

  return (
    <div className="onboarding-form">
      {/* Display Name */}
      <div className="form-group">
        <label className="form-label" htmlFor="displayName">Display name *</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="form__input"
          placeholder="How others will see you"
          maxLength={40}
        />
      </div>

      {/* Location */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="currentCountry">Current country *</label>
          <select
            id="currentCountry"
            value={currentCountry}
            onChange={(e) => setCurrentCountry(e.target.value)}
            className="form__input"
          >
            <option value="">Select country</option>
            {ONBOARDING_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="United Kingdom">United Kingdom</option>
            <option value="United States">United States</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="South Africa">South Africa</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="currentCity">City</label>
          <input
            id="currentCity"
            type="text"
            value={currentCity}
            onChange={(e) => setCurrentCity(e.target.value)}
            className="form__input"
            placeholder="e.g. Glasgow, London"
            maxLength={100}
          />
        </div>
      </div>

      {/* Target Countries */}
      <div className="form-group">
        <label className="form-label">Where are you heading? *</label>
        <div className="chip-picker">
          {ONBOARDING_COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleItem(targetCountries, setTargetCountries, c)}
              className={`chip chip--toggle ${targetCountries.includes(c) ? "chip--active" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* TEFL/TESOL */}
      <div className="form-group">
        <label className="form-label">TEFL/TESOL Certified?</label>
        <div className="toggle-row">
          <button
            type="button"
            onClick={() => setTeflTesol(true)}
            className={`btn btn--sm ${teflTesol ? "btn--primary" : "btn--outline"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setTeflTesol(false)}
            className={`btn btn--sm ${!teflTesol ? "btn--primary" : "btn--outline"}`}
          >
            Not yet
          </button>
        </div>
      </div>

      {/* Teaching Language */}
      <div className="form-group">
        <label className="form-label" htmlFor="teachingLanguage">Primary teaching focus</label>
        <select
          id="teachingLanguage"
          value={teachingLanguage}
          onChange={(e) => setTeachingLanguage(e.target.value)}
          className="form__input"
        >
          <option value="">Select one</option>
          {TEACHING_LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Looking For */}
      <div className="form-group">
        <label className="form-label">What are you looking for?</label>
        <div className="chip-picker">
          {TEACHER_LOOKING_FOR.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleItem(lookingFor, setLookingFor, item)}
              className={`chip chip--toggle ${lookingFor.includes(item) ? "chip--active" : ""}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="form-group">
        <label className="form-label">Interests (pick a few)</label>
        <div className="chip-picker">
          {TEACHER_INTERESTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleItem(interests, setInterests, item)}
              className={`chip chip--toggle ${interests.includes(item) ? "chip--active" : ""}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="btn btn--primary btn--lg onboarding-form__submit"
      >
        {pending ? "Saving..." : "Complete setup"}
      </button>
    </div>
  );
}
