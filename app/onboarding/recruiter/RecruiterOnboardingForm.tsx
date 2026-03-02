"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeRecruiterOnboarding } from "@/app/onboarding/actions";
import { ONBOARDING_COUNTRIES } from "@/lib/validations/onboarding";

export function RecruiterOnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [targetCities, setTargetCities] = useState<string[]>([]);

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  function addCity() {
    const trimmed = cityInput.trim();
    if (trimmed && !targetCities.includes(trimmed)) {
      setTargetCities([...targetCities, trimmed]);
    }
    setCityInput("");
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const res = await completeRecruiterOnboarding({
        companyName,
        website,
        targetCountries,
        targetCities,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/community/recruiter-dashboard");
    });
  }

  return (
    <div className="onboarding-form">
      <div className="form-group">
        <label className="form-label" htmlFor="companyName">Company name *</label>
        <input
          id="companyName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="form__input"
          placeholder="Your school or agency name"
          maxLength={200}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="website">Website</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="form__input"
          placeholder="https://yourschool.com"
        />
      </div>

      <div className="form-group">
        <label className="form-label">Target countries *</label>
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
        <label className="form-label">Target cities</label>
        <div className="input-with-add">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCity(); } }}
            className="form__input"
            placeholder="Add a city and press Enter"
            maxLength={100}
          />
          <button type="button" onClick={addCity} className="btn btn--outline btn--sm">Add</button>
        </div>
        {targetCities.length > 0 && (
          <div className="chip-picker chip-picker--mt">
            {targetCities.map((city) => (
              <span key={city} className="chip chip--removable">
                {city}
                <button
                  type="button"
                  onClick={() => setTargetCities(targetCities.filter((c) => c !== city))}
                  className="chip__remove"
                  aria-label={`Remove ${city}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
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
