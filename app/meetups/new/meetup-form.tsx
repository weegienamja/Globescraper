"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMeetup } from "@/app/meetups/actions";
import { COMMUNITY_COUNTRIES } from "@/lib/validations/community";

export function MeetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const maxAttendeesRaw = (fd.get("maxAttendees") as string).trim();

    const payload = {
      title: (fd.get("title") as string).trim(),
      description: (fd.get("description") as string).trim(),
      country: fd.get("country") as string,
      city: (fd.get("city") as string).trim(),
      dateTime: fd.get("dateTime") as string,
      locationHint: (fd.get("locationHint") as string).trim(),
      maxAttendees: maxAttendeesRaw ? parseInt(maxAttendeesRaw) : null,
      visibility: fd.get("visibility") as string,
    };

    startTransition(async () => {
      const res = await createMeetup(payload);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/meetups/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="community-form">
      {error && <div className="form__error">{error}</div>}

      <label className="form__label">
        Title *
        <input
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          className="form__input"
          placeholder="e.g. Teachers coffee meetup in Ho Chi Minh City"
        />
      </label>

      <label className="form__label">
        Description *
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="form__input"
          placeholder="What's this meetup about? Who should join?"
        />
      </label>

      <div className="form__row">
        <label className="form__label">
          Country *
          <select name="country" required className="form__input">
            <option value="">Select a country</option>
            {COMMUNITY_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="form__label">
          City *
          <input
            name="city"
            type="text"
            required
            maxLength={100}
            className="form__input"
            placeholder="e.g. Ho Chi Minh City"
          />
        </label>
      </div>

      <label className="form__label">
        Date & Time *
        <input
          name="dateTime"
          type="datetime-local"
          required
          className="form__input"
        />
      </label>

      <label className="form__label">
        Location Hint (optional)
        <input
          name="locationHint"
          type="text"
          maxLength={200}
          className="form__input"
          placeholder='e.g. "near Riverside" (never share an exact address)'
        />
      </label>

      <label className="form__label">
        Max Attendees (optional)
        <input
          name="maxAttendees"
          type="number"
          min={2}
          max={100}
          className="form__input"
          placeholder="Leave blank for no limit"
        />
      </label>

      <label className="form__label">
        Visibility
        <select name="visibility" defaultValue="MEMBERS_ONLY" className="form__input">
          <option value="MEMBERS_ONLY">Members only (logged-in users)</option>
          <option value="PUBLIC">Public (anyone can view)</option>
        </select>
      </label>

      <button type="submit" disabled={pending} className="btn btn--primary">
        {pending ? "Creating..." : "Create Meetup"}
      </button>
    </form>
  );
}
