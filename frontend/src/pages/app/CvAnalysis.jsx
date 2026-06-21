import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CircularProgress } from "@/components/ui/Progress";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { cvApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { formatDate, cn } from "@/lib/utils";

const TRACK_LABEL = {
  software_engineering: "Software Engineering",
  web_development: "Web Development",
  data_science: "Data Science",
  networking: "Networking",
  ui_ux: "UI/UX",
  business_analysis: "Business Analysis",
};

export default function CvAnalysis() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [cvs, setCvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(null);
  const [drag, setDrag] = useState(false);

  const refresh = useCallback(async () => {
    const { items } = await cvApi.list();
    setCvs(items);
    if (items.length && (!active || !items.find((i) => i.id === active.id))) {
      setActive(items[0]);
    }
    return items;
  }, [active]);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err) {
        toast.error("Couldn't load your CVs", err?.response?.data?.title);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // poll while any CV is PENDING
  useEffect(() => {
    if (!cvs.some((c) => c.status === "PENDING")) return;
    const id = setInterval(async () => {
      try {
        const next = await refresh();
        if (active) {
          const updated = next.find((c) => c.id === active.id);
          if (updated) setActive(updated);
        }
      } catch {
        // ignore
      }
    }, 2500);
    return () => clearInterval(id);
  }, [cvs, active, refresh]);

  const handleFile = async (file) => {
    if (!file) return;
    const ok =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf") ||
      file.name.toLowerCase().endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!ok) {
      toast.error("Unsupported file", "Upload a PDF or DOCX.");
      return;
    }
    setUploading(true);
    try {
      const { cv } = await cvApi.upload(file);
      toast.success("Uploaded — analyzing", "Aria is extracting your skills.");
      setActive(cv);
      await refresh();
    } catch (err) {
      toast.error("Upload failed", err?.response?.data?.title);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const remove = async (cv) => {
    if (!confirm(`Delete ${cv.originalName}? This can't be undone.`)) return;
    try {
      await cvApi.remove(cv.id);
      toast.success("CV deleted");
      if (active?.id === cv.id) setActive(null);
      await refresh();
    } catch (err) {
      toast.error("Couldn't delete", err?.response?.data?.title);
    }
  };

  const startInterview = (track) => {
    navigate(`/app/interview?cvId=${active.id}&track=${track}`);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="brand" icon={Sparkles}>
            CV analysis · §3.1
          </Badge>
          <h1 className="font-display text-default mt-3 text-3xl font-bold sm:text-4xl">
            Upload your CV
          </h1>
          <p className="text-muted mt-1 max-w-2xl">
            Drop a PDF or DOCX. We extract your skills, education, experience,
            certifications and technologies — then suggest the interview tracks
            you should practice.
          </p>
        </div>
        <Button leftIcon={Upload} onClick={() => fileRef.current?.click()}>
          Upload new CV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </header>

      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        animate={{ scale: drag ? 1.01 : 1 }}
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition",
          drag
            ? "border-brand-500 bg-brand-500/10"
            : "border-token bg-surface hover:border-brand-500/40"
        )}
      >
        <div className="from-brand-500/10 to-accent-500/10 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br">
          {uploading ? (
            <Loader2 className="text-brand-400 size-6 animate-spin" />
          ) : (
            <Upload className="text-brand-400 size-6" />
          )}
        </div>
        <p className="text-default font-display text-lg font-semibold">
          {uploading ? "Uploading…" : drag ? "Drop to upload" : "Drag a CV here or click upload"}
        </p>
        <p className="text-muted mt-1 text-sm">
          PDF or DOCX · max 10 MB · we never share your file
        </p>
      </motion.div>

      {/* List + detail */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      ) : cvs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No CVs uploaded yet"
          description="Upload a CV to unlock AI-tailored interview tracks and job matches."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="space-y-3 lg:col-span-1">
            {cvs.map((cv) => (
              <button
                key={cv.id}
                onClick={() => setActive(cv)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  active?.id === cv.id
                    ? "border-brand-500/40 bg-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="from-brand-500/15 to-accent-500/15 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                  <FileText className="text-brand-400 size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-default truncate text-sm font-semibold">
                    {cv.originalName}
                  </p>
                  <p className="text-subtle mt-0.5 text-[11px]">
                    {formatDate(cv.createdAt)} · {prettySize(cv.sizeBytes)}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={cv.status} />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {active ? (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-6"
                >
                  <CvDetail
                    cv={active}
                    onRemove={() => remove(active)}
                    onStart={startInterview}
                    trackLabel={TRACK_LABEL}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function CvDetail({ cv, onRemove, onStart, trackLabel }) {
  const parsed = cv.parsed || {};
  const tracks = (cv.suggestedTracks || []).map((id) => ({
    id,
    label: trackLabel[id] || id,
  }));

  return (
    <>
      {/* Hero */}
      <div className="from-brand-500/15 to-accent-500/10 border-brand-500/30 relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative grid items-center gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <StatusBadge status={cv.status} />
            <h2 className="font-display text-default mt-2 text-2xl font-bold">
              {cv.originalName}
            </h2>
            <p className="text-muted text-sm">
              Uploaded {formatDate(cv.createdAt)} · {prettySize(cv.sizeBytes)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="danger"
                size="sm"
                leftIcon={Trash2}
                onClick={onRemove}
              >
                Delete
              </Button>
            </div>
          </div>
          <div className="flex justify-center sm:justify-end">
            {cv.status === "PARSED" ? (
              <CircularProgress value={cv.readinessScore ?? 0} size={130}>
                <div className="flex flex-col items-center">
                  <span className="font-display text-default text-3xl font-bold">
                    {cv.readinessScore ?? 0}
                  </span>
                  <span className="text-subtle text-[10px] uppercase tracking-wider">
                    Readiness
                  </span>
                </div>
              </CircularProgress>
            ) : cv.status === "PENDING" ? (
              <div className="text-muted flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin" />
                <span className="text-xs">Analyzing your CV…</span>
              </div>
            ) : (
              <div className="text-rose-400 flex flex-col items-center gap-2">
                <AlertCircle className="size-8" />
                <span className="text-xs">Analysis failed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested tracks */}
      {tracks.length > 0 && (
        <div className="bg-surface border-token rounded-3xl border p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-default text-lg font-semibold">
              Suggested interview tracks
            </h3>
            <Badge variant="brand" icon={Sparkles}>
              AI matched
            </Badge>
          </div>
          <p className="text-muted text-xs">
            We chose these based on the skills and experience we extracted.
            Start any of them directly.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => onStart(t.id)}
                className="group bg-surface-2 border-token hover:border-brand-500/40 flex items-center justify-between rounded-2xl border p-4 text-left transition"
              >
                <div className="flex items-center gap-3">
                  <div className="from-brand-500/15 to-accent-500/15 grid size-9 place-items-center rounded-xl bg-gradient-to-br">
                    <Mic className="text-brand-400 size-4.5" />
                  </div>
                  <p className="text-default text-sm font-semibold">
                    {t.label}
                  </p>
                </div>
                <ArrowRight className="text-subtle group-hover:text-brand-400 size-4 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extracted info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Bucket title="Skills" items={parsed.skills} accent="brand" />
        <Bucket title="Technologies" items={parsed.technologies} accent="accent" />
        <Bucket title="Education" items={parsed.education} accent="emerald" />
        <Bucket title="Experience" items={parsed.experience} accent="amber" />
        <Bucket
          title="Certifications"
          items={parsed.certifications}
          accent="rose"
          className="sm:col-span-2"
        />
      </div>
    </>
  );
}

function Bucket({ title, items, accent, className }) {
  const tones = {
    brand: "from-brand-500/20 to-brand-500/5 text-brand-400 border-brand-500/30",
    accent: "from-accent-500/20 to-accent-500/5 text-accent-400 border-accent-500/30",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30",
  };
  const list = Array.isArray(items) ? items : [];
  return (
    <div className={cn("bg-surface border-token rounded-2xl border p-5", className)}>
      <p className="text-default text-sm font-semibold">{title}</p>
      <p className="text-subtle mt-0.5 text-[11px] uppercase tracking-wider">
        {list.length} item{list.length === 1 ? "" : "s"}
      </p>
      {list.length === 0 ? (
        <p className="text-subtle mt-3 text-xs italic">Nothing extracted yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {list.slice(0, 24).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className={cn(
                "rounded-full border bg-gradient-to-br px-2.5 py-1 text-[11px] font-medium",
                tones[accent]
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "PARSED")
    return (
      <Badge variant="success" icon={CheckCircle2}>
        Parsed
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="danger" icon={AlertCircle}>
        Failed
      </Badge>
    );
  return (
    <Badge variant="warning" icon={Clock}>
      Analyzing
    </Badge>
  );
}

function prettySize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
