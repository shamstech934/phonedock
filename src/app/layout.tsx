import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://phonedock.pk';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "PhoneDock - Pakistan's #1 Smartphone Database | Specs, Prices & Reviews",
    template: "%s | PhoneDock Pakistan",
  },
  description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan. Complete specs, benchmarks, and price tracking for all brands.",
  keywords: ["smartphone Pakistan", "phone price PKR", "PTA approved phones", "mobile specs", "phone comparison", "Samsung price Pakistan", "iPhone price Pakistan", "Xiaomi Pakistan", "phone reviews", "best camera phone", "best gaming phone", "smartphone", "Pakistan", "phone price", "PTA", "mobile", "specs", "compare", "reviews", "Samsung", "Apple", "Xiaomi", "OnePlus", "Realme", "Infinix", "Tecno"],
  authors: [{ name: "PhoneDock", url: BASE_URL }],
  creator: "PhoneDock",
  publisher: "PhoneDock",
  openGraph: {
    title: "PhoneDock - Pakistan's #1 Smartphone Database",
    description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan.",
    type: "website",
    url: BASE_URL,
    siteName: "PhoneDock",
    locale: "en_PK",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "PhoneDock - Pakistan's Smartphone Database" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PhoneDock - Pakistan's Smartphone Database",
    description: "Compare smartphones, check prices, and find the best phone in Pakistan",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: BASE_URL },
  icons: { icon: "/logo.svg" },
};

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {jsonLdAll.map((item, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}