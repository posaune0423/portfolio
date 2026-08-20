import React from "react";
import type { Metadata, Viewport } from "vinext/shims/metadata";
import Script from "vinext/shims/script";

import "./globals.css";
import AppShell from "../components/shared/app-shell";
import BackButton from "../components/shared/back-button";
import { gaMeasurementId, siteDescription, siteName, siteUrl } from "../constants/site";
import { LanguageProvider } from "../lib/language-context";

export const metadata: Metadata = {
  title: siteName,
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    siteName,
    locale: "en_US",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/twitter-image.jpg",
        alt: siteName,
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  minimumScale: 1,
};

const googleAnalyticsBootstrap = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag("js", new Date());
  gtag("config", "${gaMeasurementId}");
`;

// Vinext injects route/page metadata through the layout children tree, so the
// null page routes still need children rendered even though AppShell owns the UI.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {googleAnalyticsBootstrap}
        </Script>
        <LanguageProvider>
          <AppShell />
          <BackButton />
          {children}
          <div
            data-testid="build-badge"
            style={{
              position: "fixed",
              right: 12,
              bottom: 12,
              zIndex: 9999,
              padding: "4px 10px",
              borderRadius: 9999,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              font: "600 11px/1.4 ui-monospace, monospace",
              letterSpacing: "0.14em",
            }}
          >
            PREVIEW BUILD
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
