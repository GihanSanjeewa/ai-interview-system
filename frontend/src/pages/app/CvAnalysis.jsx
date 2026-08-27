import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  Upload,
  Zap,
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
  swe: "Software Engineering",
  software_engineering: "Software Engineering",
  react: "React / Frontend",
  web_development: "Web Development",
  node: "Node.js / Backend",
  python: "Python / Backend",
  devops: "DevOps & Cloud",
  system_design: "System Design",
  "system-design": "System Design",
  ml: "Machine Learning & AI",
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
  }, []);

  // Poll while any CV is PENDING
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
      toast.error("Unsupported file format", "Please upload a PDF or DOCX file.");
      return;
    }
    setUploading(true);
    try {
      const { cv } = await cvApi.upload(file);
      toast.success("Resume Uploaded", "Aria's NLP engine is extracting your competencies.");
      setActive(cv);
      await refresh();
    } catch (err) {
      toast.error("Upload failed", err?.response?.data?.title || "Error parsing file.");
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
    if (!confirm(`Delete ${cv.originalName}? This action is irreversible.`)) return;
    try {
      await cvApi.remove(cv.id);
      toast.success("CV deleted");
      if (active?.id === cv.id) setActive(null);
      await refresh();
    } catch (err) {
      toast.error("Couldn't delete CV", err?.response?.data?.title);
    }
  };

  const startInterview = (track) => {
    navigate(`/app/interview?cvId=${active.id}&track=${track}`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="brand" icon={Sparkles} dot pulse>
            Resume NLP Parser
          </Badge>
          <h1 className="font-display text-default mt-3 text-3xl font-extrabold sm:text-4xl">
            CV Analysis & Skill Extraction
          </h1>
          <p className="text-muted mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed">
            Drop your PDF or DOCX resume. Our multi-layer NLP model extracts your demonstrated
            skills, certifications, and technologies to tailor scenario questions for mock loops.
          </p>
        </div>
        <Button leftIcon={Upload} onClick={() => fileRef.current?.click()} className="shadow-glow">
          Upload New Resume
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </header>

      {/* Drag & Drop Upload Zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        animate={{ scale: drag ? 1.01 : 1 }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer",
          drag
            ? "border-brand-500 bg-brand-500/10 shadow-glow"
            : "border-token bg-surface/50 hover:border-brand-500/50 hover:bg-surface-2/60"
        )}
      >
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-400 border border-brand-500/30 shadow-md">
          {uploading ? (
            <Loader2 className="size-7 animate-spin" />
          ) : (
            <Upload className="size-7" />
          )}
        </div>
        <p className="text-default font-display text-lg font-bold">
          {uploading ? "Extracting competencies with NLP…" : drag ? "Drop your resume now" : "Drag and drop your CV here or click to browse"}
        </p>
        <p className="text-muted mt-1.5 text-xs">
          Supports PDF or DOCX · Max 10MB · Stored securely with zero public training
        </p>
      </motion.div>

      {/* CV List & Active Detail */}
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl lg:col-span-2" />
        </div>
      ) : cvs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No CV Uploaded Yet"
          description="Upload your resume to unlock AI-tailored interview tracks and role match recommendations."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Uploaded Resumes List */}
          <div className="space-y-3 lg:col-span-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-subtle px-1">
              Uploaded Resumes ({cvs.length})
            </span>
            {cvs.map((cv) => (
              <button
                key={cv.id}
                onClick={() => setActive(cv)}
                className={cn(
                  "group flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer",
                  active?.id === cv.id
                    ? "border-brand-500/50 bg-brand-500/10 shadow-sm"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-default truncate text-sm font-bold">
                    {cv.originalName}
                  </p>
                  <p className="text-subtle text-[11px] mt-0.5">
                    {formatDate(cv.createdAt)} · {prettySize(cv.sizeBytes)}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={cv.status} />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Column: Active CV Detail */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {active && (
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
              )}
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
      {/* Resume Overview Card */}
      <div className="glass-card relative overflow-hidden rounded-3xl border border-token p-6 sm:p-7">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />

        <div className="relative grid items-center gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <StatusBadge status={cv.status} />
            <h2 className="font-display text-default mt-3 text-2xl font-extrabold">
              {cv.originalName}
            </h2>
            <p className="text-muted text-xs sm:text-sm mt-1">
              Uploaded {formatDate(cv.createdAt)} · {prettySize(cv.sizeBytes)}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button
                variant="danger"
                size="sm"
                leftIcon={Trash2}
                onClick={onRemove}
              >
                Delete Resume
              </Button>
            </div>
          </div>

          {/* Readiness Circular Progress */}
          <div className="flex justify-center sm:justify-end">
            {cv.status === "PARSED" ? (
              <CircularProgress value={cv.readinessScore ?? 75} size={130}>
                <div className="flex flex-col items-center">
                  <span className="font-display text-default text-3xl font-extrabold">
                    {cv.readinessScore ?? 75}%
                  </span>
                  <span className="text-subtle text-[10px] uppercase font-bold tracking-wider">
                    Readiness
                  </span>
                </div>
              </CircularProgress>
            ) : cv.status === "PENDING" ? (
              <div className="text-muted flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin text-brand-400" />
                <span className="text-xs font-semibold">Analyzing skills…</span>
              </div>
            ) : (
              <div className="text-rose-400 flex flex-col items-center gap-2">
                <AlertCircle className="size-8" />
                <span className="text-xs font-semibold">Analysis Failed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Interview Tracks */}
      {tracks.length > 0 && (
        <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-default text-lg font-bold">
              AI-Matched Interview Tracks
            </h3>
            <Badge variant="brand" icon={Sparkles}>
              NLP Matched
            </Badge>
          </div>
          <p className="text-muted text-xs">
            Based on the skills extracted from your resume, Aria recommends practicing these tracks:
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tracks.map((t) => (
              <button
                key={t.id}
                onClick={() => onStart(t.id)}
                className="group bg-surface-2 border border-token hover:border-brand-500/50 hover:bg-surface-3 flex items-center justify-between rounded-2xl p-4 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-400 border border-brand-500/30">
                    <Mic className="size-4.5" />
                  </div>
                  <span className="text-default text-sm font-bold">{t.label}</span>
                </div>
                <ArrowRight className="size-4 text-subtle group-hover:text-brand-400 group-hover:translate-x-0.5 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Warnings & Suggestions for CV */}
      {Array.isArray(parsed.warnings) && parsed.warnings.length > 0 && (
        <div className="glass-card rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-5 text-amber-400" />
            <h3 className="font-display text-default text-base font-bold">
              Recommended CV Enhancements
            </h3>
            {typeof parsed.extractionConfidence === "number" && (
              <Badge variant="warning" size="xs">
                {Math.round(parsed.extractionConfidence * 100)}% Extraction Depth
              </Badge>
            )}
          </div>
          <p className="text-muted text-xs">
            Adding these elements makes your mock interview scenarios and job matching sharper:
          </p>
          <ul className="mt-3.5 space-y-1.5">
            {parsed.warnings.map((w, i) => (
              <li key={i} className="text-muted text-xs leading-relaxed flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Experience & Seniority Stats Strip */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <StatCardSmall
          label="Tenure / Experience"
          value={typeof parsed.yearsTotal === "number" ? `${parsed.yearsTotal} Years` : "Not Stated"}
          hint="Calculated from resume date ranges"
        />
        <StatCardSmall
          label="Seniority Classification"
          value={parsed.seniority ? titleCase(parsed.seniority) : "General"}
          hint="Derived from experience & leadership markers"
        />
        <StatCardSmall
          label="Demonstrated Tech"
          value={String((parsed.demonstratedTechnologies || []).length)}
          hint="Backed by real project roles"
        />
      </div>

      {/* Extracted Skills Buckets */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SkillBucket title="Core Skills" items={parsed.skills} accent="brand" />
        <SkillBucket title="Technologies & Frameworks" items={parsed.technologies} accent="accent" />
        <SkillBucket title="Education & Degrees" items={parsed.education} accent="emerald" />
        <SkillBucket title="Past Experience & Roles" items={parsed.experience} accent="amber" />
        <SkillBucket title="Key Projects" items={parsed.projects} accent="brand" />
        <SkillBucket title="Certifications" items={parsed.certifications} accent="rose" />
      </div>
    </>
  );
}

function StatCardSmall({ label, value, hint }) {
  return (
    <div className="glass-card rounded-2xl border border-token p-4">
      <p className="text-subtle text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className="text-default font-display mt-1 text-xl font-extrabold">{value}</p>
      <p className="text-muted mt-1 text-[11px] leading-snug">{hint}</p>
    </div>
  );
}

function SkillBucket({ title, items, accent }) {
  const tones = {
    brand: "bg-brand-500/10 text-brand-400 border-brand-500/30",
    accent: "bg-accent-500/10 text-accent-400 border-accent-500/30",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  };
  const list = Array.isArray(items) ? items : [];

  return (
    <div className="glass-card rounded-2xl border border-token p-5">
      <div className="flex items-center justify-between">
        <p className="text-default text-sm font-bold">{title}</p>
        <span className="text-subtle text-[10px] font-bold uppercase tracking-wider">
          {list.length} Identified
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-subtle mt-3 text-xs italic">No entries parsed yet.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {list.slice(0, 20).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold", tones[accent])}
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
      <Badge variant="success" icon={CheckCircle2} size="sm">
        Ready for Studio
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="danger" icon={AlertCircle} size="sm">
        Parsing Error
      </Badge>
    );
  return (
    <Badge variant="warning" icon={Clock} size="sm" pulse>
      Analyzing…
    </Badge>
  );
}

function titleCase(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function prettySize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
