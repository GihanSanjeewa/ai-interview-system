import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, CheckCircle2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

const highlights = [
  {
    icon: Bot,
    title: "Multi-Modal AI Interviewer",
    desc: "Lifelike speech, active follow-ups, and natural conversation flow.",
  },
  {
    icon: Zap,
    title: "Instant 6-Metric Telemetry",
    desc: "Technical depth, clarity, relevance, confidence, fluency, and WPM pace.",
  },
  {
    icon: ShieldCheck,
    title: "100% Private & Free Practice",
    desc: "End-to-end encrypted sessions with zero public model training.",
  },
];

export default function AuthLayout() {
  return (
    <div className="bg-app text-default relative min-h-screen overflow-hidden selection:bg-brand-500 selection:text-white">
      {/* Dynamic Background */}
      <div className="hero-grid absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-blob from-brand-500/25 to-accent-500/20 left-[-10%] top-[-15%] size-[520px] bg-gradient-to-br" />
      <div className="glow-blob right-[-10%] top-[30%] size-[480px] bg-gradient-to-br from-pink-500/20 to-purple-600/20 opacity-50" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        {/* Left Visual / Branding Panel */}
        <div className="hidden flex-1 flex-col justify-between p-12 lg:flex">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo size="lg" />
            </Link>
          </div>

          <div className="my-auto py-10 max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold text-brand-300 backdrop-blur-md"
            >
              <Sparkles className="size-3.5" />
              <span>Next-Gen Candidate Preparation Studio</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="font-display text-default text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl mt-5"
            >
              Step into the <br />
              <span className="gradient-text">interview room.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-muted mt-4 text-sm leading-relaxed"
            >
              Practice realistic mock interviews tailored to your exact CV and target tracks.
              Get scored, receive targeted coaching, and walk in confident.
            </motion.p>

            <div className="mt-8 space-y-3.5">
              {highlights.map((h, i) => (
                <motion.div
                  key={h.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="glass-card flex items-start gap-4 rounded-2xl p-4 border border-token"
                >
                  <div className="from-brand-500 to-accent-500 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md">
                    <h.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-default text-sm font-bold">{h.title}</p>
                    <p className="text-muted text-xs mt-0.5 leading-relaxed">{h.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-subtle text-xs">
            <span>© {new Date().getFullYear()} Inverview AI.</span>
            <span>All practice is 100% free & open.</span>
          </div>
        </div>

        {/* Right Form Card Panel */}
        <div className="flex flex-1 flex-col p-6 sm:p-10 lg:p-12 justify-between">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="text-muted hover:text-default inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to Home
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="lg:hidden">
                <Logo size="sm" />
              </div>
            </div>
          </div>

          <div className="my-auto flex items-center justify-center py-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-strong w-full max-w-md rounded-3xl p-7 sm:p-9 border border-token shadow-2xl shadow-black/10"
            >
              <Outlet />
            </motion.div>
          </div>

          <div className="text-center text-subtle text-xs">
            Protected by multi-layer encryption & privacy protocols.
          </div>
        </div>
      </div>
    </div>
  );
}
