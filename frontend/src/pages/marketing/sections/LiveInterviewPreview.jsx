import { motion } from "framer-motion";
import { Mic, Video } from "lucide-react";
import { SectionHeading } from "./Categories";

export default function LiveInterviewPreview() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Realistic experience"
          title="Feels like a real Zoom interview"
          subtitle="Two-panel layout, eye-contact simulation, live transcript and emotion-aware reactions."
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="glass-strong mt-14 rounded-3xl border p-3 shadow-2xl shadow-brand-900/20"
        >
          <div className="bg-surface flex items-center justify-between rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
              <span className="text-default text-sm font-semibold">REC</span>
              <span className="text-subtle text-xs">· 00:12:48</span>
            </div>
            <div className="text-subtle text-xs font-medium">
              Senior React Engineer · Intermediate
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-surface-2 border-token rounded-lg border px-2 py-1 text-[11px] font-semibold">
                3 / 8
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            {/* AI tile */}
            <div className="lg:col-span-3">
              <div className="from-brand-700 via-brand-500 to-accent-500 relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br">
                <div className="absolute inset-0">
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Aria · AI
                    </span>
                    <span className="rounded-full bg-emerald-500/90 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                      Speaking
                    </span>
                  </div>

                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-white/40" />
                      <div className="relative grid size-40 place-items-center rounded-full bg-white/15 backdrop-blur-xl">
                        <svg viewBox="0 0 24 24" className="size-16 text-white" fill="currentColor">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1">
                    {[0.3, 0.7, 0.9, 0.5, 0.8, 0.4, 0.6, 0.9, 0.3].map((h, i) => (
                      <span
                        key={i}
                        className="wave-bar"
                        style={{
                          height: `${h * 24 + 6}px`,
                          animationDelay: `${i * 0.06}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* User tile + chips */}
            <div className="grid gap-3 lg:col-span-2">
              <div className="bg-surface-2 border-token relative aspect-video overflow-hidden rounded-2xl border">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.06),transparent_60%)]" />
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/40 px-2 py-1">
                  <Video className="size-3 text-white" />
                  <span className="text-[10px] font-semibold uppercase text-white">
                    You
                  </span>
                </div>
                <div className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-emerald-500/80">
                  <Mic className="size-3.5 text-white" />
                </div>
                <div className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2">
                  <Pill label="Eye contact" value="93%" />
                  <Pill label="Energy" value="High" />
                </div>
              </div>

              <div className="bg-surface border-token rounded-2xl border p-4">
                <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
                  Transcript
                </p>
                <p className="text-default mt-1.5 text-sm leading-relaxed">
                  <span className="text-brand-400 font-semibold">Aria:</span>{" "}
                  How would you handle hydration mismatches in a Next.js app?
                </p>
                <p className="text-default mt-2 text-sm leading-relaxed">
                  <span className="text-emerald-400 font-semibold">You:</span>{" "}
                  I'd start by checking for browser-only globals like{" "}
                  <span className="bg-emerald-500/15 text-emerald-300 rounded px-1">window</span>{" "}
                  inside render, and use <code>useEffect</code>…
                  <span className="cursor-blink" />
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Pill({ label, value }) {
  return (
    <div className="glass-strong rounded-xl border p-2">
      <p className="text-[10px] font-semibold uppercase text-white/70">
        {label}
      </p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}
