import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  Mic,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CountUp } from "@/components/ui/Counter";
import Sparkline, { LineChart, RadialBar } from "@/components/ui/Sparkline";
import EmptyState from "@/components/ui/EmptyState";
import { cvApi, interviewApi, jobsApi, reportApi } from "@/services/api";
import { formatDate, formatDuration, scoreColor } from "@/lib/utils";

const TRACK_LABEL = {
  software_engineering: "Software Engineering",
  web_development: "Web Development",
  data_science: "Data Science",
  networking: "Networking",
  ui_ux: "UI/UX",
  business_analysis: "Business Analysis",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [cvs, setCvs] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [jobMatches, setJobMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cvRes, ivRes, rpRes, jbRes] = await Promise.all([
          cvApi.list().catch(() => ({ items: [] })),
          interviewApi.list().catch(() => ({ items: [] })),
          reportApi.list().catch(() => ({ items: [] })),
          jobsApi.recommendations().catch(() => ({ items: [] })),
        ]);
        setCvs(cvRes.items || []);
        setInterviews(ivRes.items || []);
        setReports(rpRes.items || []);
        setJobMatches(jbRes.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const completed = interviews.filter((i) => i.status === "COMPLETED").length;
  const avgScore =
    reports.length === 0
      ? 0
      : Math.round(
          reports.reduce((s, r) => s + (r.overallScore || 0), 0) /
            reports.length
        );
  const latestReport = reports[0];
  const latestCv = cvs[0];
  const suggestedTracks = (latestCv?.suggestedTracks || []).slice(0, 3);

  const trend = reports
    .slice(0, 7)
    .reverse()
    .map((r, i) => ({
      label: `S${i + 1}`,
      value: r.overallScore,
    }));

  const skillRadar = latestReport
    ? [
        { label: "Confidence", value: latestReport.confidence },
        { label: "Communication", value: latestReport.communication },
        { label: "Relevance", value: latestReport.relevance },
        { label: "Technical", value: latestReport.technical },
        { label: "Fluency", value: latestReport.fluency },
        {
          label: "Pace",
          value: Math.min(
            100,
            Math.round(((latestReport.pace ?? 120) - 60) / 1.2)
          ),
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="from-brand-600/30 via-brand-500/10 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8"
      >
        <div className="absolute -right-16 -top-16 size-60 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Badge variant="brand" icon={Flame}>
              {completed} mock{completed === 1 ? "" : "s"} completed
            </Badge>
            <h1 className="font-display text-default mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Welcome back, {user?.fullName?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-muted mt-2 max-w-xl">
              {latestCv
                ? "Aria has personalized recommendations based on your CV."
                : "Upload your CV to unlock AI-tailored interviews and job matches."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/app/interview">
                <Button leftIcon={Mic} rightIcon={ArrowRight}>
                  Start interview
                </Button>
              </Link>
              <Link to={latestCv ? "/app/cv" : "/app/cv"}>
                <Button variant="glass" leftIcon={latestCv ? FileText : Upload}>
                  {latestCv ? "My CV" : "Upload CV"}
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={Award}
              label="Avg. score"
              value={avgScore ? `${avgScore}%` : "—"}
              data={trend.map((t) => t.value)}
            />
            <StatTile
              icon={Briefcase}
              label="Job matches"
              value={<CountUp to={jobMatches.length} />}
              data={[3, 5, 6, 8, 7, 10, jobMatches.length]}
            />
          </div>
        </div>
      </motion.div>

      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Mic}
          label="Interviews completed"
          value={completed}
          delta={`${interviews.length} total`}
        />
        <StatCard
          icon={TrendingUp}
          label="Average score"
          value={avgScore ? `${avgScore}%` : "—"}
          delta={
            reports[0]
              ? `Latest ${reports[0].overallScore}%`
              : "No reports yet"
          }
          deltaPositive
        />
        <StatCard
          icon={FileText}
          label="CVs uploaded"
          value={cvs.length}
          delta={
            cvs.some((c) => c.status === "PARSED")
              ? "Ready to use"
              : cvs.length
              ? "Analyzing…"
              : "Upload to start"
          }
        />
        <StatCard
          icon={GraduationCap}
          label="Performance level"
          value={latestReport ? prettyLevel(latestReport.performanceLevel) : "—"}
          delta={latestReport ? "Based on last session" : "Run a mock first"}
          accent
        />
      </div>

      {/* CV + suggested tracks */}
      {latestCv ? (
        <div className="bg-surface border-token rounded-3xl border p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-default text-lg font-semibold">Your CV</h2>
              <p className="text-muted text-xs">
                Analysed by NLP — Aria uses this to tailor your interviews.
              </p>
            </div>
            <Link
              to="/app/cv"
              className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-sm font-semibold"
            >
              Open <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="bg-surface-2 border-token flex items-start gap-3 rounded-2xl border p-4">
              <div className="from-brand-500/15 to-accent-500/15 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                <FileText className="text-brand-400 size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-default truncate text-sm font-semibold">
                  {latestCv.originalName}
                </p>
                <p className="text-subtle mt-0.5 text-[11px]">
                  Uploaded {formatDate(latestCv.createdAt)} ·{" "}
                  {latestCv.status === "PARSED"
                    ? `${latestCv.readinessScore ?? 60}% readiness`
                    : "Analyzing…"}
                </p>
              </div>
            </div>
            <div className="lg:col-span-2">
              <p className="text-subtle text-[11px] font-semibold uppercase tracking-wider">
                Suggested interview tracks
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestedTracks.length === 0 ? (
                  <span className="text-subtle text-sm italic">
                    Once the CV is parsed, suggestions appear here.
                  </span>
                ) : (
                  suggestedTracks.map((id) => (
                    <Link
                      key={id}
                      to={`/app/interview?cvId=${latestCv.id}&track=${id}`}
                      className="bg-brand-500/10 border-brand-500/30 text-brand-300 hover:bg-brand-500/20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                    >
                      <Sparkles className="size-3" />
                      {TRACK_LABEL[id] || id}
                      <ArrowRight className="size-3" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <EmptyState
            icon={FileText}
            title="No CV uploaded yet"
            description="Upload a PDF/DOCX so Aria can recommend interview tracks and match you to jobs."
            action={
              <Link to="/app/cv">
                <Button leftIcon={Upload}>Upload CV</Button>
              </Link>
            }
          />
        )
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-surface border-token rounded-3xl border p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-default text-lg font-semibold">
                Performance trend
              </h2>
              <p className="text-muted text-xs">
                Overall score across your most recent sessions
              </p>
            </div>
            {trend.length > 1 && (
              <Badge variant="success" icon={TrendingUp}>
                {trend[trend.length - 1].value - trend[0].value >= 0 ? "+" : ""}
                {trend[trend.length - 1].value - trend[0].value} pts
              </Badge>
            )}
          </div>
          {trend.length === 0 ? (
            <div className="text-subtle py-10 text-center text-sm italic">
              Run a mock interview to see your performance trend.
            </div>
          ) : (
            <LineChart data={trend} height={220} />
          )}
        </div>

        <div className="bg-surface border-token rounded-3xl border p-6">
          <h2 className="text-default text-lg font-semibold">Skill breakdown</h2>
          <p className="text-muted text-xs">From your latest session (§3.3)</p>
          {skillRadar.length === 0 ? (
            <div className="text-subtle py-10 text-center text-sm italic">
              No metrics yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {skillRadar.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-default font-medium">{s.label}</span>
                    <span className={`font-semibold ${scoreColor(s.value)}`}>
                      {s.value}
                      {s.label === "Pace" ? "" : "%"}
                    </span>
                  </div>
                  <div className="bg-surface-2 border-token h-1.5 overflow-hidden rounded-full border">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      className="from-brand-400 to-accent-400 h-full rounded-full bg-gradient-to-r"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent + Job matches */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="bg-surface border-token rounded-3xl border">
            <div className="border-token flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-default text-lg font-semibold">
                  Recent interviews
                </h2>
                <p className="text-muted text-xs">
                  Your latest mock sessions and how they scored.
                </p>
              </div>
              <Link
                to="/app/history"
                className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-sm font-semibold"
              >
                View all <ArrowUpRight className="size-4" />
              </Link>
            </div>
            {interviews.length === 0 ? (
              <div className="text-subtle px-6 py-10 text-center text-sm italic">
                No interviews yet — start your first mock.
              </div>
            ) : (
              <ul className="divide-y divide-token">
                {interviews.slice(0, 5).map((iv) => {
                  const report = iv.report;
                  const dur =
                    iv.startedAt && iv.endedAt
                      ? Math.round(
                          (new Date(iv.endedAt).getTime() -
                            new Date(iv.startedAt).getTime()) /
                            1000
                        )
                      : 0;
                  return (
                    <li
                      key={iv.id}
                      className="hover:bg-surface-2 flex items-center gap-4 p-5 transition"
                    >
                      <div className="from-brand-500/20 to-accent-500/20 grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br">
                        <Mic className="text-brand-400 size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-default truncate text-sm font-semibold">
                          {iv.role}
                        </p>
                        <div className="text-subtle mt-0.5 flex items-center gap-2 text-xs">
                          <span>{TRACK_LABEL[iv.category] || iv.category}</span>
                          <span>·</span>
                          <span>{iv.difficulty}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {formatDate(iv.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {report ? (
                          <Link to={`/app/reports/${iv.id}`}>
                            <p
                              className={`font-display text-xl font-bold ${scoreColor(
                                report.overallScore
                              )}`}
                            >
                              {report.overallScore}
                            </p>
                          </Link>
                        ) : (
                          <span className="text-subtle text-xs">No report</span>
                        )}
                        {dur > 0 && (
                          <p className="text-subtle text-[10px]">
                            {formatDuration(dur)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="bg-surface border-token rounded-3xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-default text-lg font-semibold">
                Top job matches
              </h2>
              <Badge variant="brand">§3.5</Badge>
            </div>
            <p className="text-muted mt-1 text-xs">
              From your CV + latest report.
            </p>
            {jobMatches.length === 0 ? (
              <div className="text-subtle mt-5 text-sm italic">
                Finish a mock interview to see matched roles.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {jobMatches.slice(0, 3).map((m) => (
                  <Link
                    key={m.job.id}
                    to="/app/jobs"
                    className="group bg-surface-2 border-token hover:border-brand-500/40 flex items-start gap-3 rounded-2xl border p-4 transition"
                  >
                    <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                      <Briefcase className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-default truncate text-sm font-semibold">
                        {m.job.title}
                      </p>
                      <p className="text-subtle truncate text-xs">
                        {m.job.company} · {m.job.location || "Remote"}
                      </p>
                    </div>
                    <span
                      className={`font-display text-lg font-bold ${scoreColor(
                        m.match.score
                      )}`}
                    >
                      {m.match.score}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {avgScore > 0 && (
            <div className="bg-surface border-token rounded-3xl border p-6 text-center">
              <RadialBar value={avgScore} label="Avg score" />
              <p className="text-muted mt-3 text-sm">
                {avgScore >= 80
                  ? "You're in the top band — keep momentum."
                  : avgScore >= 60
                  ? "Solid foundation — focus on weakest metric."
                  : "Build basics first — clarity and pacing."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyLevel(level) {
  if (!level) return "—";
  return level.charAt(0) + level.slice(1).toLowerCase();
}

function StatTile({ icon: Icon, label, value, data }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
        <Icon className="text-brand-400 size-4" />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-display text-default text-2xl font-bold">{value}</p>
      </div>
      <div className="mt-2">
        <Sparkline data={data?.length ? data : [0, 0, 0, 0, 0, 0, 0]} width={120} height={28} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, delta, deltaPositive, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-surface border-token rounded-2xl border p-5"
    >
      <div className="flex items-center justify-between">
        <div
          className={`grid size-10 place-items-center rounded-xl ${
            accent
              ? "from-brand-500 to-accent-500 bg-gradient-to-br text-white"
              : "bg-surface-2 text-brand-400"
          }`}
        >
          <Icon className="size-4.5" />
        </div>
        <span
          className={`text-[11px] font-semibold ${
            deltaPositive ? "text-emerald-400" : "text-muted"
          }`}
        >
          {delta}
        </span>
      </div>
      <p className="text-muted mt-4 text-xs font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p className="font-display text-default mt-1 text-2xl font-bold">
        {value}
      </p>
    </motion.div>
  );
}
