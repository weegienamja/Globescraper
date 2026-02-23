import "./globals.css";
import type { Metadata } from "next";
import { SiteLayout } from "@/components/SiteLayout";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "GlobeScraper",
  description: "Teach English in Cambodia. Guides, costs, visas, and support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteLayout>{children}</SiteLayout>
        <Analytics />
      </body>
    </html>
  );
}
