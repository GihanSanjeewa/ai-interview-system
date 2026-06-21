import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./Categories";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is Inverview AI a real interviewer or just a chatbot?",
    a: "It's a voice-first interviewer powered by a multi-modal model. It asks dynamic follow-ups based on what you actually say, with realistic prosody and timing.",
  },
  {
    q: "What roles do you support?",
    a: "Software engineering (FE, BE, full-stack), .NET, React, Node, system design, HR, behavioral and leadership. New tracks ship weekly.",
  },
  {
    q: "Do you record my camera?",
    a: "Only if you opt in. Recording stays on your device unless you explicitly upload it for review. Everything is end-to-end encrypted.",
  },
  {
    q: "Can I get a downloadable PDF report?",
    a: "Yes — every session generates a beautiful PDF report with scores, transcript highlights and a personalized improvement plan.",
  },
  {
    q: "Do you offer a student discount?",
    a: "We offer 60% off Pro for students with a valid .edu / institutional email.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts. Cancel from settings in two clicks.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-4 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Quick answers" />
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => (
            <button
              key={i}
              onClick={() => setOpen(open === i ? -1 : i)}
              className={cn(
                "bg-surface border-token w-full overflow-hidden rounded-2xl border text-left transition",
                open === i && "border-brand-500/40"
              )}
            >
              <div className="flex items-center justify-between p-5">
                <p className="text-default text-base font-semibold">{f.q}</p>
                <ChevronDown
                  className={cn(
                    "text-muted size-5 transition",
                    open === i && "rotate-180 text-brand-400"
                  )}
                />
              </div>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="text-muted px-5 pb-5 text-sm leading-relaxed">
                      {f.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
