import type { Metadata } from "next";
import { Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "DayWeave — Make time for what matters",
  description:
    "A calm live wishlist maximizer for one meaningful day in Hong Kong. DayWeave protects must-visits, adapts with permission and reveals what not to miss.",
  applicationName: "DayWeave",
  category: "travel",
  keywords: [
    "Hong Kong day planner",
    "travel wishlist optimizer",
    "adaptive itinerary",
    "DayWeave",
    "AURORA",
  ],
  authors: [{ name: "DayWeave" }],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "DayWeave — Make time for what matters",
    description:
      "Bring the places you already love. DayWeave protects what matters and calmly reshapes the day when plans change.",
    type: "website",
    locale: "en_HK",
    siteName: "DayWeave",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "DayWeave postcard with a coral route thread, Hong Kong skyline and Wivi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DayWeave — Make time for what matters",
    description:
      "A calm live wishlist maximizer for one meaningful day in Hong Kong.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${interTight.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
