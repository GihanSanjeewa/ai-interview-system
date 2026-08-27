import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react";
import { SectionHeading } from "./Categories";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How does the AI interviewer generate follow-up questions?",
    a: "The multi-modal intelligence engine listens to your spoken answer via high-fidelity Whisper transcription, analyzes technical completeness, and generates context-aware follow-ups to probe deeper into trade-offs or clarify missing points.",
  },
  {
    q: "What roles and technical tracks are supported?",
    a: "We support Software Engineering, React & Modern Frontend, Node.js & Backend Services, System Design, Data Science & Machine Learning, Cloud Networking, UI/UX Engineering, and Behavioral STAR-method interviews.",
  },
  {
    q: "Is my webcam or microphone audio kept private?",
    a: "Yes. Your audio and transcripts are strictly private to your account. Video processing for eye contact and presence is handled locally in your browser, and your data is never used to train public AI models.",
  },
  {
    q: "How does the CV analysis tailor the interview?",
    a: "When you upload your CV in PDF or DOCX format, our parser extracts your technologies, years of experience, and past projects. The interview studio then customizes questions around your actual past tech stack.",
  },
  {
    q: "What metrics are included in the performance report?",
    a: "Every mock interview outputs a 6-metric breakdown: Confidence & Presence, Communication Clarity, Response Relevance, Technical Depth, Fluency, and Speaking Pace (WPM), along with strengths and areas for improvement.",
  },
  {
    q: "Can I practice in languages other than English?",
    a: "Yes! Inverview AI currently supports practice in English and Sinhala (සිංහල), with native prosody and specialized speech-to-text models.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="py-24 relative">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Frequently Asked Questions"
          title="Everything You Need to Know"
          subtitle="Clear answers on how the AI evaluates, how your privacy is protected, and how to get the most out of your mock sessions."
        />

        <div className="mt-14 space-y-3.5">
          {faqs.map((f, i) => (
            <div
              key={i}
              className={cn(
                "glass-card overflow-hidden rounded-2xl border transition-all duration-200",
                open === i ? "border-brand-500/50 shadow-md shadow-brand-500/10" : "border-token"
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-surface-2/50 cursor-pointer"
              >
                <span className="text-default font-display text-base font-bold sm:text-lg pr-4">
                  {f.q}
                </span>
                <div
                  className={cn(
                    "size-8 rounded-xl bg-surface-2 flex items-center justify-center text-muted transition-transform duration-300 shrink-0",
                    open === i && "rotate-180 bg-brand-500/15 text-brand-400"
                  )}
                >
                  <ChevronDown className="size-4" />
                </div>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 text-muted text-sm leading-relaxed border-t border-token/40">
                      {f.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
