import { useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe,
  Mic,
  Sparkles,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { categories, difficulties } from "@/services/mockData";
import { cn } from "@/lib/utils";

export default function InterviewSetup({ onStart }) {
  const [category, setCategory] = useState(categories[2]);
  const [difficulty, setDifficulty] = useState(difficulties[1]);
  const [duration, setDuration] = useState(30);
  const [persona, setPersona] = useState("aria");
  const [language, setLanguage] = useState("English");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <Badge variant="brand" icon={Sparkles}>
            New session
          </Badge>
          <h1 className="font-display text-default mt-3 text-3xl font-bold sm:text-4xl">
            Configure your interview
          </h1>
          <p className="text-muted mt-2 max-w-2xl">
            Pick a track, difficulty and persona. Aria adapts in real time
            based on what you actually say.
          </p>
        </div>

        {/* Category */}
        <Section
          icon={Briefcase}
          title="Interview track"
          desc="Choose what you're practicing."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-4 text-left transition",
                  category.id === c.id
                    ? "border-brand-500/50 bg-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div
                  className={`absolute -right-10 -top-10 size-24 rounded-full bg-gradient-to-br ${c.color} opacity-20 blur-2xl`}
                />
                <div className="relative flex items-center gap-3">
                  <div
                    className={`grid size-9 place-items-center rounded-lg bg-gradient-to-br ${c.color} text-white`}
                  >
                    <Briefcase className="size-4" />
                  </div>
                  <p className="text-default text-sm font-semibold">
                    {c.label}
                  </p>
                  {category.id === c.id && (
                    <CheckCircle2 className="text-brand-400 ml-auto size-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Difficulty + Duration */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Section icon={Sparkles} title="Difficulty">
            <div className="bg-surface border-token grid grid-cols-3 rounded-2xl border p-1">
              {difficulties.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "relative rounded-xl py-2.5 text-sm font-semibold transition",
                    difficulty.id === d.id
                      ? "bg-surface-2 text-default border border-token shadow-sm"
                      : "text-muted"
                  )}
                >
                  <span className={difficulty.id === d.id ? d.color : ""}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>
          <Section icon={Clock} title="Duration">
            <div className="bg-surface border-token grid grid-cols-3 rounded-2xl border p-1">
              {[15, 30, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  className={cn(
                    "rounded-xl py-2.5 text-sm font-semibold transition",
                    duration === m
                      ? "bg-surface-2 text-default border border-token shadow-sm"
                      : "text-muted"
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Persona */}
        <Section icon={Mic} title="AI Interviewer persona">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: "aria",
                name: "Aria",
                style: "Friendly & supportive",
                tag: "Recommended",
                gradient: "from-pink-500 to-rose-500",
              },
              {
                id: "marcus",
                name: "Marcus",
                style: "Direct & probing",
                tag: "Senior+",
                gradient: "from-brand-500 to-violet-500",
              },
              {
                id: "kenji",
                name: "Kenji",
                style: "Calm & methodical",
                tag: "System Design",
                gradient: "from-cyan-400 to-sky-500",
              },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 text-left transition",
                  persona === p.id
                    ? "border-brand-500/50 bg-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-12 rounded-full bg-gradient-to-br ${p.gradient} grid place-items-center text-base font-bold text-white`}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-default text-sm font-semibold">
                      {p.name}
                    </p>
                    <p className="text-subtle text-xs">{p.style}</p>
                  </div>
                </div>
                <Badge
                  size="sm"
                  variant={persona === p.id ? "brand" : "outline"}
                  className="mt-3"
                >
                  {p.tag}
                </Badge>
              </button>
            ))}
          </div>
        </Section>

        {/* Language */}
        <Section icon={Globe} title="Language">
          <div className="flex flex-wrap gap-2">
            {["English", "Sinhala", "Tamil", "Hindi", "Spanish"].map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  language === l
                    ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                    : "border-token bg-surface text-muted hover:text-default"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Summary card */}
      <div className="lg:col-span-1">
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-24 space-y-4"
        >
          <div className="glass-strong rounded-3xl border p-6">
            <p className="text-subtle text-xs font-semibold uppercase tracking-widest">
              Session preview
            </p>
            <h3 className="font-display text-default mt-2 text-2xl font-bold">
              {category.label}
            </h3>
            <p className="text-muted text-sm">
              {duration}-minute mock with {persona === "aria" ? "Aria" : persona === "marcus" ? "Marcus" : "Kenji"}.
            </p>

            <div className="mt-6 space-y-3">
              <Row label="Track" value={category.label} />
              <Row label="Difficulty" value={difficulty.label} />
              <Row label="Duration" value={`${duration} min`} />
              <Row label="Persona" value={persona === "aria" ? "Aria · Friendly" : persona === "marcus" ? "Marcus · Direct" : "Kenji · Methodical"} />
              <Row label="Language" value={language} />
            </div>

            <div className="border-token my-6 border-t border-dashed" />

            <h4 className="text-default text-sm font-semibold">Device check</h4>
            <div className="mt-3 space-y-2">
              <Check label="Microphone access" />
              <Check label="Camera access" />
              <Check label="Stable connection" />
            </div>

            <Button
              size="lg"
              className="mt-6 w-full"
              rightIcon={ChevronRight}
              onClick={() =>
                onStart({
                  category: category.id,
                  categoryLabel: category.label,
                  difficulty: difficulty.label,
                  duration,
                  persona,
                  language,
                })
              }
            >
              Start interview
            </Button>
            <p className="text-subtle mt-3 text-center text-[11px]">
              Recording stays on this device unless you upload it.
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }) {
  return (
    <div className="bg-surface border-token rounded-3xl border p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-10 place-items-center rounded-xl bg-gradient-to-br">
          <Icon className="size-4.5" />
        </div>
        <div>
          <h3 className="text-default font-semibold">{title}</h3>
          {desc && <p className="text-muted text-xs">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-default font-semibold">{value}</span>
    </div>
  );
}

function Check({ label }) {
  return (
    <div className="bg-surface-2 border-token flex items-center justify-between rounded-xl border px-3 py-2">
      <span className="text-default text-sm">{label}</span>
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        Ready
      </span>
    </div>
  );
}
