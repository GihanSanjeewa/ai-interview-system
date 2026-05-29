import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Mic,
  Sparkles,
  Upload,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { cvApi, tracksApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { cn, formatDate } from "@/lib/utils";

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner", color: "text-emerald-400" },
  { id: "intermediate", label: "Intermediate", color: "text-amber-400" },
  { id: "advanced", label: "Advanced", color: "text-rose-400" },
];

const FALLBACK_TRACKS = [
  { id: "software_engineering", label: "Software Engineering" },
  { id: "web_development", label: "Web Development" },
  { id: "data_science", label: "Data Science" },
  { id: "networking", label: "Networking" },
  { id: "ui_ux", label: "UI/UX" },
  { id: "business_analysis", label: "Business Analysis" },
];

const TRACK_GRADIENTS = {
  software_engineering: "from-brand-500 to-violet-500",
  web_development: "from-cyan-400 to-sky-500",
  data_science: "from-purple-500 to-fuchsia-500",
  networking: "from-emerald-400 to-teal-500",
  ui_ux: "from-pink-500 to-rose-500",
  business_analysis: "from-amber-400 to-orange-500",
};

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
        // fallback already set
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply prefill from the CV page
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

  // Suggested tracks come from the selected CV's parsed result
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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <Badge variant="brand" icon={Sparkles}>
            New session
          </Badge>
          <h1 className="font-display text-default mt-3 text-3xl font-bold sm:text-4xl">
            Configure your interview
          </h1>
          <p className="text-muted mt-2 max-w-2xl">
            Pick a CV, track and persona. Aria tailors questions to your
            uploaded experience and adapts in real time.
          </p>
        </div>

        {/* CV picker (§3.1) */}
        <Section icon={FileText} title="Your CV" desc="Link a CV so Aria knows your experience.">
          {loadingCvs ? (
            <div className="text-muted text-sm">Loading your CVs…</div>
          ) : cvs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No CVs uploaded"
              description="Upload one and unlock CV-tailored questions plus job matching."
              action={
                <Link to="/app/cv">
                  <Button leftIcon={Upload}>Upload a CV</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {cvs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCvId(c.id)}
                    disabled={c.status !== "PARSED"}
                    className={cn(
                      "group bg-surface-2 border-token relative overflow-hidden rounded-2xl border p-4 text-left transition",
                      cvId === c.id && "border-brand-500/50 bg-brand-500/10",
                      c.status !== "PARSED" && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="from-brand-500/15 to-accent-500/15 grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                        <FileText className="text-brand-400 size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-default truncate text-sm font-semibold">
                          {c.originalName}
                        </p>
                        <p className="text-subtle text-[11px]">
                          {formatDate(c.createdAt)} ·{" "}
                          {c.status === "PARSED"
                            ? "Ready"
                            : c.status === "PENDING"
                            ? "Analyzing…"
                            : "Failed"}
                        </p>
                      </div>
                      {cvId === c.id && (
                        <CheckCircle2 className="text-brand-400 size-5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setCvId(null)}
                  className={cn(
                    "text-subtle hover:text-default text-xs",
                    !cvId && "text-default"
                  )}
                >
                  Skip CV for this session
                </button>
                <Link
                  to="/app/cv"
                  className="text-brand-400 hover:text-brand-300 text-xs font-semibold"
                >
                  Manage CVs →
                </Link>
              </div>
            </div>
          )}
        </Section>

        {/* Track / category (§3.1 categories) */}
        <Section icon={Briefcase} title="Interview track" desc="Choose what you're practicing.">
          {suggestedTrackIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
                Suggested for you:
              </span>
              {suggestedTrackIds.map((id) => {
                const t = tracks.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setCategory(t)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                      category?.id === t.id
                        ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
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
            {tracks.map((c) => {
              const grad = TRACK_GRADIENTS[c.id] || "from-brand-500 to-violet-500";
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-4 text-left transition",
                    category?.id === c.id
                      ? "border-brand-500/50 bg-brand-500/10"
                      : "border-token bg-surface hover:bg-surface-2"
                  )}
                >
                  <div
                    className={`absolute -right-10 -top-10 size-24 rounded-full bg-gradient-to-br ${grad} opacity-20 blur-2xl`}
                  />
                  <div className="relative flex items-center gap-3">
                    <div className={`grid size-9 place-items-center rounded-lg bg-gradient-to-br ${grad} text-white`}>
                      <Briefcase className="size-4" />
                    </div>
                    <p className="text-default text-sm font-semibold">{c.label}</p>
                    {category?.id === c.id && (
                      <CheckCircle2 className="text-brand-400 ml-auto size-4" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Difficulty + Duration */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Section icon={Sparkles} title="Difficulty">
            <div className="bg-surface border-token grid grid-cols-3 rounded-2xl border p-1">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl py-2.5 text-sm font-semibold transition",
                    difficulty.id === d.id
                      ? "bg-surface-2 text-default border border-token shadow-sm"
                      : "text-muted"
                  )}
                >
                  <span className={difficulty.id === d.id ? d.color : ""}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </Section>
          <Section icon={Clock} title="Duration">
            <div className="bg-surface border-token grid grid-cols-3 rounded-2xl border p-1">
              {[15, 30, 45].map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  className={cn(
                    "rounded-xl py-2.5 text-sm font-semibold transition",
                    duration === m
                      ? "bg-surface-2 text-default border border-token shadow-sm"
                      : "text-muted"
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Persona */}
        <Section icon={Mic} title="AI Interviewer persona">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { id: "aria", name: "Aria", style: "Friendly & supportive", tag: "Recommended", gradient: "from-pink-500 to-rose-500" },
              { id: "marcus", name: "Marcus", style: "Direct & probing", tag: "Senior+", gradient: "from-brand-500 to-violet-500" },
              { id: "kenji", name: "Kenji", style: "Calm & methodical", tag: "System Design", gradient: "from-cyan-400 to-sky-500" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 text-left transition",
                  persona === p.id
                    ? "border-brand-500/50 bg-brand-500/10"
                    : "border-token bg-surface hover:bg-surface-2"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-12 rounded-full bg-gradient-to-br ${p.gradient} grid place-items-center text-base font-bold text-white`}>
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="text-default text-sm font-semibold">{p.name}</p>
                    <p className="text-subtle text-xs">{p.style}</p>
                  </div>
                </div>
                <Badge size="sm" variant={persona === p.id ? "brand" : "outline"} className="mt-3">
                  {p.tag}
                </Badge>
              </button>
            ))}
          </div>
        </Section>

        {/* Language (§3.2 — English + Sinhala) */}
        <Section icon={Globe} title="Language">
          <div className="flex flex-wrap gap-2">
            {["English", "Sinhala"].map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  language === l
                    ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                    : "border-token bg-surface text-muted hover:text-default"
                )}
              >
                {l === "English" ? "English" : "සිංහල (Sinhala)"}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* Summary card */}
      <div className="lg:col-span-1">
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-24 space-y-4"
        >
          <div className="glass-strong rounded-3xl border p-6">
            <p className="text-subtle text-xs font-semibold uppercase tracking-widest">
              Session preview
            </p>
            <h3 className="font-display text-default mt-2 text-2xl font-bold">
              {category?.label}
            </h3>
            <p className="text-muted text-sm">
              {duration}-minute mock with{" "}
              {persona === "aria" ? "Aria" : persona === "marcus" ? "Marcus" : "Kenji"}.
            </p>

            <div className="mt-6 space-y-3">
              <Row label="Track" value={category?.label} />
              <Row label="Difficulty" value={difficulty.label} />
              <Row label="Duration" value={`${duration} min`} />
              <Row
                label="Persona"
                value={
                  persona === "aria"
                    ? "Aria · Friendly"
                    : persona === "marcus"
                    ? "Marcus · Direct"
                    : "Kenji · Methodical"
                }
              />
              <Row label="Language" value={language} />
              <Row label="CV" value={selectedCv ? selectedCv.originalName : "None"} />
            </div>

            <Button
              size="lg"
              className="mt-6 w-full"
              rightIcon={ChevronRight}
              onClick={handleStart}
            >
              Start interview
            </Button>
            <p className="text-subtle mt-3 text-center text-[11px]">
              Your mic is requested only when you press <strong>Start answer</strong>.
            </p>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }) {
  return (
    <div className="bg-surface border-token rounded-3xl border p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-10 place-items-center rounded-xl bg-gradient-to-br">
          <Icon className="size-4.5" />
        </div>
        <div>
          <h3 className="text-default font-semibold">{title}</h3>
          {desc && <p className="text-muted text-xs">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-default truncate text-right font-semibold">
        {value}
      </span>
    </div>
  );
}
