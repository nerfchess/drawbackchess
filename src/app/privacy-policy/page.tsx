import type { Metadata } from "next";
import { InfoPageLayout, InfoSection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Drawback Chess",
};

export default function PrivacyPolicyPage() {
  return (
    <InfoPageLayout
      eyebrow="privacy policy"
      title="Privacy policy"
      intro="This page describes how this version of Drawback Chess handles information while you play. Last updated: May 27, 2026."
    >
      <InfoSection title="Stored on your device">
        <p>
          Board appearance, sound preferences, custom rules, and your single-player rating
          may be saved in your browser&apos;s local or session storage. This lets those
          features work across page visits without requiring an account.
        </p>
        <p>
          You can remove this information by clearing site data in your browser.
        </p>
      </InfoSection>

      <InfoSection title="Analytics">
        <p>
          The site uses Vercel Analytics to understand basic site usage and performance.
          Analytics data is processed by Vercel according to its service practices.
        </p>
      </InfoSection>

      <InfoSection title="Friend games">
        <p>
          Friend games use PeerJS signaling to establish a browser-to-browser connection.
          A game code and connection metadata are used to connect players; game setup and
          moves are then exchanged between the participating browsers.
        </p>
      </InfoSection>

      <InfoSection title="Accounts and contact">
        <p>
          This version does not include user accounts or a contact submission form. If
          these features are introduced, this policy should be updated to describe any
          additional information collected.
        </p>
      </InfoSection>
    </InfoPageLayout>
  );
}
