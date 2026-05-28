import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Brain,
  FileText,
  MessageSquare,
  Mic2,
  Repeat2,
  Shield,
  Sparkles,
} from "lucide-react";
import { SectionHeading } from "./Categories";

const items = [
  {
    icon: Bot,
    title: "Human-like AI interviewer",
    desc: "Lifelike voice, emotion-aware responses, natural follow-ups.",
  },
  {
    icon: Mic2,
    title: "Real-time speech analysis",
    desc: "Detects pauses, fillers (uhm, like), tone and confidence.",
  },
  {
    icon: BarChart3,
    title: "6-metric scoring engine",
    desc: "Technical, communication, clarity, confidence, depth, pace.",
  },
  {
    icon: MessageSquare,
    title: "Live transcript",
    desc: "Word-for-word transcript with highlighted strong & weak moments.",
  },
  {
    icon: FileText,
    title: "PDF performance report",
    desc: "Beautiful exportable reports you can share with recruiters or coaches.",
  },
  {
    icon: Repeat2,
    title: "Adaptive difficulty",
    desc: "Questions ramp up with your level, replay any session anytime.",
  },
  {
    icon: Brain,
    title: "Personalized coaching",
    desc: "Curated learning paths based on your weaknesses.",
  },
  {
    icon: Shield,
    title: "Privacy-first",
    desc: "End-to-end encryption. Your data never trains a public model.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Why Inverview"
          title="Everything you need to interview with confidence"
          subtitle="A serious training studio dressed up as a delightful product."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface border-token rounded-2xl border p-6 transition hover:border-brand-500/40"
            >
              <div className="from-brand-500/20 to-accent-500/20 border-brand-500/30 text-brand-400 flex size-10 items-center justify-center rounded-xl border bg-gradient-to-br">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-default mt-5 text-base font-semibold">
                {f.title}
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
