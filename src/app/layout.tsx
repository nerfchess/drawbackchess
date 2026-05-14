import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drawback Chess — Chess, but with secret rules",
  description:
    "A modern, modern reimagining of Drawback Chess. Every player has a secret rule. Find theirs before they find yours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="no-tap-highlight">{children}</body>
    </html>
  );
}
