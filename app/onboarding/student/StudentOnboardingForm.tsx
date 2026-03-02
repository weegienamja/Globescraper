"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { completeStudentOnboarding } from "@/app/onboarding/actions";
import {
  ONBOARDING_COUNTRIES,
  STUDENT_INTERESTS,
  MOVING_TIMELINES,
} from "@/lib/validations/onboarding";

export function StudentOnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState(defaultName);
  const [currentCountry, setCurrentCountry] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [movingTimeline, setMovingTimeline] = useState("");

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const res = await completeStudentOnboarding({
        displayName,
        currentCountry,
        currentCity,
        targetCountries,
        interests,
        movingTimeline,
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
            placeholder="e.g. Bangkok"
            maxLength={100}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Countries you are interested in *</label>
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

      <div className="form-group">
        <label className="form-label" htmlFor="timeline">When are you planning to move?</label>
        <select
          id="timeline"
          value={movingTimeline}
          onChange={(e) => setMovingTimeline(e.target.value)}
          className="form__input"
        >
          <option value="">Select timeline</option>
          {MOVING_TIMELINES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Interests</label>
        <div className="chip-picker">
          {STUDENT_INTERESTS.map((item) => (
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
