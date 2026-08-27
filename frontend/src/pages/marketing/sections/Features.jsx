import { motion } from "framer-motion";
import {
  Activity,
  Award,
  Bot,
  Brain,
  CheckCircle2,
  Cpu,
  FileCheck,
  FileText,
  Lock,
  MessageSquareCode,
  Mic2,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { SectionHeading } from "./Categories";

export default function Features() {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="AI Capabilities"
          title="Powered by Deep Multi-Modal Intelligence"
          subtitle="Everything you need to transform your interview performance from hesitant to hiring-manager approved."
        />

        {/* Bento Grid Layout */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Bento 1: AI Speech & Emotion Telemetry (Large Tile) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card relative overflow-hidden rounded-3xl p-7 lg:col-span-2 border border-token"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                  <Mic2 className="size-6" />
                </div>
                <div>
                  <h3 className="font-display text-default text-xl font-bold">
                    Acoustic & Speech Prosody Telemetry
                  </h3>
                  <p className="text-muted text-xs">
                    Real-time speech-to-text with acoustic tone & cadence metrics
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Telemetry
              </span>
            </div>

            <p className="text-muted mt-4 text-sm leading-relaxed max-w-2xl">
              Unlike basic chatbots, Inverview AI measures your speaking speed (WPM),
              pauses, filler words ("um", "like", "you know"), pitch variance, and confidence
              intervals using high-precision acoustic analysis.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-2 border border-token rounded-2xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-subtle">Target WPM</span>
                <p className="text-default font-display text-xl font-extrabold mt-0.5">130–150</p>
                <p className="text-emerald-400 text-[10px] font-semibold mt-1">Optimal Tempo</p>
              </div>
              <div className="bg-surface-2 border border-token rounded-2xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-subtle">Filler Detection</span>
                <p className="text-default font-display text-xl font-extrabold mt-0.5">&lt; 2.5%</p>
                <p className="text-emerald-400 text-[10px] font-semibold mt-1">Clean Cadence</p>
              </div>
              <div className="bg-surface-2 border border-token rounded-2xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-subtle">Voice Tone</span>
                <p className="text-default font-display text-xl font-extrabold mt-0.5">Engaged</p>
                <p className="text-brand-400 text-[10px] font-semibold mt-1">High Energy</p>
              </div>
              <div className="bg-surface-2 border border-token rounded-2xl p-3.5 text-center">
                <span className="text-[10px] uppercase font-bold text-subtle">Confidence</span>
                <p className="text-default font-display text-xl font-extrabold mt-0.5">94%</p>
                <p className="text-accent-400 text-[10px] font-semibold mt-1">Strong Delivery</p>
              </div>
            </div>
          </motion.div>

          {/* Bento 2: 6-Metric Scoring Engine */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-3xl p-7 border border-token flex flex-col justify-between"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-accent-400 border border-accent-500/30">
                <Activity className="size-6" />
              </div>
              <h3 className="font-display text-default text-xl font-bold mt-5">
                6-Metric Scoring Engine
              </h3>
              <p className="text-muted text-xs mt-1.5 leading-relaxed">
                Objective, multi-dimensional assessment on every response:
              </p>
              <div className="mt-4 space-y-2 text-xs font-semibold text-default">
                {["Confidence & Presence", "Communication Clarity", "Response Relevance", "Technical Depth", "Linguistic Fluency", "Speaking Pace"].map((m, i) => (
                  <div key={m} className="flex items-center justify-between py-1 border-b border-token/60">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="size-1.5 rounded-full bg-brand-400" />
                      {m}
                    </span>
                    <span className="text-brand-400">{(90 - i * 3)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Bento 3: CV-Tailored Questions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-3xl p-7 border border-token flex flex-col justify-between"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                <FileCheck className="size-6" />
              </div>
              <h3 className="font-display text-default text-xl font-bold mt-5">
                CV-to-Interview Tailoring
              </h3>
              <p className="text-muted text-xs mt-2 leading-relaxed">
                Upload your resume in PDF/DOCX. Our NLP parser extracts your skills, technologies,
                and previous projects, crafting hyper-tailored scenario questions based on your real experience.
              </p>
            </div>
            <div className="mt-6 rounded-2xl bg-surface-2 border border-token p-3 text-xs text-muted flex items-center gap-2.5">
              <Sparkles className="size-4 text-brand-400 shrink-0" />
              <span>Tailors deep-dive questions based on your stated tech stack.</span>
            </div>
          </motion.div>

          {/* Bento 4: Dynamic Follow-Ups & Probing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-7 border border-token flex flex-col justify-between"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Brain className="size-6" />
              </div>
              <h3 className="font-display text-default text-xl font-bold mt-5">
                Adaptive Follow-Up Probing
              </h3>
              <p className="text-muted text-xs mt-2 leading-relaxed">
                Aria reacts directly to your answers. Provide a shallow answer and she'll ask for trade-offs;
                excel and she'll raise the complexity to test your architectural ceiling.
              </p>
            </div>
            <div className="mt-6 rounded-2xl bg-surface-2 border border-token p-3 text-xs text-muted flex items-center gap-2.5">
              <Zap className="size-4 text-emerald-400 shrink-0" />
              <span>Handles "I don't know" gracefully and pivots dynamically.</span>
            </div>
          </motion.div>

          {/* Bento 5: Privacy & Local First */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="glass-card rounded-3xl p-7 border border-token flex flex-col justify-between"
          >
            <div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="font-display text-default text-xl font-bold mt-5">
                Privacy-First Architecture
              </h3>
              <p className="text-muted text-xs mt-2 leading-relaxed">
                Your practice audio and transcripts stay strictly private. No audio is ever used
                for training public models. Camera data is processed client-side.
              </p>
            </div>
            <div className="mt-6 rounded-2xl bg-surface-2 border border-token p-3 text-xs text-muted flex items-center gap-2.5">
              <Lock className="size-4 text-rose-400 shrink-0" />
              <span>Full data encryption and instant deletion on demand.</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
