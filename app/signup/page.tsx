import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a free GlobeScraper account to join the teaching community in Southeast Asia.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
