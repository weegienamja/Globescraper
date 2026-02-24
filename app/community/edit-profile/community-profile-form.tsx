"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCommunityProfile } from "@/app/community/actions";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

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
};

export function CommunityProfileForm({
  initial,
}: {
  initial: ProfileData | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    initial?.targetCountries ?? [],
  );
  const [pending, startTransition] = useTransition();

  function toggleCountry(c: string) {
    setSelectedCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
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
