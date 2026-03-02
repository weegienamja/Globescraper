import Link from "next/link";

export const metadata = {
  title: "Account Locked | GlobeScraper",
  robots: { index: false },
};

export default function AccountLockedPage() {
  return (
    <div className="onboarding-page">
      <div className="onboarding-page__container" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
        <h1 className="onboarding-page__title">Account Locked</h1>
        <p className="onboarding-page__subtitle">
          Your account has been suspended or banned. If you believe this is a
          mistake, please contact support.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href="mailto:support@globescraper.com" className="btn btn--primary">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
