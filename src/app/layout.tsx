import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const inter = localFont({
  src: "../fonts/Inter.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "300 700",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

const jetbrains = localFont({
  src: "../fonts/JetBrainsMono.woff2",
  variable: "--font-mono-jb",
  display: "swap",
  weight: "100 800",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: "AETHER — Mission Operations Console",
  description:
    "AETHER is a cinematic mission control interface with a real-time 3D orbital console, synchronized telemetry and a scrubbable mission timeline. All data is simulated.",
  applicationName: "AETHER",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05070B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-void text-txt antialiased">{children}</body>
    </html>
  );
}
