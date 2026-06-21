import { motion } from "framer-motion";
import {
  Brain,
  Code2,
  Crown,
  Cpu,
  GitBranch,
  Layers,
  Users,
  Workflow,
} from "lucide-react";

const cats = [
  {
    icon: Code2,
    title: "Software Engineering",
    desc: "DSA, system design, problem solving.",
    tag: "12 tracks",
    gradient: "from-brand-500 to-violet-500",
  },
  {
    icon: Layers,
    title: ".NET",
    desc: "C#, ASP.NET Core, EF Core, microservices.",
    tag: "8 tracks",
    gradient: "from-purple-500 to-fuchsia-500",
  },
  {
    icon: Cpu,
    title: "React.js",
    desc: "Hooks, performance, state, SSR & testing.",
    tag: "10 tracks",
    gradient: "from-cyan-400 to-sky-500",
  },
  {
    icon: Workflow,
    title: "Node.js",
    desc: "Express, NestJS, async, scaling, security.",
    tag: "9 tracks",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    icon: Users,
    title: "HR Interview",
    desc: "Background, motivation, fit, expectations.",
    tag: "Most popular",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: Brain,
    title: "Behavioral",
    desc: "STAR-method scenarios, conflict, ownership.",
    tag: "Advanced",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    icon: Crown,
    title: "Leadership",
    desc: "Vision, hiring, performance, strategy.",
    tag: "Senior+",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: GitBranch,
    title: "System Design",
    desc: "Architecture, scaling, trade-offs.",
    tag: "Pro",
    gradient: "from-lime-400 to-emerald-500",
  },
];

export default function Categories() {
  return (
    <section id="categories" className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Interview tracks"
          title="Train for the role you want"
          subtitle="Hand-crafted question banks updated weekly by senior engineers and HR leads."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cats.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group bg-surface border-token relative overflow-hidden rounded-2xl border p-5 transition"
            >
              <div
                className={`absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br ${c.gradient} opacity-15 blur-2xl transition group-hover:opacity-30`}
              />
              <div
                className={`relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.gradient} text-white shadow-lg`}
              >
                <c.icon className="size-5" />
              </div>
              <h3 className="text-default mt-4 text-base font-semibold">
                {c.title}
              </h3>
              <p className="text-muted mt-1.5 text-sm">{c.desc}</p>
              <span className="text-subtle mt-4 inline-block text-[11px] font-semibold uppercase tracking-wider">
                {c.tag}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">
        {eyebrow}
      </span>
      <h2 className="font-display text-default mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted mt-4 text-base sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
