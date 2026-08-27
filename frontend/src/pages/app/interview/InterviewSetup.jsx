import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Mic,
  Sparkles,
  Upload,
  UserCheck,
  Zap,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { cvApi, tracksApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { cn, formatDate } from "@/lib/utils";

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner", desc: "Foundational questions & gentle probing", color: "text-emerald-400" },
  { id: "intermediate", label: "Intermediate", desc: "Production tradeoffs & realistic loops", color: "text-amber-400" },
  { id: "advanced", label: "Advanced", desc: "Staff/Principal system design & edge cases", color: "text-rose-400" },
];

const FALLBACK_TRACKS = [
  { id: "software_engineering", label: "Software Engineering", desc: "Algorithms, Concurrency & Clean Code" },
  { id: "web_development", label: "Web Development", desc: "React 19, TypeScript & Modern Frontend" },
  { id: "data_science", label: "Data Science", desc: "ML Models, Feature Pipelines & Python" },
  { id: "networking", label: "Networking & Cloud", desc: "AWS, Kubernetes & Microservices" },
  { id: "ui_ux", label: "UI / UX Engineering", desc: "Design Systems & Accessibility" },
  { id: "business_analysis", label: "Business Analysis", desc: "Requirements & Architecture Planning" },
];

const PERSONAS = [
  {
    id: "aria",
    name: "Aria",
    style: "Friendly & Encouraging",
    tag: "Standard Loop",
    desc: "Provides gentle pacing and structured follow-ups.",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "marcus",
    name: "Marcus",
    style: "Direct & Probing",
    tag: "Senior+",
    desc: "Challenges edge cases, architecture trade-offs, and scalability.",
    gradient: "from-brand-500 to-indigo-600",
  },
  {
    id: "kenji",
    name: "Kenji",
    style: "Methodical & Analytical",
    tag: "System Design",
    desc: "Deep focus on precision, distributed systems, and data flow.",
    gradient: "from-cyan-400 to-blue-600",
  },
];

