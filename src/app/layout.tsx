import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { getBaseUrl } from "@/lib/urls";
import { getSettings } from "@/lib/models/Settings";
import { GrowthScripts } from "@/components/monetization/GrowthScripts";
import { CookieConsent } from "@/components/monetization/CookieConsent";
import { UserProvider } from "@/lib/useUser";
import { WebVitalsReporter } from "@/components/observability/WebVitalsReporter";
import { serializeJsonLd } from "@/lib/json-ld";

const BASE_URL = getBaseUrl();

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const siteName = settings?.siteName || "PhoneDock";
  const titleSuffix = settings?.titleSuffix || `${siteName} Pakistan`;
  const description = settings?.metaDescription || "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan. Complete specs, benchmarks, and price tracking for all brands.";
  const ogImage = settings?.ogImage || "/og-image.png";
  const favicon = settings?.favicon || "/logo.svg";

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: `${siteName} - Pakistan's #1 Smartphone Database | Specs, Prices & Reviews`,
      template: `%s | ${titleSuffix}`,
    },
    description,
    keywords: ["smartphone Pakistan", "phone price PKR", "PTA approved phones", "mobile specs", "phone comparison", "Samsung price Pakistan", "iPhone price Pakistan", "Xiaomi Pakistan", "phone reviews", "best camera phone", "best gaming phone", "smartphone", "Pakistan", "phone price", "PTA", "mobile", "specs", "compare", "reviews", "Samsung", "Apple", "Xiaomi", "OnePlus", "Realme", "Infinix", "Tecno"],
    authors: [{ name: siteName, url: BASE_URL }],
    creator: siteName,
    publisher: siteName,
    openGraph: {
      title: `${siteName} - Pakistan's #1 Smartphone Database`,
      description,
      type: "website",
      url: BASE_URL,
      siteName,
      locale: "en_PK",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${siteName} - Pakistan's Smartphone Database` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} - Pakistan's Smartphone Database`,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
    },
    alternates: { canonical: BASE_URL },
    applicationName: siteName,
    category: "technology",
    manifest: "/manifest.webmanifest",
    icons: { icon: favicon, shortcut: favicon, apple: favicon },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
        : undefined,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3B82F6",
};

const jsonLdWebSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PhoneDock",
  url: BASE_URL,
  description: "Pakistan's #1 Smartphone Database - Compare specs, prices, PTA status, and read expert reviews",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const jsonLdOrg = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PhoneDock",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.svg`,
  description: "Pakistan's #1 Smartphone Database - Compare specs, prices, PTA status, and read expert reviews for all major phone brands in Pakistan.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "info@phonedock.pk",
    availableLanguage: ["English", "Urdu"],
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "PK",
  },
};

const jsonLdAll = [jsonLdWebSite, jsonLdOrg];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings().catch(() => null);
  const theme = settings?.theme;
  const primaryColor = theme?.primaryColor ? String(theme.primaryColor) : '';
  const secondaryColor = theme?.secondaryColor ? String(theme.secondaryColor) : '';
  const accentColor = theme?.accentColor ? String(theme.accentColor) : '';
  const themeStyle = (primaryColor || secondaryColor || accentColor)
    ? `:root{${primaryColor ? `--primary:${primaryColor};--ring:${primaryColor};` : ''}${secondaryColor ? `--secondary:${secondaryColor};` : ''}${accentColor ? `--accent:${accentColor};` : ''}}`
    : '';
  return (
    <html lang="en-PK" suppressHydrationWarning>
      <head>
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
        {jsonLdAll.map((item, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
          />
        ))}
      </head>
      <body className="font-sans antialiased">
        <WebVitalsReporter />
        <GrowthScripts />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm">Skip to content</a>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <UserProvider>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          </UserProvider>
        </ThemeProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
