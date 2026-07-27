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
    "DayWeave recommends the day worth taking and reveals what not to miss at every stop, with adaptive routing where verified destination data is available.",
  applicationName: "DayWeave",
  category: "travel",
  keywords: [
    "destination day planner",
    "travel wishlist optimizer",
    "adaptive itinerary",
    "what not to miss travel guide",
    "DayWeave",
    "AURORA",
  ],
  authors: [{ name: "DayWeave" }],
  icons: {
    icon: [{ url: "/dayweave-mark.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "DayWeave — Make time for what matters",
    description:
      "Protect the moments you saved for, know what makes each stop worth it, and adapt the day without rushing it.",
    type: "website",
    locale: "en_HK",
    siteName: "DayWeave",
    images: [
      {
        url: "/og-v2.png",
        width: 1536,
        height: 1024,
        alt: "DayWeave postcard weaving a city, park and coast into one calm route with Wivi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DayWeave — Make time for what matters",
    description:
      "A calm, actionable day that protects what you went for and reveals what not to miss.",
    images: ["/og-v2.png"],
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
