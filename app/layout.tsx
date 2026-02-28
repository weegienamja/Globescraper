import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteLayout } from "@/components/SiteLayout";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { Providers } from "@/components/Providers";
import { WebSiteJsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/main_logo.png",
    apple: "/main_logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/og-default.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline theme script — runs before first paint to prevent FOUC */}
        <meta name="impact-site-verification" content="080dbf66-2fa5-45d3-a9d6-1838f83eaa10" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t)t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <WebSiteJsonLd />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
            </Script>
          </>
        )}
        <AnalyticsProvider />
        <Providers>
          <SiteLayout>{children}</SiteLayout>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
