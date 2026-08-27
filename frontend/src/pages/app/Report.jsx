import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Download,
  GraduationCap,
  Lightbulb,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CircularProgress } from "@/components/ui/Progress";
import RadarChart from "@/components/charts/RadarChart";
import { BarChart } from "@/components/ui/Sparkline";
import EmptyState from "@/components/ui/EmptyState";
import { reportApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatDuration, scoreColor, cn } from "@/lib/utils";

const METRIC_LABELS = {
  confidence: "Confidence & Tone",
  communication: "Clarity & Structure",
  relevance: "Question Relevance",
  technical: "Technical Depth",
  fluency: "Linguistic Fluency",
  pace: "Speaking Cadence",
};

const LEVEL_STYLE = {
  BEGINNER: {
    label: "Beginner Band",
    badge: "warning",
    bg: "from-amber-500/15 to-rose-500/5 border-amber-500/30",
    text: "text-amber-400",
  },
  INTERMEDIATE: {
    label: "Intermediate Loop",
    badge: "brand",
    bg: "from-brand-500/15 to-accent-500/5 border-brand-500/30",
    text: "text-brand-400",
  },
  ADVANCED: {
    label: "Advanced Candidate",
    badge: "success",
    bg: "from-emerald-500/15 to-cyan-500/5 border-emerald-500/30",
    text: "text-emerald-400",
  },
};

