import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Bot,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  Mic,
  Play,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
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
  ui_ux: "UI/UX Design",
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
      {/* Hero Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card from-brand-600/20 via-brand-500/10 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8 shadow-xl"
      >
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />

        <div className="relative grid items-center gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={Flame} dot pulse>
                {completed} Session{completed === 1 ? "" : "s"} Completed
              </Badge>
              <Badge variant="outline" icon={Bot}>
                Aria 4.7 Connected
              </Badge>
            </div>

            <h1 className="font-display text-default mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
              Welcome to Studio, {user?.fullName?.split(" ")[0] || user?.name?.split(" ")[0] || "Candidate"} 👋
            </h1>

            <p className="text-muted mt-2 max-w-xl text-sm sm:text-base leading-relaxed">
              {latestCv
                ? "Your CV has been parsed. Aria has tailored scenario questions ready for your practice loop."
                : "Upload your CV to unlock customized technical tracks and instant role matches."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/app/interview">
                <Button size="md" leftIcon={Mic} rightIcon={ArrowRight} className="shadow-glow">
                  Launch Mock Session
                </Button>
              </Link>
              <Link to="/app/cv">
                <Button variant="secondary" size="md" leftIcon={latestCv ? FileText : Upload}>
                  {latestCv ? "Manage My CV" : "Upload Resume (PDF/DOCX)"}
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Mini-Cards */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <div className="glass-strong rounded-2xl p-4 border border-token text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                  Avg. Score
                </span>
                <Award className="size-4 text-brand-400" />
              </div>
              <p className="font-display text-default text-2xl font-extrabold mt-1">
                {avgScore ? `${avgScore}%` : "—"}
              </p>
              <div className="mt-2">
                <Sparkline data={trend.map((t) => t.value)} width={100} height={24} />
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-4 border border-token text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-subtle tracking-wider">
                  Role Matches
                </span>
                <Briefcase className="size-4 text-accent-400" />
              </div>
              <p className="font-display text-default text-2xl font-extrabold mt-1">
                <CountUp to={jobMatches.length} />
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold mt-2 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                AI Ranked
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI Stats Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Mic}
          label="Mocks Completed"
          value={completed}
          delta={`${interviews.length} total attempts`}
          tone="brand"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Accuracy"
          value={avgScore ? `${avgScore}%` : "—"}
          delta={reports[0] ? `Latest session: ${reports[0].overallScore}%` : "No sessions yet"}
          deltaPositive
          tone="emerald"
        />
        <StatCard
          icon={FileText}
          label="CV Analysis"
          value={cvs.length}
          delta={
            cvs.some((c) => c.status === "PARSED")
              ? "Extracted & Ready"
              : cvs.length
              ? "Parsing in progress…"
              : "Upload CV to unlock"
          }
          tone="accent"
        />
        <StatCard
          icon={GraduationCap}
          label="Performance Band"
          value={latestReport ? prettyLevel(latestReport.performanceLevel) : "Unranked"}
          delta={latestReport ? "Classified by ML engine" : "Run first mock loop"}
          accent
        />
      </div>

      {/* CV Status & Recommended Tracks */}
      {latestCv ? (
        <div className="glass-card rounded-3xl p-6 sm:p-7 border border-token">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-default text-lg font-bold">
                Active Resume Profile
              </h2>
              <p className="text-muted text-xs">
                Parsed by NLP to generate customized technical follow-ups.
              </p>
            </div>
            <Link
              to="/app/cv"
              className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-xs font-bold"
            >
              Open Full Analysis <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="bg-surface-2 border border-token flex items-center gap-3.5 rounded-2xl p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-default truncate text-sm font-bold">
                  {latestCv.originalName}
                </p>
                <p className="text-subtle text-xs mt-0.5">
                  Uploaded {formatDate(latestCv.createdAt)} ·{" "}
                  {latestCv.status === "PARSED" ? (
                    <span className="text-emerald-400 font-semibold">{latestCv.readinessScore ?? 75}% readiness</span>
                  ) : (
                    "Analyzing…"
                  )}
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              <span className="text-subtle text-[10px] font-bold uppercase tracking-wider">
                Recommended Practice Tracks for your Profile:
              </span>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {suggestedTracks.length === 0 ? (
                  <span className="text-subtle text-xs italic">
                    Once CV is fully parsed, suggested tracks appear here.
                  </span>
                ) : (
                  suggestedTracks.map((id) => (
                    <Link
                      key={id}
                      to={`/app/interview?cvId=${latestCv.id}&track=${id}`}
                      className="bg-brand-500/10 border border-brand-500/30 text-brand-300 hover:bg-brand-500/20 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm"
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
            title="No CV Uploaded Yet"
            description="Upload your resume in PDF or DOCX so Aria can tailor technical questions to your exact experience."
            action={
              <Link to="/app/cv">
                <Button leftIcon={Upload}>Upload Your Resume</Button>
              </Link>
            }
          />
        )
      )}

      {/* Analytics Bento Grid (Trend Chart + Skill Radar) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Trend Chart */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 border border-token lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-default text-lg font-bold">
                Performance Score Trajectory
              </h2>
              <p className="text-muted text-xs">
                Historical score progression across your most recent mock interviews
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
            <div className="text-subtle py-12 text-center text-xs italic">
              Complete mock interviews to plot your performance trajectory.
            </div>
          ) : (
            <LineChart data={trend} height={220} />
          )}
        </div>

        {/* Skill Breakdown */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 border border-token">
          <h2 className="font-display text-default text-lg font-bold">
            Skill Breakdown
          </h2>
          <p className="text-muted text-xs">From your latest scored interview loop</p>

          {skillRadar.length === 0 ? (
            <div className="text-subtle py-12 text-center text-xs italic">
              Complete a session to generate skill dimensions.
            </div>
          ) : (
            <div className="mt-5 space-y-3.5">
              {skillRadar.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-default font-semibold">{s.label}</span>
                    <span className={`font-bold ${scoreColor(s.value)}`}>
                      {s.value}
                      {s.label === "Pace" ? "" : "%"}
                    </span>
                  </div>
                  <div className="bg-surface-2 border border-token h-2 overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value}%` }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                      className="from-brand-500 to-accent-500 h-full rounded-full bg-gradient-to-r"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Interviews & Matched Jobs Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Interviews List */}
        <div className="lg:col-span-3">
          <div className="glass-card rounded-3xl border border-token overflow-hidden">
            <div className="border-b border-token flex items-center justify-between p-6">
              <div>
                <h2 className="font-display text-default text-lg font-bold">
                  Recent Interview Loops
                </h2>
                <p className="text-muted text-xs">
                  Past sessions, evaluated criteria, and performance scores.
                </p>
              </div>
              <Link
                to="/app/history"
                className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-xs font-bold"
              >
                View History <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            {interviews.length === 0 ? (
              <div className="text-subtle p-12 text-center text-xs italic">
                No interviews recorded yet — start your first session with Aria.
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
                      className="hover:bg-surface-2/60 flex items-center gap-4 p-4 sm:p-5 transition"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                        <Mic className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-default truncate text-sm font-bold">
                          {iv.role}
                        </p>
                        <div className="text-subtle mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                          <span>{TRACK_LABEL[iv.category] || iv.category}</span>
                          <span>·</span>
                          <span className="capitalize">{iv.difficulty}</span>
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
                            <p className={`font-display text-xl font-extrabold ${scoreColor(report.overallScore)}`}>
                              {report.overallScore}
                            </p>
                          </Link>
                        ) : (
                          <span className="text-subtle text-xs">Processing</span>
                        )}
                        {dur > 0 && (
                          <p className="text-subtle text-[10px] mt-0.5">
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

        {/* Top Job Matches Preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl border border-token p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-default text-lg font-bold">
                Top Matched Roles
              </h2>
              <Badge variant="brand" size="xs">
                AI Matched
              </Badge>
            </div>
            <p className="text-muted text-xs mt-1">
              Based on your CV skills + latest interview performance.
            </p>

            {jobMatches.length === 0 ? (
              <div className="text-subtle py-8 text-center text-xs italic">
                Complete a mock interview to surface matched job opportunities.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {jobMatches.slice(0, 3).map((m) => (
                  <Link
                    key={m.job.id}
                    to="/app/jobs"
                    className="group bg-surface-2/80 hover:bg-surface-3 border border-token hover:border-brand-500/40 flex items-start gap-3 rounded-2xl p-3.5 transition"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400 border border-accent-500/30">
                      <Briefcase className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-default truncate text-xs sm:text-sm font-bold">
                        {m.job.title}
                      </p>
                      <p className="text-subtle truncate text-[11px]">
                        {m.job.company} · {m.job.location || "Remote"}
                      </p>
                    </div>
                    <span className={`font-display text-base font-extrabold ${scoreColor(m.match.score)}`}>
                      {m.match.score}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {avgScore > 0 && (
            <div className="glass-card rounded-3xl border border-token p-6 text-center">
              <RadialBar value={avgScore} label="Readiness Index" />
              <p className="text-muted mt-3 text-xs leading-relaxed">
                {avgScore >= 80
                  ? "Top readiness band — primed for senior loop interviews."
                  : avgScore >= 60
                  ? "Solid foundation — focus on closing identified technical gaps."
                  : "Focus on speech cadence and structuring answers with the STAR method."}
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

function StatCard({ icon: Icon, label, value, delta, deltaPositive, tone = "brand", accent }) {
  const tones = {
    brand: "bg-brand-500/15 text-brand-400 border-brand-500/30",
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    accent: "bg-accent-500/15 text-accent-400 border-accent-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card rounded-3xl border border-token p-5"
    >
      <div className="flex items-center justify-between">
        <div
          className={`grid size-11 place-items-center rounded-2xl border ${
            accent
              ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white border-transparent shadow-md"
              : tones[tone]
          }`}
        >
          <Icon className="size-5" />
        </div>
        <span
          className={`text-[11px] font-semibold ${
            deltaPositive ? "text-emerald-400" : "text-subtle"
          }`}
        >
          {delta}
        </span>
      </div>
      <p className="text-subtle mt-4 text-[11px] font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className="font-display text-default mt-1 text-2xl font-extrabold">
        {value}
      </p>
    </motion.div>
  );
}
