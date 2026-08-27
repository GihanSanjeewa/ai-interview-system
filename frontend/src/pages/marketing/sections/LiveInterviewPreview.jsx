import { motion } from "framer-motion";
import { Bot, Mic, Sparkles, Video, Volume2 } from "lucide-react";
import { SectionHeading } from "./Categories";
import Badge from "@/components/ui/Badge";

export default function LiveInterviewPreview() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Realistic Studio Environment"
          title="Feels like a live technical screen at a top company"
          subtitle="Dual video feeds, natural conversational pauses, animated speech visualizers, and streaming word-by-word transcription."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="glass-strong mt-14 rounded-3xl border border-token p-4 sm:p-6 shadow-2xl shadow-brand-900/15"
        >
          {/* Top Bar */}
          <div className="bg-surface border border-token flex flex-wrap items-center justify-between rounded-2xl px-5 py-3 gap-3">
            <div className="flex items-center gap-3">
              <span className="size-3 animate-pulse rounded-full bg-rose-500 shadow-sm" />
              <span className="text-default text-xs sm:text-sm font-bold tracking-wider">
                LIVE INTERVIEW ROOM
              </span>
              <span className="text-subtle text-xs">· 00:14:32</span>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="brand" size="sm">
                Software Engineering Loop
              </Badge>
              <Badge variant="outline" size="sm">
                Intermediate Tier
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-surface-2 border border-token rounded-xl px-3 py-1 text-xs font-semibold text-muted">
                Question 4 of 8
              </div>
            </div>
          </div>

          {/* Dual Feed Split */}
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            {/* Left AI Video Feed */}
            <div className="lg:col-span-7">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1c38] via-[#121327] to-[#0c0d18] border border-token flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(124,93,250,0.2),transparent_65%)]" />

                {/* Top overlay */}
                <div className="absolute left-4 top-4 flex items-center gap-2 z-10">
                  <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white">
                    Aria · AI Lead Interviewer
                  </span>
                  <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Speaking
                  </span>
                </div>

                <div className="absolute right-4 top-4 z-10">
                  <span className="rounded-full bg-black/60 backdrop-blur-md size-8 flex items-center justify-center text-white/80">
                    <Volume2 className="size-4" />
                  </span>
                </div>

                {/* Pulsing AI Sphere */}
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-brand-400/40" />
                  <div className="relative grid size-36 place-items-center rounded-full bg-brand-500/20 backdrop-blur-2xl border border-white/20 shadow-2xl">
                    <div className="size-24 rounded-full bg-gradient-to-br from-brand-500 via-brand-600 to-accent-500 flex items-center justify-center text-white shadow-lg">
                      <Bot className="size-12" />
                    </div>
                  </div>
                </div>

                {/* Soundwave Bars */}
                <div className="absolute inset-x-0 bottom-4 flex justify-center items-end gap-1.5 z-10">
                  {[0.25, 0.65, 0.9, 0.5, 0.8, 1, 0.7, 0.45, 0.85, 0.6, 0.3].map((h, i) => (
                    <span
                      key={i}
                      className="wave-bar"
                      style={{
                        height: `${h * 28 + 6}px`,
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Candidate Viewport + Live Transcript */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              {/* Candidate Self View simulation */}
              <div className="bg-surface-2 border border-token relative aspect-[16/9] overflow-hidden rounded-2xl flex flex-col justify-between p-3.5">
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 text-white text-[10px] font-semibold">
                    <Video className="size-3 text-emerald-400" />
                    <span>You (Candidate)</span>
                  </div>
                  <div className="size-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white shadow">
                    <Mic className="size-3.5" />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="size-16 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    YOU
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 z-10">
                  <div className="glass-strong rounded-xl px-2.5 py-1.5 text-center">
                    <p className="text-[10px] font-semibold text-subtle uppercase">Eye Contact</p>
                    <p className="text-xs font-bold text-emerald-400">96% (Natural)</p>
                  </div>
                  <div className="glass-strong rounded-xl px-2.5 py-1.5 text-center">
                    <p className="text-[10px] font-semibold text-subtle uppercase">Speech Cadence</p>
                    <p className="text-xs font-bold text-accent-400">142 WPM</p>
                  </div>
                </div>
              </div>

              {/* Streaming Transcript */}
              <div className="bg-surface border border-token rounded-2xl p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-subtle uppercase tracking-wider">
                    <span>Live Transcript</span>
                    <span className="text-emerald-400">Acoustic Synced</span>
                  </div>
                  <div className="mt-3 space-y-2 text-xs leading-relaxed">
                    <p>
                      <strong className="text-brand-400">Aria:</strong> "Walk me through how you’d handle a cache invalidation storm on your distributed API."
                    </p>
                    <p className="text-muted">
                      <strong className="text-emerald-400">You:</strong> "I’d implement probabilistic early expiration with jittered TTLs, backed by Redis sentinel..."
                      <span className="cursor-blink" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
