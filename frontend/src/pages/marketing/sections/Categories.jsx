import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Code2,
  Cpu,
  Crown,
  Database,
  Globe2,
  Layers,
  Network,
  Palette,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

export const tracks = [
  {
    id: "software_engineering",
    icon: Code2,
    title: "Software Engineering",
    desc: "Algorithms, data structures, concurrency, OOP and design patterns.",
    tag: "High Demand",
    skills: ["Algorithms", "Data Structures", "System Architecture", "OOP"],
    gradient: "from-brand-500 to-indigo-600",
  },
  {
    id: "web_development",
    icon: Cpu,
    title: "React & Web Development",
    desc: "Hooks, state management, SSR/Next.js, performance & modern JS/TS.",
    tag: "Trending",
    skills: ["React 19", "Next.js", "TypeScript", "State Mgmt"],
    gradient: "from-cyan-400 to-sky-600",
  },
  {
    id: "data_science",
    icon: Database,
    title: "Data Science & AI",
    desc: "Machine learning algorithms, Pandas, model deployment & statistics.",
    tag: "AI Focused",
    skills: ["Python", "PyTorch", "Feature Eng", "MLOps"],
    gradient: "from-purple-500 to-fuchsia-600",
  },
  {
    id: "networking",
    icon: Network,
    title: "Networking & Cloud",
    desc: "TCP/IP, AWS architecture, microservices, containerization & security.",
    tag: "Cloud Ready",
    skills: ["TCP/IP", "AWS", "Kubernetes", "Security"],
    gradient: "from-emerald-400 to-teal-600",
  },
  {
    id: "ui_ux",
    icon: Palette,
    title: "UI / UX Engineering",
    desc: "Design systems, accessibility WCAG, responsive animation & design tokens.",
    tag: "Product Design",
    skills: ["Design Systems", "Figma", "Accessibility", "Animations"],
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "business_analysis",
    icon: Workflow,
    title: "Business Analysis & Tech",
    desc: "Requirements gathering, user story mapping, agile SDLC & metrics.",
    tag: "Strategic",
    skills: ["Agile", "User Stories", "Stakeholder Mgmt", "UML"],
    gradient: "from-amber-400 to-orange-600",
  },
  {
    id: "behavioral",
    icon: Brain,
    title: "Behavioral & STAR Method",
    desc: "Conflict resolution, ownership, team leadership and communication.",
    tag: "Essential",
    skills: ["STAR Technique", "Leadership", "Conflict Res", "Communication"],
    gradient: "from-rose-500 to-purple-600",
  },
  {
    id: "system_design",
    icon: Layers,
    title: "Large-Scale System Design",
    desc: "Distributed caches, partitioning, load balancing, CAP theorem & scaling.",
    tag: "Senior+",
    skills: ["Distributed Systems", "Caching", "Sharding", "CAP Theorem"],
    gradient: "from-blue-500 to-indigo-700",
  },
];

export default function Categories() {
  return (
    <section id="categories" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Interview Tracks"
          title="Master the exact role you're interviewing for"
          subtitle="Curated question banks and dynamic multi-round scenarios calibrated against real interview loops at leading tech firms."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.04 }}
              className="group glass-card relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between"
            >
              {/* Radial glow highlight on hover */}
              <div
                className={`absolute -right-16 -top-16 size-36 rounded-full bg-gradient-to-br ${c.gradient} opacity-15 blur-3xl transition-opacity duration-300 group-hover:opacity-40`}
              />

              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-white shadow-md shadow-brand-500/20`}
                  >
                    <c.icon className="size-6" />
                  </div>
                  <span className="rounded-full bg-surface-2 border border-token px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {c.tag}
                  </span>
                </div>

                <h3 className="text-default font-display mt-5 text-lg font-bold">
                  {c.title}
                </h3>
                <p className="text-muted mt-2 text-xs leading-relaxed">
                  {c.desc}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.skills.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-lg bg-surface-2/80 px-2 py-0.5 text-[10px] font-medium text-subtle"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-token/60 flex items-center justify-between">
                <Link
                  to={`/app/interview`}
                  className="text-xs font-semibold text-brand-400 group-hover:text-brand-300 flex items-center gap-1 transition-colors"
                >
                  Start practice <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <span className="text-[11px] text-subtle font-medium">15–45 min</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-brand-400">
        <Sparkles className="size-3" />
        {eyebrow}
      </span>
      <h2 className="font-display text-default mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted mt-4 text-sm sm:text-base leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
