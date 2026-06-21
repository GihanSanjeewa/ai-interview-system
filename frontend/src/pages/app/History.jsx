import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Filter,
  PlayCircle,
  Search,
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
  { id: "all", label: "All" },
  ...Object.entries(TRACK_LABEL).map(([id, label]) => ({ id, label })),
];

const view = [
  { value: "table", label: "Table" },
  { value: "cards", label: "Cards" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-default text-3xl font-bold sm:text-4xl">
            Interview history
          </h1>
          <p className="text-muted mt-1">
            Every session you've run with Aria. Open any for the full report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs tabs={view} value={layout} onChange={setLayout} />
        </div>
      </div>

      <div className="bg-surface border-token flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <div className="bg-surface-2 border-token text-muted flex h-10 flex-1 items-center gap-2 rounded-xl border px-3.5">
          <Search className="size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role…"
            className="placeholder:text-subtle text-default h-full flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TRACK_OPTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold",
                cat === c.id
                  ? "border-brand-500/40 bg-brand-500/10 text-brand-300"
                  : "border-token bg-surface text-muted hover:text-default"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <Button variant="secondary" size="sm" leftIcon={Filter}>
          Filters
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching sessions"
          description="Try clearing the filters, or run a fresh mock interview."
          action={
            <Link to="/app/interview">
              <Button>Start interview</Button>
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
    <div className="bg-surface border-token overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-subtle text-left text-[11px] font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Track</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Score</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {items.map((iv) => {
              const dur = durationFor(iv);
              return (
                <motion.tr
                  key={iv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ backgroundColor: "var(--surface-2)" }}
                  className="text-default"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold">{iv.role}</p>
                    <p className="text-subtle text-xs">#{iv.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="brand">
                      {TRACK_LABEL[iv.category] || iv.category}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-muted flex items-center gap-1.5 text-xs">
                      <Calendar className="size-3.5" />
                      {formatDate(iv.createdAt)}
                    </span>
                  </td>
                  <td className="text-muted px-5 py-4 text-sm">
                    {dur ? formatDuration(dur) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={iv.status} />
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-display text-lg font-bold ${
                      iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
                    }`}
                  >
                    {iv.report ? iv.report.overallScore : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {iv.report && (
                        <Link to={`/app/reports/${iv.id}`}>
                          <Button size="sm" variant="secondary">
                            Report
                          </Button>
                        </Link>
                      )}
                      <Link to={`/app/interview`}>
                        <Button size="icon" variant="ghost">
                          <PlayCircle className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </td>
                </motion.tr>
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
          className="bg-surface border-token rounded-3xl border p-5"
        >
          <div className="flex items-start justify-between">
            <Badge variant="brand">{TRACK_LABEL[iv.category] || iv.category}</Badge>
            <span
              className={`font-display text-3xl font-bold ${
                iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
              }`}
            >
              {iv.report ? iv.report.overallScore : "—"}
            </span>
          </div>
          <h3 className="text-default mt-3 text-base font-semibold">
            {iv.role}
          </h3>
          <p className="text-subtle mt-1 text-xs">
            {formatDate(iv.createdAt)}
            {durationFor(iv) ? ` · ${formatDuration(durationFor(iv))}` : ""}
          </p>
          <div className="mt-5 flex gap-2">
            {iv.report ? (
              <Link to={`/app/reports/${iv.id}`} className="flex-1">
                <Button size="sm" variant="secondary" className="w-full">
                  View report
                </Button>
              </Link>
            ) : (
              <Link to={`/app/interview`} className="flex-1">
                <Button size="sm" variant="secondary" className="w-full">
                  Practice again
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
          transition={{ delay: i * 0.04 }}
          className="relative"
        >
          <span className="from-brand-500 to-accent-500 absolute -left-[18px] top-4 size-4 rounded-full bg-gradient-to-br ring-4 ring-[var(--bg)]" />
          <Link
            to={iv.report ? `/app/reports/${iv.id}` : "/app/interview"}
            className="bg-surface border-token block rounded-2xl border p-5 transition hover:border-brand-500/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-subtle text-xs">{formatDate(iv.createdAt)}</p>
                <h3 className="text-default text-base font-semibold">
                  {iv.role}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="brand">
                  {TRACK_LABEL[iv.category] || iv.category}
                </Badge>
                <span
                  className={`font-display text-2xl font-bold ${
                    iv.report ? scoreColor(iv.report.overallScore) : "text-subtle"
                  }`}
                >
                  {iv.report ? iv.report.overallScore : "—"}
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
    return <Badge variant="success">Completed</Badge>;
  if (status === "LIVE") return <Badge variant="info">Live</Badge>;
  if (status === "ABORTED") return <Badge variant="warning">Aborted</Badge>;
  if (status === "FAILED") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="default">Pending</Badge>;
}