export default function InterviewSetup({ onStart, prefill }) {
  const toast = useToast();

  const [tracks, setTracks] = useState(FALLBACK_TRACKS);
  const [cvs, setCvs] = useState([]);
  const [loadingCvs, setLoadingCvs] = useState(true);

  const [category, setCategory] = useState(tracks[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [duration, setDuration] = useState(30);
  const [persona, setPersona] = useState("aria");
  const [language, setLanguage] = useState("English");
  const [cvId, setCvId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await tracksApi.list();
        if (data?.tracks?.length) {
          setTracks(data.tracks);
          if (!category) setCategory(data.tracks[0]);
        }
      } catch {
        // Fallback already set
      }
    })();

    (async () => {
      try {
        const { items } = await cvApi.list();
        setCvs(items);
        const parsed = items.filter((c) => c.status === "PARSED");
        if (parsed.length && !cvId) setCvId(parsed[0].id);
      } catch (err) {
        toast.error("Couldn't load your CVs", err?.response?.data?.title);
      } finally {
        setLoadingCvs(false);
      }
    })();
  }, []);

  // Apply prefill
  useEffect(() => {
    if (!prefill) return;
    if (prefill.cvId) setCvId(prefill.cvId);
    if (prefill.track) {
      const match = tracks.find((t) => t.id === prefill.track);
      if (match) setCategory(match);
    }
  }, [prefill, tracks]);

  const selectedCv = useMemo(
    () => cvs.find((c) => c.id === cvId) || null,
    [cvs, cvId]
  );

  const suggestedTrackIds = useMemo(
    () =>
      (selectedCv?.suggestedTracks ?? [])
        .map((t) => (typeof t === "string" ? t : null))
        .filter(Boolean),
    [selectedCv]
  );

  const handleStart = () => {
    const roleLabel = category?.label || "Software Engineering";
    onStart({
      category: category?.id,
      categoryLabel: roleLabel,
      roleLabel: `${difficulty.label} ${roleLabel}`,
      difficulty: difficulty.label,
      duration,
      persona,
      language,
      cvId,
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Left Configuration Column */}
      <div className="space-y-6 lg:col-span-8">
        <div>
          <Badge variant="brand" icon={Sparkles} dot pulse>
            Studio Loop Setup
          </Badge>
          <h1 className="font-display text-default mt-3 text-3xl font-extrabold sm:text-4xl">
            Configure Your Mock Interview
          </h1>
          <p className="text-muted mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed">
            Choose a linked resume, technical track, and AI interviewer persona. Aria tailors
            interview loops to your actual tech stack with real-time follow-up probes.
          </p>
        </div>

        {/* 1. Linked Resume */}
        <StudioSection
          icon={FileText}
          title="1. Link a Resume / CV"
          desc="Aria parses your past projects to craft tailored follow-up scenarios."
        >
          {loadingCvs ? (
            <div className="text-muted text-xs">Loading resumes…</div>
          ) : cvs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-token p-6 text-center">
              <p className="text-default font-bold text-sm">No resumes uploaded yet</p>
              <p className="text-muted text-xs mt-1">Upload one to enable resume-tailored questions.</p>
              <Link to="/app/cv" className="inline-block mt-3">
                <Button size="sm" leftIcon={Upload}>Upload CV</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {cvs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCvId(c.id)}
                    className={cn(
                      "group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer",
                      cvId === c.id
                        ? "border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10"
                        : "border-token bg-surface hover:bg-surface-2"
                    )}
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-default truncate text-sm font-bold">
                        {c.originalName}
                      </p>
                      <p className="text-subtle text-[11px] mt-0.5">
                        {formatDate(c.createdAt)} · {c.status === "PARSED" ? "Ready" : "Analyzing"}
                      </p>
                    </div>
                    {cvId === c.id && (
                      <CheckCircle2 className="size-5 text-brand-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setCvId(null)}
                  className={cn(
                    "text-xs font-semibold text-subtle hover:text-default transition",
                    !cvId && "text-brand-400 font-bold"
                  )}
                >
                  Skip CV attachment (Standard Question Bank)
                </button>
                <Link
                  to="/app/cv"
                  className="text-brand-400 hover:text-brand-300 text-xs font-bold"
                >
                  Manage CVs →
                </Link>
              </div>
            </div>
          )}
        </StudioSection>

        {/* 2. Track Selector */}
        <StudioSection
          icon={Briefcase}
          title="2. Select Technical Track"
          desc="Pick the specific technical domain you want to practice."
        >
          {suggestedTrackIds.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-subtle text-[10px] font-bold uppercase tracking-wider">
                Recommended from your CV:
              </span>
              {suggestedTrackIds.map((id) => {
                const t = tracks.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCategory(t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer",
                      category?.id === t.id
                        ? "border-brand-500 bg-brand-500/15 text-brand-300 shadow-sm"
                        : "border-brand-500/30 bg-brand-500/5 text-brand-300 hover:bg-brand-500/15"
                    )}
                  >
                    ✨ {t.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer",
                  category?.id === c.id
                    ? "border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
                    <Briefcase className="size-4.5" />
                  </div>
                  {category?.id === c.id && (
                    <CheckCircle2 className="size-4.5 text-brand-400" />
                  )}
                </div>
                <p className="text-default font-display text-sm font-bold mt-3">{c.label}</p>
                {c.desc && <p className="text-muted text-[11px] mt-1 leading-snug">{c.desc}</p>}
              </button>
            ))}
          </div>
        </StudioSection>

        {/* 3. Difficulty & Duration */}
        <div className="grid gap-6 sm:grid-cols-2">
          <StudioSection icon={Sparkles} title="Difficulty Tier">
            <div className="space-y-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border p-3 text-left transition cursor-pointer",
                    difficulty.id === d.id
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-token bg-surface hover:bg-surface-2"
                  )}
                >
                  <div>
                    <span className={cn("text-xs font-bold", difficulty.id === d.id ? d.color : "text-default")}>
                      {d.label}
                    </span>
                    <p className="text-muted text-[11px] mt-0.5">{d.desc}</p>
                  </div>
                  {difficulty.id === d.id && (
                    <CheckCircle2 className="size-4 text-brand-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </StudioSection>

          <StudioSection icon={Clock} title="Loop Duration">
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-2xl border py-4 transition cursor-pointer",
                    duration === m
                      ? "border-brand-500 bg-brand-500/10 text-brand-400 shadow-sm font-bold"
                      : "border-token bg-surface text-muted hover:bg-surface-2"
                  )}
                >
                  <span className="font-display text-lg font-bold">{m}</span>
                  <span className="text-[10px] uppercase font-semibold text-subtle">Minutes</span>
                </button>
              ))}
            </div>
          </StudioSection>
        </div>

        {/* 4. AI Persona Selection */}
        <StudioSection icon={Bot} title="4. Choose Interviewer Persona">
          <div className="grid gap-3 sm:grid-cols-3">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id)}
                className={cn(
                  "group relative rounded-2xl border p-4 text-left transition cursor-pointer",
                  persona === p.id
                    ? "border-brand-500 bg-brand-500/10 shadow-md shadow-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-11 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white font-bold text-sm shadow-md`}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-default font-bold text-sm">{p.name}</p>
                    <p className="text-subtle text-[11px]">{p.style}</p>
                  </div>
                </div>
                <p className="text-muted text-[11px] mt-3 leading-relaxed">{p.desc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant={persona === p.id ? "brand" : "outline"} size="xs">
                    {p.tag}
                  </Badge>
                  {persona === p.id && (
                    <CheckCircle2 className="size-4 text-brand-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </StudioSection>

        {/* 5. Language Selection */}
        <StudioSection icon={Globe} title="5. Language">
          <div className="flex flex-wrap gap-2.5">
            {[
              { id: "English", label: "English (US / UK)", tag: "Default" },
              { id: "Sinhala", label: "සිංහල (Sinhala)", tag: "Native ASR" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLanguage(l.id)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition cursor-pointer",
                  language === l.id
                    ? "border-brand-500 bg-brand-500/15 text-brand-300 shadow-sm"
                    : "border-token bg-surface text-muted hover:bg-surface-2"
                )}
              >
                <span>{l.label}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] uppercase tracking-wider text-subtle">
                  {l.tag}
                </span>
              </button>
            ))}
          </div>
        </StudioSection>
      </div>

      {/* Right Sticky Preview Summary */}
      <div className="lg:col-span-4">
        <aside className="sticky top-24 space-y-4">
          <div className="glass-card rounded-3xl border border-token p-6 shadow-xl">
            <span className="text-subtle text-[10px] font-bold uppercase tracking-widest">
              Live Session Preview
            </span>
            <h3 className="font-display text-default mt-2 text-2xl font-extrabold">
              {category?.label}
            </h3>
            <p className="text-muted text-xs mt-1">
              {duration}-minute loop with{" "}
              {persona === "aria" ? "Aria" : persona === "marcus" ? "Marcus" : "Kenji"}.
            </p>

            <div className="mt-6 space-y-3 divide-y divide-token/60 border-y border-token/60 py-4 text-xs">
              <SummaryRow label="Track" value={category?.label} />
              <SummaryRow label="Difficulty" value={difficulty.label} />
              <SummaryRow label="Duration" value={`${duration} Minutes`} />
              <SummaryRow
                label="Persona"
                value={
                  persona === "aria"
                    ? "Aria (Friendly)"
                    : persona === "marcus"
                    ? "Marcus (Direct)"
                    : "Kenji (Methodical)"
                }
              />
              <SummaryRow label="Language" value={language} />
              <SummaryRow label="Linked CV" value={selectedCv ? selectedCv.originalName : "None (Generic)"} />
            </div>

            <Button
              size="lg"
              className="mt-6 w-full shadow-glow font-bold"
              rightIcon={ChevronRight}
              onClick={handleStart}
            >
              Launch Studio Room
            </Button>

            <p className="text-subtle mt-3 text-center text-[11px]">
              Microphone permission requested upon answering.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StudioSection({ icon: Icon, title, desc, children }) {
  return (
    <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
      <div className="flex items-start gap-3.5 mb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-400 border border-brand-500/30">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-default font-display text-base font-bold">{title}</h3>
          {desc && <p className="text-muted text-xs mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-muted">{label}</span>
      <span className="text-default font-bold truncate max-w-[170px] text-right">{value}</span>
    </div>
  );
}
