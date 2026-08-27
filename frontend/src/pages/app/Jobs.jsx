import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Sparkles,
  TrendingUp,
  Wifi,
  XCircle,
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
        toast.error("Couldn't load job recommendations", err?.response?.data?.title);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <Badge variant="brand" icon={Sparkles} size="xs" dot pulse>
          AI Match Matrix
        </Badge>
        <h1 className="font-display text-default mt-2 text-3xl font-extrabold sm:text-4xl">
          Role Recommendations
        </h1>
        <p className="text-muted mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed">
          Ranked automatically by matching your parsed resume skills and live interview evaluation
          scores against real market requirements. Each match highlights your existing competencies and skill gaps.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-3xl lg:col-span-1" />
          <Skeleton className="h-96 rounded-3xl lg:col-span-2" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No Matched Roles Yet"
          description="Complete a mock interview after uploading your CV so Aria can compute your compatibility scores."
          action={
            <Link to="/app/interview">
              <Button leftIcon={Briefcase}>Launch Mock Interview</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Job Matches List */}
          <div className="space-y-3 lg:col-span-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-subtle px-1">
              Top Ranked Roles ({items.length})
            </span>

            {items.map((m, i) => (
              <motion.button
                key={m.job.id}
                type="button"
                onClick={() => setActive(m)}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "group flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer",
                  active?.job.id === m.job.id
                    ? "border-brand-500/50 bg-brand-500/10 shadow-sm"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <ScoreBubble score={m.match.score} />
                <div className="min-w-0 flex-1">
                  <p className="text-default truncate text-sm font-bold">
                    {m.job.title}
                  </p>
                  <p className="text-subtle text-xs mt-0.5 truncate">
                    {m.job.company} · {m.job.location || "Remote"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.match.matchingSkills?.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="text-brand-300 bg-brand-500/15 border border-brand-500/30 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Right Column: Deep Job Match Detail */}
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
        "grid size-12 shrink-0 place-items-center rounded-2xl border bg-gradient-to-br text-sm font-extrabold shadow-sm",
        score >= 80
          ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400"
          : score >= 60
          ? "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400"
          : "from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400"
      )}
    >
      {score}%
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
      {/* Hero Overview */}
      <div className="glass-card relative overflow-hidden rounded-3xl border border-token p-6 sm:p-7">
        <div className="absolute -right-12 -top-12 size-60 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />

        <div className="relative grid items-center gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" size="xs">
                {job.seniority || "Engineering"}
              </Badge>
              {job.remote && (
                <Badge variant="info" icon={Wifi} size="xs">
                  Remote Eligible
                </Badge>
              )}
            </div>

            <h2 className="font-display text-default mt-3 text-2xl font-extrabold">
              {job.title}
            </h2>

            <div className="text-muted mt-1.5 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-brand-400" /> {job.company}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-accent-400" /> {job.location}
                </span>
              )}
            </div>

            {job.sourceUrl && (
              <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block">
                <Button variant="secondary" size="sm" rightIcon={ExternalLink}>
                  View Job Listing
                </Button>
              </a>
            )}
          </div>

          <div className="flex justify-center sm:justify-end">
            <CircularProgress value={m.score} size={130}>
              <div className="flex flex-col items-center">
                <span className={`font-display text-3xl font-extrabold ${scoreColor(m.score)}`}>
                  {m.score}%
                </span>
                <span className="text-subtle text-[10px] uppercase font-bold tracking-wider">
                  Fit Index
                </span>
              </div>
            </CircularProgress>
          </div>
        </div>
      </div>

      {/* Competencies Breakdown: Matched vs Gaps */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card rounded-2xl border border-token p-5">
          <div className="flex items-center justify-between">
            <p className="text-default text-sm font-bold">Skills You Possess</p>
            <span className="text-emerald-400 text-xs font-bold">{m.matchingSkills?.length ?? 0} Matched</span>
          </div>
          {m.matchingSkills?.length ? (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {m.matchingSkills.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-subtle mt-3 text-xs italic">
              Run more interview tracks to verify matching competencies.
            </p>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-token p-5">
          <div className="flex items-center justify-between">
            <p className="text-default text-sm font-bold">Skill Gaps to Target</p>
            <span className="text-rose-400 text-xs font-bold">{m.skillGaps?.length ?? 0} To Study</span>
          </div>
          {m.skillGaps?.length ? (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {m.skillGaps.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-400"
                >
                  ! {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-subtle mt-3 text-xs italic">
              High compatibility profile — no major gaps detected.
            </p>
          )}
        </div>
      </div>

      {/* Role Description */}
      <div className="glass-card rounded-2xl border border-token p-6">
        <h3 className="font-display text-default text-base font-bold">Role Responsibilities & Tech Stack</h3>
        <p className="text-muted mt-3 whitespace-pre-line text-xs sm:text-sm leading-relaxed">
          {job.description}
        </p>
      </div>

      {/* Career Trajectory Projection */}
      <div className="glass-card rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-brand-500 text-white shadow-md">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-default text-sm font-bold">
              Target Career Path Progression
            </p>
            <p className="text-muted text-xs mt-1 leading-relaxed">
              {job.seniority?.toLowerCase() === "junior"
                ? "Junior Engineer → Software Engineer II → Senior Engineer → Tech Lead"
                : job.seniority?.toLowerCase().includes("senior")
                ? "Senior Engineer → Staff Engineer → Principal Architect / Engineering Manager"
                : job.seniority?.toLowerCase().includes("lead")
                ? "Tech Lead → Engineering Manager → Director of Engineering"
                : "Engineer → Senior Engineer → Technical Lead"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
