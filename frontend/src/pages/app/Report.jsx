import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Download,
  Lightbulb,
  Mic,
  Play,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CircularProgress } from "@/components/ui/Progress";
import RadarChart from "@/components/charts/RadarChart";
import { BarChart } from "@/components/ui/Sparkline";
import { recentInterviews } from "@/services/mockData";
import { formatDate, formatDuration, scoreColor, cn } from "@/lib/utils";

const session = recentInterviews[0];

const strengths = [
  "Clear, structured answers (used STAR / FAB explicitly)",
  "Used concrete metrics — '40% faster', '12k MAU' — to anchor stories",
  "Confidence stayed steady even on the hardest follow-up",
];

const weaknesses = [
  "Frequent fillers in the first 3 minutes ('uhm', 'like')",
  "System-design answer skipped storage trade-offs",
  "Closing pitch was a bit rushed — tighten by ~20 seconds",
];

const resources = [
  { title: "Designing Data-Intensive Applications", type: "Book", time: "12h" },
  { title: "React Performance Crash Course", type: "Course", time: "3h" },
  { title: "STAR vs FAB — Behavioral playbook", type: "Article", time: "12 min" },
  { title: "Mock — System Design: URL Shortener", type: "Mock", time: "45 min" },
];

export default function Report() {
  const overall = session.score;
  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="from-brand-600/30 via-brand-500/10 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8"
      >
        <div className="absolute -right-12 -top-12 size-60 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="grid items-center gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={Sparkles}>
                Session report
              </Badge>
              <Badge variant="outline">{session.category}</Badge>
              <Badge variant="outline">{session.difficulty}</Badge>
            </div>
            <h1 className="font-display text-default mt-3 text-3xl font-bold sm:text-4xl">
              {session.role}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {formatDate(session.date)} · {formatDuration(session.duration)} · 8 questions
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button leftIcon={Download}>Download PDF</Button>
              <Button variant="glass" leftIcon={Share2}>
                Share report
              </Button>
              <Button variant="glass" leftIcon={Play}>
                Replay session
              </Button>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="flex items-center justify-center gap-6">
              <CircularProgress value={overall} size={150}>
                <div className="flex flex-col items-center">
                  <span className="font-display text-default text-4xl font-bold">
                    {overall}
                  </span>
                  <span className="text-subtle text-[10px] uppercase tracking-wider">
                    Overall
                  </span>
                </div>
              </CircularProgress>
              <div className="space-y-1.5">
                <Stat
                  icon={Trophy}
                  label="Top percentile"
                  value="12%"
                  tone="amber"
                />
                <Stat
                  icon={TrendingUp}
                  label="vs your average"
                  value="+9 pts"
                  tone="emerald"
                />
                <Stat icon={Mic} label="Words spoken" value="1,842" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Metrics grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-surface border-token rounded-3xl border p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-default text-lg font-semibold">
                6-metric breakdown
              </h2>
              <p className="text-muted text-xs">
                The same axes recruiters use internally.
              </p>
            </div>
            <Badge variant="success">+12 pts</Badge>
          </div>
          <div className="mt-5 grid items-center gap-6 sm:grid-cols-2">
            <RadarChart
              data={Object.entries(session.metrics).map(([k, v]) => ({
                label: k[0].toUpperCase() + k.slice(1),
                value: v,
              }))}
            />
            <div className="space-y-3">
              {Object.entries(session.metrics).map(([k, v]) => (
                <MetricRow key={k} label={k} value={v} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface border-token rounded-3xl border p-6">
          <h2 className="text-default text-lg font-semibold">
            Question-by-question
          </h2>
          <p className="text-muted text-xs">
            How each answer performed.
          </p>
          <div className="mt-5">
            <BarChart
              height={180}
              data={[
                { label: "Q1", value: 78 },
                { label: "Q2", value: 82 },
                { label: "Q3", value: 70 },
                { label: "Q4", value: 92 },
                { label: "Q5", value: 88 },
                { label: "Q6", value: 75 },
                { label: "Q7", value: 90 },
                { label: "Q8", value: 84 },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Strengths / weaknesses */}
      <div className="grid gap-6 lg:grid-cols-2">
        <List
          title="Strengths"
          tone="emerald"
          icon={CheckCircle2}
          items={strengths}
        />
        <List
          title="Areas to improve"
          tone="rose"
          icon={XCircle}
          items={weaknesses}
        />
      </div>

      {/* Coach note */}
      <div className="from-amber-400/15 to-brand-500/10 border-amber-400/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6">
        <Lightbulb className="text-amber-400 absolute right-6 top-6 size-7" />
        <Badge variant="warning" icon={Lightbulb}>
          Coach note
        </Badge>
        <p className="text-default mt-3 max-w-2xl text-base font-medium leading-relaxed">
          You've got the technical depth — the next jump is in pacing your
          opening. Trim filler words in the first 60 seconds and your
          confidence score lifts by ~9 points. We've added a short pacing drill
          to your queue.
        </p>
      </div>

      {/* Resources */}
      <div className="bg-surface border-token rounded-3xl border p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-default text-lg font-semibold">
              Recommended for you
            </h2>
            <p className="text-muted text-xs">
              Curated from your weakest metrics.
            </p>
          </div>
          <Badge variant="brand">AI curated</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r) => (
            <a
              key={r.title}
              href="#"
              className="group bg-surface-2 border-token hover:border-brand-500/40 rounded-2xl border p-4 transition"
            >
              <div className="flex items-start justify-between">
                <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-9 place-items-center rounded-xl bg-gradient-to-br">
                  <BookOpen className="size-4.5" />
                </div>
                <ArrowUpRight className="text-subtle group-hover:text-brand-400 size-4 transition" />
              </div>
              <p className="text-default mt-3 text-sm font-semibold">
                {r.title}
              </p>
              <p className="text-subtle mt-1 text-xs">
                {r.type} · {r.time}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    default: "text-brand-400",
  };
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn("size-5", tones[tone] || tones.default)} />
      <div>
        <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </p>
        <p className="text-default text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-default font-medium capitalize">{label}</span>
        <span className={`font-semibold ${scoreColor(value)}`}>{value}</span>
      </div>
      <div className="bg-surface-2 border-token h-1.5 overflow-hidden rounded-full border">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="from-brand-400 to-accent-400 h-full bg-gradient-to-r"
        />
      </div>
    </div>
  );
}

function List({ title, tone, icon: Icon, items }) {
  const tones = {
    emerald: "from-emerald-400/15 to-emerald-500/5 text-emerald-400",
    rose: "from-rose-400/15 to-rose-500/5 text-rose-400",
  };
  return (
    <div className="bg-surface border-token rounded-3xl border p-6">
      <div className="flex items-center gap-3">
        <div className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${tones[tone]}`}>
          <Icon className="size-4.5" />
        </div>
        <h3 className="text-default text-base font-semibold">{title}</h3>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-1 size-1.5 shrink-0 rounded-full",
                tone === "emerald" ? "bg-emerald-400" : "bg-rose-400"
              )}
            />
            <span className="text-default text-sm">{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
