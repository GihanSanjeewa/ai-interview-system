import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Calendar,
  Clock,
  Flame,
  Mic,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CountUp } from "@/components/ui/Counter";
import Sparkline, { LineChart, BarChart, RadialBar } from "@/components/ui/Sparkline";
import {
  recentInterviews,
  skillRadar,
  trendSeries,
  upcomingPrompts,
} from "@/services/mockData";
import { formatDate, formatDuration, scoreColor } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const avgScore = Math.round(
    recentInterviews.reduce((a, b) => a + b.score, 0) / recentInterviews.length
  );

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="from-brand-600/30 via-brand-500/10 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8"
      >
        <div className="absolute -right-16 -top-16 size-60 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-20 right-1/3 size-60 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Badge variant="brand" icon={Flame}>
              7-day streak
            </Badge>
            <h1 className="font-display text-default mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              Welcome back, {user?.name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-muted mt-2 max-w-xl">
              Aria has 3 personalized mocks ready for you today. Your last
              session improved your communication score by{" "}
              <span className="text-emerald-400 font-semibold">+6 pts</span>.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/app/interview">
                <Button leftIcon={Mic} rightIcon={ArrowRight}>
                  Start interview
                </Button>
              </Link>
              <Link to="/app/history">
                <Button variant="glass" leftIcon={PlayCircle}>
                  Replay last
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
            <StatTile
              icon={Award}
              label="Avg. score"
              value={`${avgScore}%`}
              trend="+4%"
              data={[60, 70, 65, 78, 80, 86, 90]}
            />
            <StatTile
              icon={Mic}
              label="Sessions"
              value={<CountUp to={42} />}
              trend="+5"
              data={[3, 5, 6, 8, 7, 10, 9]}
            />
          </div>
        </div>
      </motion.div>

      {/* Stat strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Award}
          label="Interviews completed"
          value="42"
          delta="+8 this week"
          deltaPositive
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. confidence"
          value="78%"
          delta="+6% vs last week"
          deltaPositive
        />
        <StatCard
          icon={Clock}
          label="Total practice time"
          value="18h 42m"
          delta="+2h 10m"
          deltaPositive
        />
        <StatCard
          icon={Sparkles}
          label="Best track"
          value="React.js"
          delta="91% avg"
          accent
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-surface border-token rounded-3xl border p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-default text-lg font-semibold">
                Performance trend
              </h2>
              <p className="text-muted text-xs">Overall score across the last 7 sessions</p>
            </div>
            <Badge variant="success" icon={TrendingUp}>
              +12%
            </Badge>
          </div>
          <LineChart data={trendSeries} height={220} />
        </div>

        <div className="bg-surface border-token rounded-3xl border p-6">
          <h2 className="text-default text-lg font-semibold">
            Skill breakdown
          </h2>
          <p className="text-muted text-xs">Average per metric (last 30 days)</p>
          <div className="mt-5 space-y-3">
            {skillRadar.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-default font-medium">{s.label}</span>
                  <span className={`font-semibold ${scoreColor(s.value)}`}>
                    {s.value}%
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
        </div>
      </div>

      {/* Recent + Upcoming */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="bg-surface border-token rounded-3xl border">
            <div className="border-token flex items-center justify-between border-b p-6">
              <div>
                <h2 className="text-default text-lg font-semibold">
                  Recent interviews
                </h2>
                <p className="text-muted text-xs">
                  Your last 5 sessions and how they scored.
                </p>
              </div>
              <Link
                to="/app/history"
                className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 text-sm font-semibold"
              >
                View all <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <ul className="divide-y divide-token">
              {recentInterviews.map((iv) => (
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
                      <span>{iv.category}</span>
                      <span>·</span>
                      <span>{iv.difficulty}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> {formatDate(iv.date)}
                      </span>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <Sparkline data={Object.values(iv.metrics)} width={80} height={28} />
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-xl font-bold ${scoreColor(iv.score)}`}>
                      {iv.score}
                    </p>
                    <p className="text-subtle text-[10px]">
                      {formatDuration(iv.duration)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="bg-surface border-token rounded-3xl border p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-default text-lg font-semibold">
                Recommended next
              </h2>
              <Badge variant="brand">AI picked</Badge>
            </div>
            <p className="text-muted mt-1 text-xs">
              Based on your weak metrics and recent transcripts.
            </p>
            <div className="mt-5 space-y-3">
              {upcomingPrompts.map((p, i) => (
                <Link
                  key={i}
                  to="/app/interview"
                  className="group bg-surface-2 border-token hover:border-brand-500/40 flex items-start gap-3 rounded-2xl border p-4 transition"
                >
                  <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                    <Sparkles className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-default truncate text-sm font-semibold">
                      {p.title}
                    </p>
                    <p className="text-muted mt-0.5 text-xs">{p.desc}</p>
                    <div className="text-subtle mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                      <Clock className="size-3" />
                      {p.duration} min
                      <span>·</span>
                      <span>{p.tag}</span>
                    </div>
                  </div>
                  <ArrowRight className="text-subtle group-hover:text-brand-400 mt-1 size-4 transition" />
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-surface border-token rounded-3xl border p-6 text-center">
            <RadialBar value={avgScore} label="Avg score" />
            <p className="text-muted mt-3 text-sm">
              Keep going — top 12% of candidates this week.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, trend, data }) {
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
        <span className="text-emerald-400 text-[11px] font-semibold">
          {trend}
        </span>
      </div>
      <div className="mt-2">
        <Sparkline data={data} width={120} height={28} />
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
        <div className={`grid size-10 place-items-center rounded-xl ${accent ? "from-brand-500 to-accent-500 bg-gradient-to-br text-white" : "bg-surface-2 text-brand-400"}`}>
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
