import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "PhoneDock - Pakistan's #1 Smartphone Database",
  description: "Compare smartphones, check prices in PKR, read reviews, and find the best phone for you. PTA status, specs, and prices for Pakistan.",
  keywords: ["smartphone", "Pakistan", "phone price", "PTA", "mobile", "specs", "compare", "reviews", "Samsung", "Apple", "Xiaomi"],
  authors: [{ name: "PhoneDock" }],
  openGraph: {
    title: "PhoneDock - Pakistan's Smartphone Database",
    description: "Compare smartphones, check prices, and find the best phone in Pakistan",
    type: "website",
  },
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