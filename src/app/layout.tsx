import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SettingsBootstrap } from "@/components/SettingsBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drawback Chess · chess with secret rules",
  description:
    "Every player gets a secret rule. Win the game and figure out theirs before they figure out yours.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="no-tap-highlight font-body">
        <SettingsBootstrap />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
