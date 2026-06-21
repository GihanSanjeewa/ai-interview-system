import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

const highlights = [
  {
    icon: Sparkles,
    title: "Human-like AI interviewer",
    desc: "Realistic voice, expressions, and follow-up questions.",
  },
  {
    icon: Zap,
    title: "Instant 6-metric feedback",
    desc: "Technical, communication, clarity, confidence, pace, depth.",
  },
  {
    icon: ShieldCheck,
    title: "Private & secure",
    desc: "Your recordings stay yours. Local-first by default.",
  },
];

export default function AuthLayout() {
  return (
    <div className="bg-app text-default relative min-h-screen overflow-hidden">
      <div className="hero-grid absolute inset-0 opacity-60" />
      <div className="glow-blob from-brand-500 to-accent-500 left-[-10%] top-[-20%] size-[480px] bg-gradient-to-br" />
      <div className="glow-blob right-[-10%] top-[40%] size-[420px] bg-gradient-to-br from-pink-500 to-violet-500 opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        {/* Left brand panel */}
        <div className="hidden flex-1 flex-col justify-between p-12 lg:flex">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          <div>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-display text-default text-4xl font-bold leading-tight tracking-tight xl:text-5xl"
            >
              Step into the<br />
              <span className="gradient-text">interview room.</span>
            </motion.h2>
            <p className="text-muted mt-4 max-w-md">
              Practice mock interviews with a human-like AI interviewer.
              Get scored, get coached, get hired.
            </p>

            <div className="mt-10 space-y-4">
              {highlights.map((h, i) => (
                <motion.div
                  key={h.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="glass flex items-start gap-4 rounded-2xl p-4"
                >
                  <div className="from-brand-500 to-accent-500 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white">
                    <h.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-default text-sm font-semibold">
                      {h.title}
                    </p>
                    <p className="text-muted text-xs">{h.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-subtle text-xs">
            © {new Date().getFullYear()} Inverview AI. All rights reserved.
          </p>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 flex-col p-6 sm:p-10 lg:p-12">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="text-muted hover:text-default inline-flex items-center gap-1.5 text-sm font-medium transition"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="lg:hidden">
                <Logo />
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md"
            >
              <Outlet />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