export default function Report() {
  const { id } = useParams();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval;

    const load = async () => {
      try {
        const { report } = await reportApi.get(id);
        if (!cancelled) {
          setReport(report);
          setLoading(false);
        }
      } catch (err) {
        if (err?.response?.status === 404 && !cancelled) {
          interval = setInterval(async () => {
            try {
              const { report } = await reportApi.get(id);
              if (cancelled) return;
              setReport(report);
              setLoading(false);
              clearInterval(interval);
            } catch {
              // Waiting for generation
            }
          }, 2500);

          setTimeout(() => {
            if (loading && !cancelled) {
              clearInterval(interval);
              setLoading(false);
              toast.info(
                "Report taking a moment",
                "Try refreshing the report in a few seconds."
              );
            }
          }, 30_000);
        } else if (!cancelled) {
          toast.error("Couldn't load report", err?.response?.data?.title);
          setLoading(false);
        }
      }
    };

    if (id) load();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [id]);

  const regenerate = async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const { report } = await reportApi.regenerate(id);
      setReport(report);
      toast.success("Report Re-Evaluated", "Fresh telemetry metrics computed.");
    } catch (err) {
      toast.error("Couldn't regenerate", err?.response?.data?.title);
    } finally {
      setRefreshing(false);
    }
  };

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!id) {
    return (
      <EmptyState
        icon={Award}
        title="Select an Interview Session"
        description="Open any recorded mock interview from your history to view its full analytical report."
        action={
          <Link to="/app/history">
            <Button>View History</Button>
          </Link>
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card rounded-3xl p-8 border border-token text-center max-w-sm flex flex-col items-center shadow-2xl">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400 border border-brand-500/30 shadow-lg">
            <Loader2 className="size-8 animate-spin" />
          </div>
          <h3 className="font-display text-default text-lg font-bold mt-5">
            Generating Report
          </h3>
          <p className="text-muted text-xs mt-1.5 leading-relaxed">
            Aria's ML engine is evaluating speech prosody, semantic relevance, and technical accuracy…
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <EmptyState
        icon={Award}
        title="Report Not Found"
        description="This session hasn't generated a report yet. Click below to trigger evaluation."
        action={<Button onClick={regenerate}>Generate Evaluation Report</Button>}
      />
    );
  }

  const level = LEVEL_STYLE[report.performanceLevel] || LEVEL_STYLE.INTERMEDIATE;
  const sessionMetrics = {
    confidence: report.confidence,
    communication: report.communication,
    relevance: report.relevance,
    technical: report.technical,
    fluency: report.fluency,
    pace: Math.min(100, Math.round((report.pace - 60) / 1.2)),
  };

  const perQuestionScores = (report.interview?.questions || []).map((q, i) => {
    const m = q.answer?.metrics;
    if (q.answer?.skipped || q.answer?.intent === "dont_know") {
      return { label: `Q${i + 1}`, value: 0, skipped: true };
    }
    if (!m) return { label: `Q${i + 1}`, value: 0, unscored: true };
    const avg = Math.round(
      ((m.confidence ?? 0) +
        (m.communication ?? 0) +
        (m.relevance ?? 0) +
        (m.technical ?? 0) +
        (m.fluency ?? 0)) /
        5
    );
    return { label: `Q${i + 1}`, value: avg, domain: q.domain };
  });

  const analytics = report.analytics || {};
  const byDomain = Array.isArray(analytics.byDomain) ? analytics.byDomain : [];
  const skippedQuestions = Array.isArray(analytics.skippedQuestions)
    ? analytics.skippedQuestions
    : [];

  const duration =
    report.interview?.startedAt && report.interview?.endedAt
      ? Math.round(
          (new Date(report.interview.endedAt).getTime() -
            new Date(report.interview.startedAt).getTime()) /
            1000
        )
      : null;

  const resources = Array.isArray(report.resources) ? report.resources : [];

  return (
    <div className="space-y-8">
      {/* Executive Score Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card from-brand-600/25 via-brand-500/10 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8 shadow-2xl"
      >
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />

        <div className="grid items-center gap-8 lg:grid-cols-12">
          {/* Summary Left */}
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={Sparkles} dot pulse>
                Performance Report
              </Badge>
              <Badge variant="outline" className="capitalize">
                {report.interview?.category}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {report.interview?.difficulty} Loop
              </Badge>
              <Badge variant={level.badge} icon={GraduationCap}>
                {level.label}
              </Badge>
            </div>

            <h1 className="font-display text-default mt-4 text-3xl font-extrabold sm:text-4xl">
              {report.interview?.role}
            </h1>

            <p className="text-muted mt-1.5 text-xs sm:text-sm">
              Session evaluated on {formatDate(report.generatedAt)}
              {duration ? ` · ${formatDuration(duration)} duration` : ""} ·{" "}
              {report.interview?.questions?.length ?? 0} total questions evaluated
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button size="sm" leftIcon={Download} onClick={downloadJson} className="shadow-md">
                Download JSON Report
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={RefreshCw}
                onClick={regenerate}
                loading={refreshing}
              >
                Re-Evaluate
              </Button>
              <Link to="/app/interview">
                <Button variant="secondary" size="sm" leftIcon={Play}>
                  Start New Session
                </Button>
              </Link>
            </div>
          </div>

          {/* Overall Circular Score Right */}
          <div className="lg:col-span-4 flex items-center justify-center sm:justify-end gap-6">
            <CircularProgress value={report.overallScore} size={150}>
              <div className="flex flex-col items-center">
                <span className={`font-display text-4xl font-extrabold ${scoreColor(report.overallScore)}`}>
                  {report.overallScore}
                </span>
                <span className="text-subtle text-[10px] uppercase font-bold tracking-wider">
                  Overall Score
                </span>
              </div>
            </CircularProgress>

            <div className="space-y-2">
              <SummaryStat
                icon={GraduationCap}
                label="Candidate Band"
                value={level.label}
                tone={level.text}
              />
              <SummaryStat
                icon={Trophy}
                label="Words Analyzed"
                value={wordCount(report)}
              />
              <SummaryStat
                icon={Mic}
                label="Answered"
                value={`${perQuestionScores.length} Turns`}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Performance Level Band Callout */}
      <div
        className={cn(
          "glass-card rounded-3xl border p-5 sm:p-6",
          level.bg
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="text-default text-sm font-bold">
              Candidate Readiness Assessment: <span className={level.text}>{level.label}</span>
            </p>
            <p className="text-muted text-xs sm:text-sm mt-1 leading-relaxed">
              {report.performanceLevel === "ADVANCED"
                ? "You demonstrate strong architectural grasp and clear communication. Focus on concise closing remarks and high-level trade-off framing."
                : report.performanceLevel === "INTERMEDIATE"
                ? "Solid foundational answers. Target the weaker skill dimensions identified below to advance into senior/staff interview loops."
                : "Good initial practice. Focus on structuring responses with the STAR method and keeping a steady conversational pace."}
            </p>
          </div>
        </div>
      </div>

      {/* 6-Metric Radar & Question Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Radar & Dimensions */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 border border-token lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-default text-lg font-bold">
                6-Metric Multi-Dimensional Assessment
              </h2>
              <p className="text-muted text-xs">
                Confidence · Communication · Relevance · Technical Depth · Fluency · Pace
              </p>
            </div>
            <Badge variant="brand" size="xs">
              {report.overallScore}/100 Average
            </Badge>
          </div>

          <div className="grid items-center gap-6 sm:grid-cols-2 mt-4">
            <RadarChart
              data={Object.entries(sessionMetrics).map(([k, v]) => ({
                label: METRIC_LABELS[k] || k,
                value: v,
              }))}
            />
            <div className="space-y-3.5">
              {Object.entries(METRIC_LABELS).map(([k, label]) => {
                const raw = report[k];
                return (
                  <MetricBarRow
                    key={k}
                    label={label}
                    value={raw}
                    suffix={k === "pace" ? " WPM" : "%"}
                    bar={k === "pace" ? Math.min(100, Math.round((raw - 60) / 1.2)) : raw}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Question-by-Question Bar Chart */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 border border-token flex flex-col justify-between">
          <div>
            <h2 className="font-display text-default text-lg font-bold">
              Turn-by-Turn Scores
            </h2>
            <p className="text-muted text-xs mt-0.5">Average quality score per response</p>
            <div className="mt-5">
              {perQuestionScores.length === 0 ? (
                <p className="text-subtle text-xs italic py-8 text-center">No answers recorded.</p>
              ) : (
                <BarChart height={180} data={perQuestionScores} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* What Was Measured Telemetry Cards */}
      {analytics.answerCount > 0 && (
        <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-default text-lg font-bold">
              Measured Speech & Technical Telemetry
            </h3>
            <Badge variant="brand" size="xs">
              {analytics.answeredCount}/{analytics.answerCount} Answered
            </Badge>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <MeasureCard
              label="Question Coverage"
              value={`${Math.round((analytics.coverage ?? 0) * 100)}%`}
              hint={analytics.skippedCount ? `${analytics.skippedCount} declined/skipped` : "All addressed"}
            />
            <MeasureCard
              label="Avg. Answer Length"
              value={`${analytics.avgWords ?? 0} Words`}
              hint="60–140 words is optimal for technical responses"
            />
            <MeasureCard
              label="Concrete Examples"
              value={`${analytics.concreteExamples ?? 0} of ${analytics.answerCount}`}
              hint="Answers citing projects, metrics, or trade-offs"
            />
            <MeasureCard
              label="Filler Word Rate"
              value={`${analytics.avgFillerRate ?? 0}%`}
              hint="Under 3% reads as fluent and authoritative"
            />
          </div>

          {/* Technical Accuracy by Domain */}
          {byDomain.length > 0 && (
            <div className="mt-6 pt-5 border-t border-token/60">
              <p className="text-subtle mb-3 text-[10px] uppercase font-bold tracking-wider">
                Technical Depth by Domain Area:
              </p>
              <div className="space-y-2.5">
                {byDomain.map((d) => (
                  <div key={d.domain} className="flex items-center gap-3">
                    <span className="text-default w-40 sm:w-48 shrink-0 truncate text-xs font-semibold">
                      {d.domain}
                    </span>
                    <div className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full border border-token">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          (d.technical ?? 0) >= 70
                            ? "bg-emerald-500"
                            : (d.technical ?? 0) >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        )}
                        style={{ width: `${Math.max(4, d.technical ?? 0)}%` }}
                      />
                    </div>
                    <span className="text-default w-12 shrink-0 text-right text-xs font-bold">
                      {d.technical == null ? "—" : `${Math.round(d.technical)}%`}
                    </span>
                    <span className="text-subtle w-12 shrink-0 text-right text-[10px]">
                      {d.questions} q
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped / Declined Questions */}
          {skippedQuestions.length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-default text-xs font-bold mb-1.5 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-400" />
                Declined or Skipped Scenarios — Recommended Study Targets:
              </p>
              <ul className="space-y-1">
                {skippedQuestions.map((q) => (
                  <li key={q.ordinal} className="text-muted text-xs leading-relaxed">
                    <span className="text-amber-400">•</span> {q.question}
                    {q.domain && <span className="text-subtle"> · ({q.domain})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Strengths & Improvement Areas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeedbackCard
          title="Demonstrated Strengths"
          tone="emerald"
          icon={CheckCircle2}
          items={report.strengths || []}
        />
        <FeedbackCard
          title="Key Areas for Improvement"
          tone="rose"
          icon={XCircle}
          items={report.weaknesses || []}
        />
      </div>

      {/* AI Coach Actionable Suggestions */}
      <div className="glass-card rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-brand-500/5 to-surface p-6 sm:p-7 relative overflow-hidden">
        <Lightbulb className="text-amber-400 absolute right-6 top-6 size-8 opacity-40 pointer-events-none" />
        <Badge variant="warning" icon={Lightbulb} size="sm">
          Coach Insights & Next Steps
        </Badge>
        <ul className="mt-4 space-y-2.5">
          {(report.suggestions || []).map((s, i) => (
            <li key={i} className="text-default flex items-start gap-3 text-xs sm:text-sm leading-relaxed">
              <span className="text-amber-400 mt-1 size-1.5 shrink-0 rounded-full bg-current" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended Learning Resources */}
      {resources.length > 0 && (
        <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-default text-lg font-bold">
              Targeted Learning Resources
            </h2>
            <Badge variant="brand" size="xs">
              AI Curated
            </Badge>
          </div>
          <p className="text-muted text-xs">
            Hand-picked articles, tutorials, and guides to close your identified knowledge gaps.
          </p>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((r, i) => (
              <a
                key={`${r.title}-${i}`}
                href={r.url || "#"}
                target={r.url ? "_blank" : undefined}
                rel="noreferrer"
                className="group bg-surface-2 border border-token hover:border-brand-500/40 rounded-2xl p-4 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                      <BookOpen className="size-4.5" />
                    </div>
                    <ArrowUpRight className="size-4 text-subtle group-hover:text-brand-400 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-default text-sm font-bold mt-3 group-hover:text-brand-300 transition-colors">
                    {r.title}
                  </p>
                  {r.description && (
                    <p className="text-muted text-xs mt-1 leading-relaxed line-clamp-2">
                      {r.description}
                    </p>
                  )}
                </div>
                <span className="text-subtle text-[10px] uppercase font-bold tracking-wider mt-3">
                  {r.type || "Guide"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Matching Job Roles */}
      {report.jobMatches?.length > 0 && (
        <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-default text-lg font-bold">
              Roles Matched to this Loop
            </h2>
            <Link
              to="/app/jobs"
              className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-xs font-bold"
            >
              All Matches <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <p className="text-muted text-xs">
            Calculated by matching your resume competencies and session scores against live job requirements.
          </p>

          <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {report.jobMatches.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="bg-surface-2 border border-token rounded-2xl p-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-default text-sm font-bold">{m.job.title}</p>
                    <p className="text-subtle text-xs mt-0.5">{m.job.company} · {m.job.location || "Remote"}</p>
                  </div>
                  <span className={`font-display text-lg font-extrabold ${scoreColor(m.matchScore)}`}>
                    {Math.round(m.matchScore)}%
                  </span>
                </div>
                {Array.isArray(m.skillGaps) && m.skillGaps.length > 0 && (
                  <div className="mt-3">
                    <p className="text-subtle text-[9px] uppercase font-bold tracking-wider">
                      Identified Gaps:
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.skillGaps.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value, tone = "text-brand-400" }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("size-8 rounded-xl bg-surface-2 flex items-center justify-center", tone)}>
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-subtle text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-default text-xs font-bold">{value}</p>
      </div>
    </div>
  );
}

function MetricBarRow({ label, value, suffix = "%", bar }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-default font-semibold">{label}</span>
        <span className={`font-bold ${scoreColor(bar ?? value)}`}>
          {value}
          {suffix}
        </span>
      </div>
      <div className="bg-surface-2 border border-token h-2 overflow-hidden rounded-full">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(0, Math.min(100, bar ?? value))}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="from-brand-500 to-accent-500 h-full bg-gradient-to-r"
        />
      </div>
    </div>
  );
}

function FeedbackCard({ title, tone, icon: Icon, items }) {
  const tones = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex size-10 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="size-5" />
        </div>
        <h3 className="text-default font-display text-base font-bold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-subtle text-xs italic">No entries recorded.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, k) => (
            <li key={k} className="flex items-start gap-2.5 text-xs sm:text-sm text-default leading-relaxed">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  tone === "emerald" ? "bg-emerald-400" : "bg-rose-400"
                )}
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MeasureCard({ label, value, hint }) {
  return (
    <div className="bg-surface-2 border border-token rounded-2xl p-4">
      <p className="text-subtle text-[10px] uppercase font-bold tracking-wider">{label}</p>
      <p className="text-default font-display mt-1 text-lg font-extrabold">{value}</p>
      <p className="text-muted mt-1 text-[11px] leading-snug">{hint}</p>
    </div>
  );
}

function wordCount(report) {
  const qs = report.interview?.questions || [];
  let total = 0;
  for (const q of qs) {
    const t = q.answer?.transcript;
    if (t) total += t.trim().split(/\s+/).filter(Boolean).length;
  }
  return total.toLocaleString();
}
