import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Download,
  Filter,
  LayoutGrid,
  List,
  PlayCircle,
  Search,
  Table,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Sparkline from "@/components/ui/Sparkline";
import Tabs from "@/components/ui/Tabs";
import EmptyState from "@/components/ui/EmptyState";
import { recentInterviews, categories } from "@/services/mockData";
import { formatDate, formatDuration, scoreColor, cn } from "@/lib/utils";

const view = [
  { value: "table", label: "Table" },
  { value: "cards", label: "Cards" },
  { value: "timeline", label: "Timeline" },
];

export default function History() {
  const [layout, setLayout] = useState("table");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");

  const filtered = useMemo(() => {
    return recentInterviews.filter((iv) => {
      const matchesQ = iv.role.toLowerCase().includes(query.toLowerCase());
      const matchesC =
        cat === "all" || iv.category.toLowerCase() === categories.find((c) => c.id === cat)?.label.toLowerCase();
      return matchesQ && matchesC;
    });
  }, [query, cat]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-default text-3xl font-bold sm:text-4xl">
            Interview history
          </h1>
          <p className="text-muted mt-1">
            Every session you've run with Aria. Replay, review or export any
            time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs tabs={view} value={layout} onChange={setLayout} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border-token flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <div className="bg-surface-2 border-token text-muted flex h-10 flex-1 items-center gap-2 rounded-xl border px-3.5">
          <Search className="size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by role, e.g. React, .NET, HR…"
            className="placeholder:text-subtle text-default h-full flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCat("all")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold",
              cat === "all"
                ? "border-brand-500/40 bg-brand-500/10 text-brand-300"
                : "border-token bg-surface text-muted hover:text-default"
            )}
          >
            All
          </button>
          {categories.slice(0, 5).map((c) => (
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

      {/* Views */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No matching sessions"
          description="Try clearing the filters or searching for a different role."
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

function TableView({ items }) {
  return (
    <div className="bg-surface border-token overflow-hidden rounded-3xl border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-subtle text-left text-[11px] font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Trend</th>
              <th className="px-5 py-3 text-right">Score</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {items.map((iv) => (
              <motion.tr
                key={iv.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ backgroundColor: "var(--surface-2)" }}
                className="text-default"
              >
                <td className="px-5 py-4">
                  <p className="font-semibold">{iv.role}</p>
                  <p className="text-subtle text-xs">#{iv.id}</p>
                </td>
                <td className="px-5 py-4">
                  <Badge variant="brand">{iv.category}</Badge>
                </td>
                <td className="px-5 py-4">
                  <span className="text-muted flex items-center gap-1.5 text-xs">
                    <Calendar className="size-3.5" />
                    {formatDate(iv.date)}
                  </span>
                </td>
                <td className="px-5 py-4 text-muted text-sm">
                  {formatDuration(iv.duration)}
                </td>
                <td className="px-5 py-4">
                  <Sparkline
                    data={Object.values(iv.metrics)}
                    width={80}
                    height={28}
                  />
                </td>
                <td className={`px-5 py-4 text-right font-display text-lg font-bold ${scoreColor(iv.score)}`}>
                  {iv.score}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link to="/app/reports">
                      <Button size="sm" variant="secondary">
                        Report
                      </Button>
                    </Link>
                    <Button size="icon" variant="ghost">
                      <PlayCircle className="size-4" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
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
            <Badge variant="brand">{iv.category}</Badge>
            <span className={`font-display text-3xl font-bold ${scoreColor(iv.score)}`}>
              {iv.score}
            </span>
          </div>
          <h3 className="text-default mt-3 text-base font-semibold">
            {iv.role}
          </h3>
          <p className="text-subtle mt-1 text-xs">
            {formatDate(iv.date)} · {formatDuration(iv.duration)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(iv.metrics).slice(0, 3).map(([k, v]) => (
              <div key={k} className="bg-surface-2 rounded-xl p-2">
                <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
                  {k}
                </p>
                <p className={`text-sm font-bold ${scoreColor(v)}`}>{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Link to="/app/reports" className="flex-1">
              <Button size="sm" variant="secondary" className="w-full">
                View report
              </Button>
            </Link>
            <Button size="icon" variant="ghost">
              <Download className="size-4" />
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TimelineView({ items }) {
  return (
    <div className="relative space-y-6 pl-6">
      <span className="bg-token absolute inset-y-0 left-2 w-px border-l border-dashed border-token" />
      {items.map((iv, i) => (
        <motion.div
          key={iv.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="relative"
        >
          <span className="from-brand-500 to-accent-500 absolute -left-[18px] top-4 size-4 rounded-full bg-gradient-to-br ring-4 ring-[var(--bg)]" />
          <div className="bg-surface border-token rounded-2xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-subtle text-xs">{formatDate(iv.date)}</p>
                <h3 className="text-default text-base font-semibold">
                  {iv.role}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="brand">{iv.category}</Badge>
                <span className={`font-display text-2xl font-bold ${scoreColor(iv.score)}`}>
                  {iv.score}
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Object.entries(iv.metrics).map(([k, v]) => (
                <div key={k} className="bg-surface-2 rounded-lg p-2 text-center">
                  <p className="text-subtle text-[10px] uppercase">{k}</p>
                  <p className={`text-sm font-bold ${scoreColor(v)}`}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
