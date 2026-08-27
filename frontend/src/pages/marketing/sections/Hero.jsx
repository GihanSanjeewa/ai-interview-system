import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CountUp } from "@/components/ui/Counter";

const aiQuestions = [
  "Walk me through how you architect high-scale microservices.",
  "Describe a time you resolved a critical production incident under pressure.",
  "How does React 19's compiler optimize component re-renders?",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-12 lg:pt-20">
      {/* Background Lighting */}
      <div className="hero-grid absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-blob from-brand-500/30 to-accent-500/20 left-[10%] -top-[10%] size-[500px] bg-gradient-to-br" />
      <div className="glow-blob right-[5%] top-[15%] size-[460px] bg-gradient-to-br from-pink-500/20 to-purple-600/20 opacity-60" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-4 lg:grid-cols-12 lg:items-center lg:px-8">
        {/* Copy Column */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-300 shadow-sm backdrop-blur-md"
          >
            <Sparkles className="size-3.5 text-brand-400" />
            <span>Next-Gen Multi-Modal AI Interviewer 4.7</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="font-display text-default mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Ace your real interviews with an{" "}
            <span className="gradient-text">Adaptive AI</span> Interviewer.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-muted mt-6 max-w-xl text-base sm:text-lg leading-relaxed"
          >
            Practice lifelike technical, behavioral, and leadership interviews.
            Aria listens, probes with real-time follow-ups, analyzes your speech prosody,
            and delivers actionable 6-metric feedback reports.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-3.5"
          >
            <Link to="/register">
              <Button size="lg" leftIcon={Mic} rightIcon={ArrowRight} className="shadow-glow">
                Start Mock Interview
              </Button>
            </Link>
            <a href="#preview">
              <Button size="lg" variant="secondary" leftIcon={Play}>
                Watch Live Demo
              </Button>
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-12 flex flex-wrap items-center gap-6 pt-6 border-t border-token/60"
          >
            <div className="flex -space-x-2.5">
              {[
                "from-violet-500 to-indigo-500",
                "from-cyan-400 to-blue-500",
                "from-pink-500 to-rose-500",
                "from-emerald-400 to-teal-500",
                "from-amber-400 to-orange-500",
              ].map((grad, i) => (
                <div
                  key={i}
                  className={`size-10 rounded-full ring-2 ring-[var(--bg)] bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shadow`}
                >
                  {["AK", "SR", "ML", "JC", "DV"][i]}
                </div>
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
                <span className="text-default ml-1.5 text-sm font-bold">
                  4.95 / 5
                </span>
              </div>
              <p className="text-subtle text-xs mt-0.5">
                Trusted by{" "}
                <span className="text-default font-semibold">
                  <CountUp to={32000} suffix="+" /> candidates
                </span>{" "}
                landing top tech roles
              </p>
            </div>
          </motion.div>
        </div>

        {/* Visual Mockup Column */}
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
      initial={{ opacity: 0, scale: 0.95, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <div className="glass-strong rounded-3xl border border-token p-5 sm:p-6 shadow-2xl shadow-black/20">
        {/* Window Chrome Header */}
        <div className="mb-4 flex items-center justify-between border-b border-token/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-rose-400/90" />
            <span className="size-3 rounded-full bg-amber-400/90" />
            <span className="size-3 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Session · Senior Full Stack Engineer</span>
          </div>
        </div>

        {/* AI Video Feed Simulation */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-[#1b1b36] via-[#121324] to-[#0d0e1a] border border-token">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(124,93,250,0.25),transparent_60%)]" />

          {/* Header Badges */}
          <div className="absolute left-4 top-4 flex items-center gap-2 z-10">
            <span className="rounded-full bg-rose-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
              REC · 04:18
            </span>
            <span className="rounded-full bg-black/50 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-semibold text-white/90">
              Aria AI (Voice v4)
            </span>
          </div>

          <div className="absolute right-4 top-4 z-10">
            <Badge variant="brand" size="xs">
              Speaking
            </Badge>
          </div>

          {/* AI Avatar Face in Center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-brand-400/40" />
              <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-accent-400/30 [animation-delay:0.5s]" />
              <div className="relative grid size-28 place-items-center rounded-full bg-gradient-to-br from-brand-500/30 to-accent-500/20 backdrop-blur-xl border border-white/20 shadow-2xl">
                <div className="size-20 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white shadow-inner">
                  <Bot className="size-10 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Waveform Bars */}
          <div className="absolute inset-x-0 bottom-4 flex items-end justify-center gap-1 z-10">
            {[0.3, 0.6, 0.95, 0.45, 0.85, 1, 0.7, 0.4, 0.8, 0.5, 0.25].map((h, i) => (
              <span
                key={i}
                className="wave-bar"
                style={{
                  height: `${h * 32 + 6}px`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Live Question Card */}
        <div className="bg-surface-2 border border-token mt-4 rounded-2xl p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-subtle uppercase tracking-wider">
            <span>Question 3 of 7 · System Design</span>
            <span className="text-brand-400">Technical Probe</span>
          </div>
          <p className="text-default mt-2 text-sm font-medium leading-relaxed">
            "{questions[0]}"
            <span className="cursor-blink" />
          </p>
        </div>

        {/* Live Telemetry Chips */}
        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          <StatChip label="Confidence" value="92%" tone="emerald" />
          <StatChip label="Clarity" value="89%" tone="brand" />
          <StatChip label="Pace" value="138 wpm" tone="accent" />
        </div>
      </div>

      {/* Floating Auxiliary Badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="glass-strong absolute -left-6 top-16 hidden rounded-2xl border border-token p-3 shadow-xl sm:flex items-center gap-2.5"
      >
        <div className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <div className="text-left">
          <p className="text-[10px] uppercase font-bold text-subtle">Real-Time Prosody</p>
          <p className="text-xs font-bold text-default">Whisper ASR Synced</p>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, delay: 0.8, ease: "easeInOut" }}
        className="glass-strong absolute -right-5 bottom-14 hidden rounded-2xl border border-token p-3.5 shadow-xl sm:block text-left"
      >
        <p className="text-[10px] uppercase font-bold text-subtle">
          Predicted Readiness
        </p>
        <p className="font-display text-default text-2xl font-extrabold mt-0.5">
          94<span className="text-muted text-sm font-semibold">/100</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

function StatChip({ label, value, tone }) {
  const tones = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
    brand: "from-brand-500/15 to-brand-500/5 text-brand-400 border-brand-500/20",
    accent: "from-accent-500/15 to-accent-500/5 text-accent-400 border-accent-500/20",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${tones[tone]} p-2.5 text-center`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-85">
        {label}
      </p>
      <p className="text-default mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}
