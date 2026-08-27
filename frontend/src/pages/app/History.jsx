import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Filter,
  Mic,
  PlayCircle,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { interviewApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatDuration, scoreColor, cn } from "@/lib/utils";

const TRACK_LABEL = {
  software_engineering: "Software Engineering",
  web_development: "Web Development",
  data_science: "Data Science",
  networking: "Networking",
  ui_ux: "UI/UX",
  business_analysis: "Business Analysis",
};

const TRACK_OPTIONS = [
  { id: "all", label: "All Tracks" },
  ...Object.entries(TRACK_LABEL).map(([id, label]) => ({ id, label })),
];

const viewTabs = [
  { value: "table", label: "Table View" },
  { value: "cards", label: "Card Grid" },
  { value: "timeline", label: "Timeline" },
];

export default function History() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState("table");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const { items } = await interviewApi.list();
        setItems(items);
      } catch (err) {
        toast.error("Couldn't load history", err?.response?.data?.title);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((iv) => {
      const q = query.toLowerCase();
      const matchesQ = !q || iv.role.toLowerCase().includes(q);
      const matchesC = cat === "all" || iv.category === cat;
      return matchesQ && matchesC;
    });
  }, [items, query, cat]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="brand" icon={Sparkles} size="xs" dot pulse>
            Session Archive
          </Badge>
          <h1 className="font-display text-default mt-2 text-3xl font-extrabold sm:text-4xl">
            Interview History
          </h1>
          <p className="text-muted mt-1 text-xs sm:text-sm">
            All past practice sessions, answers, and detailed analytical reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs tabs={viewTabs} value={layout} onChange={setLayout} />
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="glass-card rounded-2xl border border-token p-3.5 flex flex-wrap items-center gap-3">
        <div className="bg-surface-2/80 border border-token text-muted flex h-10 flex-1 items-center gap-2.5 rounded-xl px-3.5 min-w-[220px]">
          <Search className="size-4 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role or title…"
            className="placeholder:text-subtle text-default h-full flex-1 bg-transparent text-xs font-semibold outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {TRACK_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer select-none",
                cat === c.id
                  ? "border-brand-500 bg-brand-500/15 text-brand-300 shadow-sm"
                  : "border-token bg-surface text-muted hover:bg-surface-2 hover:text-default"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <Skeleton className="h-72 rounded-3xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mic}
          title="No Sessions Match Your Filters"
          description="Clear your search filters or start a fresh mock session with Aria."
          action={
            <Link to="/app/interview">
              <Button leftIcon={Mic}>Start New Interview</Button>
            </Link>
          }
        />
      ) : layout === "table" ? (
        <TableView items={filtered} />
      ) : layout === "cards" ? (
        <CardsView items={filtered} />
      ) : (
        <TimelineView items={filtered} />
      )}
    </div>
  );
}

function durationFor(iv) {
  if (!iv.startedAt || !iv.endedAt) return 0;
  return Math.round(
    (new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 1000
  );
}

function TableView({ items }) {
  return (
    <div className="glass-card overflow-hidden rounded-3xl border border-token shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-2/90 text-subtle text-[10px] font-bold uppercase tracking-wider border-b border-token">
            <tr>
              <th className="px-5 py-3.5">Role / Session</th>
              <th className="px-5 py-3.5">Technical Track</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Duration</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Score</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token/60">
            {items.map((iv) => {
              const dur = durationFor(iv);
              return (
                <tr
                  key={iv.id}
                  className="hover:bg-surface-2/60 transition text-default font-medium"
                >
                  <td className="px-5 py-4">
                    <p className="font-bold text-sm">{iv.role}</p>
                    <span className="text-subtle text-[11px] font-mono">#{iv.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="brand" size="xs">
                      {TRACK_LABEL[iv.category] || iv.category}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-muted flex items-center gap-1.5 text-xs font-semibold">
                      <Calendar className="size-3.5 text-subtle" />
                      {formatDate(iv.createdAt)}
                    </span>
                  </td>
                  <td className="text-muted px-5 py-4 text-xs">
                    {dur ? formatDuration(dur) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={iv.status} />
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-display text-base font-extrabold ${
                      iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
                    }`}
                  >
                    {iv.report ? `${iv.report.overallScore}%` : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {iv.report ? (
                        <Link to={`/app/reports/${iv.id}`}>
                          <Button size="sm" variant="secondary">
                            View Report
                          </Button>
                        </Link>
                      ) : (
                        <Link to="/app/interview">
                          <Button size="sm" variant="secondary" leftIcon={PlayCircle}>
                            Resume
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardsView({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((iv) => (
        <motion.div
          key={iv.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl border border-token p-5 sm:p-6 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between">
              <Badge variant="brand" size="xs">
                {TRACK_LABEL[iv.category] || iv.category}
              </Badge>
              <span
                className={`font-display text-2xl font-extrabold ${
                  iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
                }`}
              >
                {iv.report ? `${iv.report.overallScore}%` : "—"}
              </span>
            </div>

            <h3 className="text-default font-display text-base font-bold mt-4">
              {iv.role}
            </h3>

            <p className="text-subtle text-xs mt-1 flex items-center gap-1.5">
              <Calendar className="size-3 text-subtle" />
              {formatDate(iv.createdAt)}
              {durationFor(iv) ? ` · ${formatDuration(durationFor(iv))}` : ""}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-token/60 flex gap-2">
            {iv.report ? (
              <Link to={`/app/reports/${iv.id}`} className="flex-1">
                <Button size="sm" variant="secondary" className="w-full">
                  Feedback Report
                </Button>
              </Link>
            ) : (
              <Link to="/app/interview" className="flex-1">
                <Button size="sm" variant="secondary" className="w-full">
                  Practice Loop
                </Button>
              </Link>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TimelineView({ items }) {
  return (
    <div className="relative space-y-6 pl-6">
      <span className="absolute inset-y-0 left-2 w-px border-l border-dashed border-token" />
      {items.map((iv, i) => (
        <motion.div
          key={iv.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="relative"
        >
          <span className="from-brand-500 to-accent-500 absolute -left-[19px] top-5 size-4 rounded-full bg-gradient-to-br ring-4 ring-[var(--bg)] shadow-md" />
          <Link
            to={iv.report ? `/app/reports/${iv.id}` : "/app/interview"}
            className="glass-card block rounded-2xl border border-token p-5 transition hover:border-brand-500/50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-subtle text-xs font-semibold">{formatDate(iv.createdAt)}</span>
                <h3 className="text-default font-display text-base font-bold mt-0.5">
                  {iv.role}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="brand" size="xs">
                  {TRACK_LABEL[iv.category] || iv.category}
                </Badge>
                <span
                  className={`font-display text-xl font-extrabold ${
                    iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
                  }`}
                >
                  {iv.report ? `${iv.report.overallScore}%` : "—"}
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "COMPLETED")
    return <Badge variant="success" size="xs">Completed</Badge>;
  if (status === "LIVE")
    return <Badge variant="brand" size="xs" dot pulse>Live</Badge>;
  if (status === "ABORTED")
    return <Badge variant="warning" size="xs">Aborted</Badge>;
  if (status === "FAILED")
    return <Badge variant="danger" size="xs">Failed</Badge>;
  return <Badge variant="default" size="xs">Pending</Badge>;
}
