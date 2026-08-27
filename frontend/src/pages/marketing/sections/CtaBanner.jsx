import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Mic, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CtaBanner() {
  return (
    <section className="px-4 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 p-10 sm:p-16 text-white shadow-2xl shadow-brand-500/25"
        >
          {/* Background Ambient Glows */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="hero-grid absolute inset-0 opacity-20 pointer-events-none" />

          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="size-3.5" />
                <span>Start Practicing Instantly</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl mt-4">
                Ready to land your dream offer?
              </h2>
              <p className="mt-4 max-w-xl text-white/90 text-sm sm:text-base leading-relaxed">
                Step into the mock interview room with Aria right now. Pick a track, speak naturally,
                and walk away with detailed scores and actionable feedback.
              </p>
            </div>

            <div className="flex flex-wrap gap-3.5 lg:col-span-4 lg:justify-end">
              <Link to="/register">
                <Button
                  size="lg"
                  className="!bg-white !text-brand-700 hover:!bg-white/90 shadow-xl font-bold"
                  leftIcon={Mic}
                  rightIcon={ArrowRight}
                >
                  Start Free Interview
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
