import type { Metadata } from "next";
import Link from "next/link";
import { InfoPageLayout, InfoSection } from "@/components/InfoPageLayout";

export const metadata: Metadata = {
  title: "FAQ | Drawback Chess",
};

const FAQS = [
  {
    question: "Is this normal chess?",
    answer:
      "It begins from a chessboard, but not all standard chess rules survive. There is no checkmate or stalemate: the goal is usually to capture the enemy king.",
  },
  {
    question: "What is a drawback?",
    answer:
      "A drawback is your secret rule for the game. It may restrict your moves or create a new way for you to lose. Your opponent has a different hidden rule.",
  },
  {
    question: "Can I see my opponent's rule?",
    answer:
      "Not during the game. You infer it from their play; it is revealed once the game is over.",
  },
  {
    question: "Can I play a friend?",
    answer:
      "Yes. Create a friend game, send the five-character code, and your opponent can join from their browser.",
  },
  {
    question: "Do friend games require accounts?",
    answer:
      "No accounts are required. Friend games use a short connection code to link two browsers for the match.",
  },
  {
    question: "Where can I learn the unusual rules?",
    answer:
      "The How to play guide covers the core changes, and the rules library lets you browse the available drawbacks.",
  },
];

export default function FAQPage() {
  return (
    <InfoPageLayout
      eyebrow="questions"
      title="Frequently asked"
      intro="The short version: it is chess until your secret rule says otherwise. Here are the questions players usually ask first."
    >
      {FAQS.map((faq) => (
        <InfoSection key={faq.question} title={faq.question}>
          <p>{faq.answer}</p>
        </InfoSection>
      ))}

      <div className="pt-4 flex flex-wrap gap-3">
        <Link href="/tutorial" className="px-5 py-2.5 rounded-sm btn-leaf font-display">
          How to play
        </Link>
        <Link href="/codex" className="px-5 py-2.5 rounded-sm btn-ghost font-display">
          Browse rules
        </Link>
      </div>
    </InfoPageLayout>
  );
}
