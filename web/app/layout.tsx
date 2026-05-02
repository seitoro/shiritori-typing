import type { Metadata } from "next";
import "./globals.css";
import { AdSenseScript } from "@/components/adsense-script";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "しりとりタイピング",
  description: "1人プレイと合言葉マッチング対戦ができる、しりとりタイピングサイト",
  keywords: ["しりとりタイピング", "しりとり", "タイピング", "日本語ゲーム", "ブラウザゲーム"],
  openGraph: {
    title: "しりとりタイピング",
    description: "1人プレイと合言葉マッチング対戦ができる、しりとりタイピングサイト",
    url: siteUrl,
    siteName: "しりとりタイピング",
    locale: "ja_JP",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "しりとりタイピング",
    description: "1人プレイと合言葉マッチング対戦ができる、しりとりタイピングサイト"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "しりとりタイピング",
    url: siteUrl,
    inLanguage: "ja",
    description: "1人プレイと合言葉マッチング対戦ができる、しりとりタイピングサイト"
  };

  return (
    <html lang="ja">
      <body>
        <AdSenseScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
