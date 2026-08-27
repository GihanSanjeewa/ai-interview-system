import { motion } from "framer-motion";
import { Award, Briefcase, FileUp, Mic, Sparkles, Trophy } from "lucide-react";
import { SectionHeading } from "./Categories";

const steps = [
  {
    step: "01",
    icon: FileUp,
    title: "Upload Your CV",
    desc: "Drop your PDF or DOCX resume. Our NLP engine extracts your demonstrated skills and matches tailored interview tracks.",
    accent: "from-brand-500 to-indigo-600",
  },
  {
    step: "02",
    icon: Briefcase,
    title: "Configure Your Loop",
    desc: "Select your target role, difficulty level, persona (Aria, Marcus, Kenji), and language (English or Sinhala).",
    accent: "from-cyan-400 to-blue-600",
  },
  {
    step: "03",
    icon: Mic,
    title: "Live Conversational Mock",
    desc: "Speak naturally into your mic. The AI conducts a multi-round interview with real-time follow-up probes and speech telemetry.",
    accent: "from-purple-500 to-pink-600",
  },
  {
    step: "04",
    icon: Award,
    title: "Get Scored & Matched",
    desc: "Receive your comprehensive 6-metric report, curated learning resources, and automatic recommendations for matched tech jobs.",
    accent: "from-emerald-400 to-teal-600",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Workflow"
          title="From Pre-Interview Jitters to Offer-Ready"
          subtitle="A structured 4-step practice loop engineered to build confidence and master technical answers."
        />

        <div className="relative mt-16">
          <div className="from-brand-500/0 via-brand-500/30 to-brand-500/0 absolute left-0 right-0 top-12 hidden h-0.5 bg-gradient-to-r lg:block" />

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: i * 0.1 }}
                className="glass-card relative rounded-3xl p-6 border border-token flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.accent} text-white shadow-lg`}
                    >
                      <s.icon className="size-6" />
                    </div>
                    <span className="font-display text-2xl font-extrabold text-subtle/50">
                      {s.step}
                    </span>
                  </div>

                  <h3 className="text-default font-display text-lg font-bold mt-6">
                    {s.title}
                  </h3>
                  <p className="text-muted mt-2 text-xs sm:text-sm leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-token/60 flex items-center gap-1.5 text-brand-400 text-xs font-semibold">
                  <Sparkles className="size-3.5" />
                  <span>Interactive Step</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
