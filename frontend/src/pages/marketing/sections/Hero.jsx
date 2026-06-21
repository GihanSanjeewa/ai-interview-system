import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Mic,
  PlayCircle,
  Sparkles,
  Star,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { CountUp } from "@/components/ui/Counter";

const aiQuestions = [
  "Tell me about a complex system you designed.",
  "Walk me through how React reconciliation works.",
  "Describe a time you led under pressure.",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 lg:pt-32">
      <div className="hero-grid absolute inset-0 opacity-50" />
      <div className="glow-blob from-brand-500 to-accent-500 left-[10%] top-[-10%] size-[420px] bg-gradient-to-br" />
      <div className="glow-blob right-[5%] top-[20%] size-[380px] bg-gradient-to-br from-pink-500 to-violet-500 opacity-50" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-4 lg:grid-cols-12 lg:px-8">
        {/* Copy */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="border-brand-500/30 bg-brand-500/10 text-brand-300 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
          >
            <Sparkles className="size-3.5" />
            <span>New · Multi-modal AI interviewer 4.7</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.7 }}
            className="font-display text-default mt-5 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Practice real interviews
            <br />
            with an{" "}
            <span className="gradient-text">AI Interviewer</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="text-muted mt-6 max-w-xl text-base sm:text-lg"
          >
            A human-like AI conducts your mock interview — asks follow-ups,
            reads your tone, and gives you a 6-metric performance report. Like
            a real interviewer, only patient.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link to="/register">
              <Button size="lg" leftIcon={Mic} rightIcon={ArrowRight}>
                Start Mock Interview
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="glass" leftIcon={PlayCircle}>
                Watch demo
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center gap-6"
          >
            <div className="flex -space-x-2">
              {["#7a72ff", "#22d3ee", "#fb7185", "#fbbf24"].map((c, i) => (
                <div
                  key={i}
                  className="size-9 rounded-full ring-2 ring-[var(--bg)]"
                  style={{ background: `linear-gradient(135deg, ${c}, #5b51ff)` }}
                />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-amber-400 text-amber-400"
                  />
                ))}
                <span className="text-default ml-1.5 text-sm font-semibold">
                  4.9
                </span>
              </div>
              <p className="text-subtle text-xs">
                Trusted by{" "}
                <span className="text-default font-semibold">
                  <CountUp to={28000} suffix="+" />
                </span>{" "}
                candidates worldwide
              </p>
            </div>
          </motion.div>
        </div>

        {/* Visual */}
        <div className="lg:col-span-5">
          <HeroVisual questions={aiQuestions} />
        </div>
      </div>
    </section>
  );
}

function HeroVisual({ questions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.8 }}
      className="relative"
    >
      <div className="glass-strong rounded-3xl border p-6 shadow-2xl shadow-black/30">
        {/* Faux window */}
        <div className="mb-4 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="text-subtle ml-3 text-xs font-medium">
            Live Interview · Senior React Engineer
          </span>
        </div>

        {/* AI avatar */}
        <div className="from-brand-600 via-brand-500 to-accent-500 relative aspect-[5/3] overflow-hidden rounded-2xl bg-gradient-to-br">
          <div className="absolute inset-0">
            <div className="absolute left-6 top-6 flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-white/90">LIVE</span>
              <span className="text-xs text-white/70">· 02:14</span>
            </div>

            <div className="absolute right-6 top-6 text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/70">
                Interviewer
              </p>
              <p className="text-sm font-semibold text-white">Aria · AI</p>
            </div>

            {/* Avatar */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-white/40" />
                <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-white/30 [animation-delay:0.4s]" />
                <div className="relative grid size-28 place-items-center rounded-full bg-white/15 backdrop-blur-xl">
                  <svg viewBox="0 0 24 24" className="size-12 text-white" fill="currentColor">
                    <circle cx="12" cy="8" r="4" opacity="0.9" />
                    <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" opacity="0.9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-1">
              {[0.2, 0.45, 0.8, 0.5, 0.95, 0.6, 0.3].map((h, i) => (
                <span
                  key={i}
                  className="wave-bar"
                  style={{
                    height: `${h * 28 + 8}px`,
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-surface-2 border-token mt-4 rounded-2xl border p-4">
          <p className="text-subtle text-[10px] uppercase tracking-wider">
            Question 4 / 8
          </p>
          <p className="text-default mt-1.5 text-sm leading-relaxed">
            {questions[0]}
            <span className="cursor-blink" />
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Confidence" value="86%" tone="emerald" />
          <Stat label="Clarity" value="91%" tone="brand" />
          <Stat label="Pace" value="WPM 142" tone="accent" />
        </div>
      </div>

      {/* Floating cards */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="glass-strong absolute -left-6 top-12 hidden rounded-2xl border p-3 shadow-xl sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
          <p className="text-default text-xs font-semibold">
            Voice synced · LipSync v2
          </p>
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, delay: 0.6 }}
        className="glass-strong absolute -right-4 bottom-16 hidden rounded-2xl border p-3 shadow-xl sm:block"
      >
        <p className="text-subtle text-[10px] uppercase tracking-wider">
          Overall score
        </p>
        <p className="font-display text-default text-2xl font-bold">
          8.7<span className="text-muted text-sm">/10</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    emerald: "from-emerald-400/30 to-emerald-500/10 text-emerald-400",
    brand: "from-brand-400/30 to-brand-500/10 text-brand-400",
    accent: "from-accent-400/30 to-accent-500/10 text-accent-400",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-2.5`}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-90">
        {label}
      </p>
      <p className="text-default mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}
