import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://phonedock.pk"),
  title: {
    default: "PhoneDock - Pakistan's #1 Smartphone Database | Specs, Prices & Reviews",
    template: "%s | PhoneDock Pakistan",
  },
  description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan. Complete specs, benchmarks, and price tracking for all brands.",
  keywords: ["smartphone Pakistan", "phone price PKR", "PTA approved phones", "mobile specs", "phone comparison", "Samsung price Pakistan", "iPhone price Pakistan", "Xiaomi Pakistan", "phone reviews", "best camera phone", "best gaming phone", "smartphone", "Pakistan", "phone price", "PTA", "mobile", "specs", "compare", "reviews", "Samsung", "Apple", "Xiaomi", "OnePlus", "Realme", "Infinix", "Tecno"],
  authors: [{ name: "PhoneDock", url: "https://phonedock.pk" }],
  creator: "PhoneDock",
  publisher: "PhoneDock",
  openGraph: {
    title: "PhoneDock - Pakistan's #1 Smartphone Database",
    description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan.",
    type: "website",
    url: "https://phonedock.pk",
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
  alternates: { canonical: "https://phonedock.pk" },
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3B82F6",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PhoneDock",
  url: "https://phonedock.pk",
  description: "Pakistan's #1 Smartphone Database - Compare specs, prices, PTA status, and read expert reviews",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://phonedock.pk/#/search/{search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}