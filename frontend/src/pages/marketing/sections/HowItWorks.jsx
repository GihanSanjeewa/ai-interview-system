import { motion } from "framer-motion";
import { Briefcase, Mic, Sparkles, Trophy } from "lucide-react";
import { SectionHeading } from "./Categories";

const steps = [
  {
    icon: Briefcase,
    title: "Pick your interview",
    desc: "Choose a role, difficulty and language. We tailor questions in real time.",
  },
  {
    icon: Mic,
    title: "Talk to the AI interviewer",
    desc: "Speak naturally. Aria asks follow-ups based on what you actually said.",
  },
  {
    icon: Sparkles,
    title: "Get a detailed report",
    desc: "6-metric scores, transcript highlights, strengths and weaknesses.",
  },
  {
    icon: Trophy,
    title: "Track your progress",
    desc: "Weekly trends, personalized coaching, replays. Repeat until ready.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From nervous to interview-ready in four steps"
        />

        <div className="relative mt-16">
          <div className="from-brand-500/0 via-brand-500/40 to-brand-500/0 absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r lg:block" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="relative z-10 mx-auto flex size-18 size-[72px] items-center justify-center rounded-2xl bg-surface border-token border">
                  <div className="from-brand-500 to-accent-500 absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br opacity-30 blur" />
                  <s.icon className="size-7 text-brand-400" />
                </div>
                <p className="font-display text-subtle text-center mt-4 text-xs font-semibold uppercase tracking-widest">
                  Step {i + 1}
                </p>
                <h3 className="text-default mt-1 text-center text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="text-muted mx-auto mt-2 max-w-xs text-center text-sm">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
