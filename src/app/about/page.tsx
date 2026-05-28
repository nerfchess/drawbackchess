import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageLayout, InfoSection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "About | Drawback Chess",
};

export default function AboutPage() {
  return (
    <InfoPageLayout
      eyebrow="about"
      title="Chess, with secrets."
      intro="Drawback Chess keeps the familiar board and replaces certainty with hidden constraints. Every player receives a secret rule, and every move becomes both strategy and investigation."
    >
      <InfoSection title="The idea">
        <p>
          Standard chess rewards calculation. Drawback Chess adds deduction: a move your
          opponent avoids may reveal as much as the move they choose.
        </p>
        <p>
          Kings can be captured, checkmate is not the ending, and unusual rules can turn
          ordinary positions into puzzles that only exist for one game.
        </p>
      </InfoSection>

      <InfoSection title="Play your way">
        <p>
          Practice against the computer, create a private game for a friend, or browse the
          rule library before you sit down at the board.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <Link href="/play" className="px-5 py-2.5 rounded-sm btn-leaf font-display">
            Start a game
          </Link>
          <Link href="/tutorial" className="px-5 py-2.5 rounded-sm btn-ghost font-display">
            Read the rules
          </Link>
        </div>
      </InfoSection>
    </InfoPageLayout>
  );
}
