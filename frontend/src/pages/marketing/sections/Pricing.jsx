import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { SectionHeading } from "./Categories";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: { monthly: 0, yearly: 0 },
    desc: "For trying things out.",
    features: [
      "3 mock interviews / month",
      "Basic 2-metric scoring",
      "Transcript & summary",
      "Light analytics",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: { monthly: 19, yearly: 14 },
    desc: "For serious job seekers.",
    features: [
      "Unlimited mock interviews",
      "Full 6-metric scoring engine",
      "Adaptive difficulty",
      "PDF reports & replays",
      "Personalized coaching path",
      "Priority email support",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: { monthly: 49, yearly: 39 },
    desc: "For coaches & bootcamps.",
    features: [
      "Everything in Pro",
      "Up to 10 seats included",
      "Cohort dashboards & exports",
      "Custom question banks",
      "Dedicated success manager",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

export default function Pricing() {
  const [cycle, setCycle] = useState("yearly");
  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, fair, no surprises"
          subtitle="Cancel anytime. Yearly is 26% off — pays for itself in one offer."
        />

        <div className="mt-8 flex justify-center">
          <div className="bg-surface-2 border-token inline-flex rounded-2xl border p-1">
            {[
              { v: "monthly", l: "Monthly" },
              { v: "yearly", l: "Yearly · -26%" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setCycle(o.v)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  cycle === o.v
                    ? "bg-surface text-default shadow border border-token"
                    : "text-muted"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "relative overflow-hidden rounded-3xl border p-7",
                p.highlight
                  ? "from-brand-600/30 to-accent-500/10 border-brand-500/40 bg-gradient-to-br shadow-glow"
                  : "bg-surface border-token"
              )}
            >
              {p.highlight && (
                <div className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="size-3" />
                  Most popular
                </div>
              )}
              <h3 className="font-display text-default text-xl font-bold">
                {p.name}
              </h3>
              <p className="text-muted mt-1 text-sm">{p.desc}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-default text-5xl font-bold">
                  ${p.price[cycle]}
                </span>
                <span className="text-muted text-sm">/ month</span>
              </div>

              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="bg-brand-500/15 text-brand-400 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3" />
                    </span>
                    <span className="text-default text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              <Link to="/register" className="mt-7 block">
                <Button
                  className="w-full"
                  variant={p.highlight ? "primary" : "secondary"}
                  size="lg"
                >
                  {p.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
