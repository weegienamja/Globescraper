"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/app/onboarding/actions";

const ROLES = [
  {
    value: "TEACHER" as const,
    emoji: "👩‍🏫",
    title: "Teacher",
    description:
      "Moving or living in Southeast Asia? Join the community to find friends, get advice, and share your journey.",
    cta: "Sign up",
  },
  {
    value: "STUDENT" as const,
    emoji: "📚",
    title: "Student",
    description:
      "Looking to study or do some language exchange? Join the community to connect with teachers and learners.",
    cta: "Sign up",
  },
  {
    value: "RECRUITER" as const,
    emoji: "🏢",
    title: "Recruiter",
    description:
      "Recruiting English teachers? Find qualified candidates with our search filters and view teacher profiles.",
    cta: "Connect",
  },
];

export function RoleSelector() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  function handleSelect(role: string) {
    setSelectedRole(role);
    setError("");

    startTransition(async () => {
      const res = await setUserRole({ role });
      if ("error" in res) {
        setError(res.error);
        setSelectedRole(null);
        return;
      }

      // Route to role-specific onboarding
      if (role === "TEACHER") router.push("/onboarding/teacher");
      else if (role === "STUDENT") router.push("/onboarding/student");
      else if (role === "RECRUITER") router.push("/onboarding/recruiter");
    });
  }

  return (
    <>
      <div className="role-cards">
        {ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => handleSelect(role.value)}
            disabled={pending}
            className={`role-card ${
              selectedRole === role.value ? "role-card--selected" : ""
            }`}
            aria-label={`Select ${role.title}`}
          >
            <div className="role-card__avatar">
              <span className="role-card__emoji">{role.emoji}</span>
            </div>
            <h2 className="role-card__title">{role.title}</h2>
            <p className="role-card__description">{role.description}</p>
            <span className="role-card__cta btn btn--primary btn--sm">
              {pending && selectedRole === role.value
                ? "Setting up..."
                : role.cta}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="form__error onboarding-page__error">{error}</p>}
    </>
  );
}
