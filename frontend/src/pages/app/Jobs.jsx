import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ExternalLink,
  MapPin,
  Sparkles,
  TrendingUp,
  Wifi,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CircularProgress } from "@/components/ui/Progress";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { jobsApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { cn, scoreColor } from "@/lib/utils";

export default function Jobs() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await jobsApi.recommendations();
        setItems(items);
        if (items.length) setActive(items[0]);
      } catch (err) {
        toast.error("Couldn't load job matches", err?.response?.data?.title);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="brand" icon={Sparkles}>
          AI job match · §3.5
        </Badge>
        <h1 className="font-display text-default mt-3 text-3xl font-bold sm:text-4xl">
          Jobs matched to your profile
        </h1>
        <p className="text-muted mt-1 max-w-2xl">
          Ranked from your CV skills, interview performance, confidence and
          technical accuracy. Each match comes with a skill-gap list and a
          recommended career path.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No matches yet"
          description="Finish a mock interview after uploading your CV and we'll match you to roles immediately."
          action={
            <Link to="/app/interview">
              <Button>Start a mock interview</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="space-y-3 lg:col-span-1">
            {items.map((m, i) => (
              <motion.button
                key={m.job.id}
                onClick={() => setActive(m)}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  active?.job.id === m.job.id
                    ? "border-brand-500/40 bg-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <ScoreBubble score={m.match.score} />
                <div className="min-w-0 flex-1">
                  <p className="text-default truncate text-sm font-semibold">
                    {m.job.title}
                  </p>
                  <p className="text-subtle truncate text-xs">
                    {m.job.company} · {m.job.location || "Remote"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.match.matchingSkills?.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="text-brand-300 bg-brand-500/15 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {active && <JobDetail key={active.job.id} match={active} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBubble({ score }) {
  return (
    <div
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-2xl border bg-gradient-to-br text-sm font-bold",
        score >= 80
          ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400"
          : score >= 60
          ? "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400"
          : "from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400"
      )}
    >
      {score}
    </div>
  );
}

function JobDetail({ match }) {
  const { job, match: m } = match;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Hero */}
      <div className="from-brand-500/15 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6">
        <div className="absolute -right-12 -top-12 size-60 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={Briefcase}>
                {job.seniority || "Open"}
              </Badge>
              {job.remote && (
                <Badge variant="info" icon={Wifi}>
                  Remote OK
                </Badge>
              )}
            </div>
            <h2 className="font-display text-default mt-3 text-2xl font-bold">
              {job.title}
            </h2>
            <div className="text-muted mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" /> {job.company}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {job.location}
                </span>
              )}
            </div>
            {job.sourceUrl && (
              <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block">
                <Button variant="secondary" size="sm" rightIcon={ExternalLink}>
                  View posting
                </Button>
              </a>
            )}
          </div>
          <div className="flex justify-center sm:justify-end">
            <CircularProgress value={m.score} size={130}>
              <div className="flex flex-col items-center">
                <span className={`font-display text-3xl font-bold ${scoreColor(m.score)}`}>
                  {m.score}
                </span>
                <span className="text-subtle text-[10px] uppercase tracking-wider">
                  Match
                </span>
              </div>
            </CircularProgress>
          </div>
        </div>
      </div>

      {/* Skills match / gap */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-surface border-token rounded-2xl border p-5">
          <p className="text-default text-sm font-semibold">
            Skills you already have
          </p>
          <p className="text-subtle mt-0.5 text-[11px] uppercase tracking-wider">
            {m.matchingSkills?.length ?? 0} matched
          </p>
          {m.matchingSkills?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.matchingSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-subtle mt-3 text-xs italic">
              Run an interview to surface matching skills.
            </p>
          )}
        </div>
        <div className="bg-surface border-token rounded-2xl border p-5">
          <p className="text-default text-sm font-semibold">Skill gaps to close</p>
          <p className="text-subtle mt-0.5 text-[11px] uppercase tracking-wider">
            {m.skillGaps?.length ?? 0} to learn
          </p>
          {m.skillGaps?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.skillGaps.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-400"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-subtle mt-3 text-xs italic">
              You're a great fit — no obvious gaps.
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="bg-surface border-token rounded-2xl border p-5">
        <p className="text-default text-sm font-semibold">About the role</p>
        <p className="text-muted mt-2 whitespace-pre-line text-sm leading-relaxed">
          {job.description}
        </p>
      </div>

      {/* Career path / CTA */}
      <div className="from-amber-400/10 to-brand-500/10 border-amber-400/30 rounded-2xl border bg-gradient-to-br p-5">
        <div className="flex items-start gap-3">
          <div className="from-amber-400 to-brand-500 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-default text-sm font-semibold">
              Career path suggestion
            </p>
            <p className="text-muted mt-1 text-sm">
              {job.seniority?.toLowerCase() === "junior"
                ? "Junior → Mid-level Engineer → Senior Engineer → Tech Lead"
                : job.seniority?.toLowerCase().includes("senior")
                ? "Senior → Staff Engineer → Principal / Tech Lead"
                : job.seniority?.toLowerCase().includes("lead")
                ? "Lead → Engineering Manager → Director"
                : "Mid-level → Senior Engineer → Tech Lead"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
