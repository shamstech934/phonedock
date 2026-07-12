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
  title: "PhoneDock - Pakistan's #1 Smartphone Database | Specs, Prices & Reviews",
  description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan. Complete specs, benchmarks, and price tracking for all brands.",
  keywords: ["smartphone Pakistan", "phone price PKR", "PTA approved phones", "mobile specs", "phone comparison", "Samsung price Pakistan", "iPhone price Pakistan", "Xiaomi Pakistan", "phone reviews", "best camera phone", "best gaming phone", "smartphone", "Pakistan", "phone price", "PTA", "mobile", "specs", "compare", "reviews", "Samsung", "Apple", "Xiaomi"],
  authors: [{ name: "PhoneDock" }],
  openGraph: {
    title: "PhoneDock - Pakistan's #1 Smartphone Database | Specs, Prices & Reviews",
    description: "Compare smartphones, check PTA status, read expert reviews, and find the best prices in Pakistan. Complete specs, benchmarks, and price tracking for all brands.",
    type: "website",
    url: "https://phonedock.pk",
    siteName: "PhoneDock",
  },
  twitter: {
    card: "summary_large_image",
    title: "PhoneDock - Pakistan's Smartphone Database",
    description: "Compare smartphones, check prices, and find the best phone in Pakistan",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://phonedock.pk" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}