import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageLayout, InfoSection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "Contact | Drawback Chess",
};

export default function ContactPage() {
  return (
    <InfoPageLayout
      eyebrow="contact"
      title="Get in touch"
      intro="Have a rule idea, found a confusing position, or spotted something that needs fixing? Feedback is welcome as Drawback Chess develops."
    >
      <InfoSection title="Contact channel">
        <p>
          A public contact address has not been published for this version of the site yet.
          This page is ready for the project&apos;s preferred support email or community
          link once one is chosen.
        </p>
      </InfoSection>

      <InfoSection title="Looking for help playing?">
        <p>
          The tutorial explains the changed win conditions and hidden-rule format, while
          the FAQ answers the most common first-game questions.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <Link href="/tutorial" className="px-5 py-2.5 rounded-sm btn-leaf font-display">
            How to play
          </Link>
          <Link href="/faq" className="px-5 py-2.5 rounded-sm btn-ghost font-display">
            Read the FAQ
          </Link>
        </div>
      </InfoSection>
    </InfoPageLayout>
  );
}
