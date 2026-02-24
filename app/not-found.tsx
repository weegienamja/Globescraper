import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <h1 className="not-found__code">404</h1>
      <h2 className="not-found__title">Page not found</h2>
      <p className="not-found__text">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="not-found__links">
        <Link href="/" className="btn">
          Go home
        </Link>
        <Link href="/blog" className="not-found__link">
          Browse the blog
        </Link>
      </div>
    </div>
  );
}
