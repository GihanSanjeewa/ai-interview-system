import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  CircleDot,
  FileText,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  PauseCircle,
  PhoneOff,
  PlayCircle,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { audioApi, interviewApi } from "@/services/api";
import WhisperBadge from "@/components/interview/WhisperBadge";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { formatDuration, cn } from "@/lib/utils";

const PHASES = [
  { id: "greet", label: "Greeting" },
  { id: "intro", label: "Self Introduction" },
  { id: "tech", label: "Technical Core" },
  { id: "follow", label: "Deep-Dive Follow-Up" },
  { id: "behavior", label: "Behavioral / STAR" },
  { id: "wrap", label: "Wrap-Up & Close" },
];

const initialMetrics = {
  confidence: null,
  communication: null,
  relevance: null,
  technical: null,
  fluency: null,
  pace: null,
};

const TTS_LANG = { en: "en-US", si: "si-LK" };

function pct(value) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export default function InterviewRoom({ session, onExit }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const { interview } = session;
  const language = interview.language || "en";

  const [questions, setQuestions] = useState(interview.questions || []);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [aiState, setAiState] = useState("idle"); // idle | thinking | speaking | listening
  const [transcript, setTranscript] = useState([
    {
      who: "ai",
      text: `Hi ${user?.fullName?.split(" ")[0] || "there"}, I'm Aria. Welcome to your practice loop — whenever you're ready, let's dive in.`,
    },
  ]);
  const [partialAnswer, setPartialAnswer] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [endOpen, setEndOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [metrics, setMetrics] = useState(initialMetrics);
  const startedRef = useRef(false);

  const recorder = useVoiceRecorder({
    onLevel: setAudioLevel,
    onTranscript: (liveText) => setPartialAnswer(liveText),
    language: language === "si" ? "si-LK" : "en-US",
  });

  const currentQuestion = questions[step];

  // Webcam stream
  useEffect(() => {
    if (!cameraOn) {
      const tracks = videoRef.current?.srcObject?.getTracks?.();
      tracks?.forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast.error("Camera Blocked", "Please enable camera access for the full studio experience.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [cameraOn]);

  // Timer
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  // Start interview backend-side once on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { interview: started } = await interviewApi.start(interview.id);
        if (started?.questions?.length) setQuestions(started.questions);
        speak(started?.questions?.[0]?.text || currentQuestion?.text || "");
      } catch (err) {
        toast.error("Couldn't start interview", err?.response?.data?.title);
      }
    })();
  }, []);

  const speakAsync = useCallback(
    (text, { cancelPrevious = true } = {}) =>
      new Promise((resolve) => {
        if (!text || typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }
        setAiState("speaking");
        if (cancelPrevious) window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = TTS_LANG[language] || "en-US";
        utter.rate = 0.96;
        utter.pitch = 1.0;
        utter.volume = speakerOn ? 1 : 0;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        utter.onend = done;
        utter.onerror = done;
        const guard = setTimeout(done, Math.min(30000, 400 + text.length * 90));
        const clear = () => clearTimeout(guard);
        utter.addEventListener?.("end", clear);
        utter.addEventListener?.("error", clear);
        window.speechSynthesis.speak(utter);
      }),
    [language, speakerOn]
  );

  const speak = useCallback(
    (text) => {
      if (!text) {
        setAiState("listening");
        return;
      }
      void speakAsync(text).then(() => setAiState("listening"));
    },
    [speakAsync]
  );

  const speakThen = useCallback(
    async (line, next) => {
      setAiState("thinking");
      if (line) await speakAsync(line);
      if (next) {
        next();
      } else {
        setAiState("listening");
      }
    },
    [speakAsync]
  );

  useEffect(() => {
    if (!currentQuestion || step === 0) return;
    speak(currentQuestion.text);
  }, [step]);

  const phaseIndex = useMemo(() => {
    const idx = PHASES.findIndex((p) => p.id === currentQuestion?.phase);
    if (idx >= 0) return idx;
    if (!questions.length) return 0;
    return Math.min(PHASES.length - 1, Math.floor((step / questions.length) * PHASES.length));
  }, [currentQuestion, step, questions.length]);

  const startListening = useCallback(async () => {
    if (!micOn) return;
    setPartialAnswer("");
    await recorder.start();
  }, [micOn, recorder]);

  const submitTurn = useCallback(
    async ({ text, durationMs, audio }) => {
      if (!currentQuestion) return;
      setSubmitting(true);
      try {
        setTranscript((tr) => [...tr, { who: "user", text: text || "(no answer)" }]);

        const turn = await interviewApi.submitAnswer(interview.id, {
          questionId: currentQuestion.id,
          transcript: text,
          durationMs,
          audio: audio || undefined,
        });

        if (turn.answer?.metrics) {
          const m = turn.answer.metrics;
          setMetrics((prev) => ({
            confidence: m.confidence ?? prev.confidence,
            communication: m.communication ?? prev.communication,
            relevance: m.relevance ?? prev.relevance,
            technical: m.technical ?? prev.technical,
            fluency: m.fluency ?? prev.fluency,
            pace: m.pace ?? prev.pace,
          }));
        }
        setPartialAnswer("");

        if (turn.say) {
          setTranscript((tr) => [...tr, { who: "ai", text: turn.say }]);
        }

        if (turn.action === "repeat") {
          await speakThen(turn.say, () => speak(currentQuestion.text));
          return;
        }

        if (turn.newQuestion) {
          setQuestions((qs) => {
            const next = [...qs];
            next.splice(step + 1, 0, turn.newQuestion);
            return next;
          });
          await speakThen(turn.say, () => setStep((i) => i + 1));
          return;
        }

        if (!turn.nextQuestion) {
          await speakThen(turn.say, null);
          await finishInterview();
          return;
        }

        const nextIdx = questions.findIndex((q) => q.id === turn.nextQuestion.id);
        if (nextIdx >= 0) {
          await speakThen(turn.say, () => setStep(nextIdx));
        } else {
          setQuestions((qs) => [...qs, turn.nextQuestion]);
          await speakThen(turn.say, () => setStep((i) => i + 1));
        }
      } catch (err) {
        toast.error("Couldn't submit answer", err?.response?.data?.title);
      } finally {
        setSubmitting(false);
      }
    },
    [currentQuestion, interview.id, questions, step, toast]
  );

  const stopAndSubmit = useCallback(async () => {
    if (!currentQuestion) return;
    let result;
    try {
      result = await recorder.stop();
    } catch {
      result = null;
    }
    let text = (result?.transcript || partialAnswer || "").trim();
    let audio = null;

    if (result?.blob && result.blob.size > 1024) {
      setTranscribing(true);
      try {
        const stt = await audioApi.transcribe(result.blob, language);
        if (stt?.text?.trim()) text = stt.text.trim();
        if (stt?.metrics) audio = stt.metrics;
      } catch (err) {
        console.warn("Audio transcription fallback:", err);
      } finally {
        setTranscribing(false);
      }
    }

    await submitTurn({ text, durationMs: result?.durationMs, audio });
  }, [currentQuestion, recorder, partialAnswer, language, submitTurn]);

  const skipQuestion = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      /* not recording */
    }
    await submitTurn({ text: "I don't know.", durationMs: 0, audio: null });
  }, [recorder, submitTurn]);

  const finishInterview = useCallback(async () => {
    try {
      await interviewApi.end(interview.id);
      toast.success("Interview Finished", "Generating performance report…");
      navigate(`/app/reports/${interview.id}`);
    } catch (err) {
      toast.error("Couldn't end interview", err?.response?.data?.title);
    }
  }, [interview.id, navigate, toast]);

  const handleEnd = async () => {
    setEndOpen(false);
    await finishInterview();
  };

  const totalSec = interview.plannedSec || 1800;
  const progress = Math.min(100, (elapsed / totalSec) * 100);

  return (
    <div className="bg-app -mx-4 sm:-mx-6 lg:-mx-8 -my-6 lg:-my-8">
      <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between">
        {/* Background glow lighting */}
        <div className="glow-blob from-brand-500/20 to-accent-500/20 left-1/4 top-0 size-[450px] bg-gradient-to-br" />
        <div className="glow-blob right-0 top-1/3 size-[450px] bg-gradient-to-br from-pink-500/15 to-purple-600/15" />

        {/* Top Studio Bar */}
        <header className="glass-strong relative z-20 flex flex-wrap items-center justify-between border-b border-token px-4 py-3 sm:px-6 lg:px-8 gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-rose-400 shadow-sm">
              <CircleDot className="size-3 animate-pulse" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Live Studio</span>
            </span>
            <div>
              <p className="text-default text-sm font-bold leading-tight">
                {interview.role}
              </p>
              <p className="text-subtle text-[11px] capitalize">
                {interview.difficulty} ·{" "}
                {interview.persona === "aria"
                  ? "Aria (Friendly)"
                  : interview.persona === "marcus"
                  ? "Marcus (Direct)"
                  : "Kenji (Methodical)"}{" "}
                · {language === "si" ? "සිංහල" : "English"}
              </p>
            </div>
            <WhisperBadge language={language} />
          </div>

          {/* Phase Breadcrumbs (Desktop) */}
          <div className="hidden flex-1 px-8 lg:block">
            <div className="flex items-center justify-between gap-2">
              {PHASES.map((p, i) => (
                <div key={p.id} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      i <= phaseIndex ? "bg-brand-400" : "bg-surface-3"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-semibold truncate",
                      i === phaseIndex ? "text-default font-bold" : "text-subtle"
                    )}
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full border border-token">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="from-brand-500 via-brand-400 to-accent-400 h-full bg-gradient-to-r"
              />
            </div>
          </div>

          {/* Timer & Exit */}
          <div className="flex items-center gap-2.5">
            <div className="bg-surface-2 border border-token text-default rounded-xl px-3 py-1.5 font-mono text-xs font-bold">
              {formatDuration(elapsed)}
              <span className="text-subtle font-normal"> / {formatDuration(totalSec)}</span>
            </div>
            <Button
              variant="danger"
              size="sm"
              leftIcon={PhoneOff}
              onClick={() => setEndOpen(true)}
            >
              End Session
            </Button>
          </div>
        </header>

        {/* Main Studio Viewport */}
        <main className="relative z-10 grid gap-4 p-4 sm:p-6 lg:grid-cols-12 lg:gap-6 lg:p-8 flex-1">
          {/* Left Column: AI Tile + Live Controls + Telemetry */}
          <div className="space-y-4 lg:col-span-8 flex flex-col justify-between">
            {/* AI Video Feed Simulation */}
            <AiVideoTile
              persona={interview.persona}
              state={aiState}
              speakerOn={speakerOn}
              currentText={currentQuestion?.text}
              userVideo={
                <UserSelfView
                  videoRef={videoRef}
                  cameraOn={cameraOn}
                  micOn={micOn}
                  user={user}
                  level={audioLevel}
                  recording={recorder.recording}
                />
              }
            />

            {/* Floating Control Dock */}
            <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-token p-3 shadow-lg">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ControlBtn
                  active={micOn}
                  onClick={() => setMicOn((v) => !v)}
                  icon={micOn ? Mic : MicOff}
                  danger={!micOn}
                  label={micOn ? "Mute" : "Unmute"}
                />
                <ControlBtn
                  active={cameraOn}
                  onClick={() => setCameraOn((v) => !v)}
                  icon={cameraOn ? Camera : CameraOff}
                  danger={!cameraOn}
                  label={cameraOn ? "Camera" : "Camera Off"}
                />
                <ControlBtn
                  active={speakerOn}
                  onClick={() => setSpeakerOn((v) => !v)}
                  icon={speakerOn ? Volume2 : VolumeX}
                  label="Audio"
                />
                <span className="bg-token/80 mx-1 h-6 w-px" />
                <ControlBtn
                  active={!paused}
                  onClick={() => setPaused((v) => !v)}
                  icon={paused ? PlayCircle : PauseCircle}
                  label={paused ? "Resume" : "Pause"}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={FileText}
                  onClick={() => setShowNotes((v) => !v)}
                >
                  Notes
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Maximize2}
                  onClick={() => setShowTranscript((v) => !v)}
                >
                  {showTranscript ? "Hide Transcript" : "Show Transcript"}
                </Button>

                {!recorder.recording ? (
                  <Button
                    size="sm"
                    leftIcon={Mic}
                    onClick={startListening}
                    disabled={aiState === "speaking" || !micOn || submitting}
                    className="shadow-glow"
                  >
                    Start Answer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={Square}
                    onClick={stopAndSubmit}
                    loading={submitting || transcribing}
                  >
                    {transcribing ? "Transcribing…" : "Submit Answer"}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  rightIcon={SkipForward}
                  onClick={skipQuestion}
                  disabled={submitting || transcribing}
                  title="Tell the interviewer you don't know"
                >
                  I don't know
                </Button>
              </div>
            </div>

            {/* Live Telemetry Metric Strip */}
            <div className="grid gap-2.5 grid-cols-3 lg:grid-cols-6">
              <MetricChip label="Confidence" value={pct(metrics.confidence)} progress={metrics.confidence ?? 0} tone="brand" />
              <MetricChip label="Communication" value={pct(metrics.communication)} progress={metrics.communication ?? 0} tone="accent" />
              <MetricChip label="Relevance" value={pct(metrics.relevance)} progress={metrics.relevance ?? 0} tone="emerald" />
              <MetricChip label="Technical" value={pct(metrics.technical)} progress={metrics.technical ?? 0} tone="amber" />
              <MetricChip label="Fluency" value={pct(metrics.fluency)} progress={metrics.fluency ?? 0} tone="rose" />
              <MetricChip
                label="Pace"
                value={metrics.pace == null ? "—" : `${Math.round(metrics.pace)} wpm`}
                progress={metrics.pace == null ? 0 : Math.max(0, Math.min(100, (metrics.pace - 60) / 1.2))}
                tone="brand"
              />
            </div>
          </div>

          {/* Right Column: Question Info, Live Transcript & Notes */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="glass-card rounded-3xl border border-token p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <Badge variant="brand" icon={Sparkles} size="xs">
                  Question {step + 1} of {questions.length}
                </Badge>
                <span className="text-subtle text-[10px] font-bold uppercase tracking-wider">
                  {PHASES[phaseIndex].label}
                </span>
              </div>
              <p className="text-default font-display mt-3.5 text-base sm:text-lg font-bold leading-snug">
                {currentQuestion?.text}
                {aiState === "speaking" && <span className="cursor-blink" />}
              </p>
              <div className="mt-4 pt-3 border-t border-token/60 flex items-center gap-2 text-xs">
                <AiStateBadge state={aiState} recording={recorder.recording} />
              </div>
              {recorder.error && (
                <p className="text-rose-400 mt-2 text-xs font-semibold">{recorder.error}</p>
              )}
            </div>

            {/* Live Transcript Box */}
            <AnimatePresence initial={false}>
              {showTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="glass-card flex max-h-[380px] flex-col rounded-3xl border border-token"
                >
                  <div className="border-b border-token flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-default text-xs font-bold uppercase tracking-wider">Live Transcript</p>
                      <p className="text-subtle text-[11px]">
                        {recorder.recording ? "Listening to your answer…" : "Ready"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "size-7 rounded-xl grid place-items-center",
                        recorder.recording ? "bg-rose-500/15 text-rose-400" : "bg-surface-2 text-muted"
                      )}
                    >
                      <CircleDot className="size-4" />
                    </span>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
                    {transcript.map((t, i) => (
                      <TranscriptItem key={i} t={t} user={user} />
                    ))}
                    {recorder.recording && partialAnswer && (
                      <div className="flex gap-2.5 opacity-95">
                        <Avatar size="sm" name={user?.fullName || "You"} />
                        <div className="bg-surface-2 border border-token rounded-2xl rounded-tl-none p-3">
                          <p className="text-default leading-relaxed flex items-center gap-2">
                            <span className="inline-block size-2 rounded-full bg-rose-500 animate-pulse" />
                            {partialAnswer}
                          </p>
                        </div>
                      </div>
                    )}
                    {transcribing && (
                      <div className="text-subtle flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin text-brand-400" /> Acoustic transcription in progress…
                      </div>
                    )}
                    {aiState === "thinking" && !transcribing && (
                      <div className="text-subtle flex items-center gap-2">
                        <ThinkingDots /> Aria is evaluating your answer…
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notes Box */}
            <AnimatePresence initial={false}>
              {showNotes && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="glass-card rounded-3xl border border-token p-5"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-default text-xs font-bold uppercase tracking-wider">Candidate Scratchpad</p>
                    <span className="text-subtle text-[10px]">Private</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Jot down bullet points, STAR outline, metrics…"
                    className="bg-surface-2 border border-token text-default min-h-[120px] w-full resize-none rounded-xl p-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </main>
      </div>

      {/* End Session Confirmation Modal */}
      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="Conclude Interview Loop?"
        description="Your answers will be compiled and scored by our ML engine to produce your 6-metric report."
      >
        <div className="bg-surface-2 border border-token mt-3 grid grid-cols-2 gap-3 rounded-2xl p-4">
          <Stat label="Total Time" value={formatDuration(elapsed)} />
          <Stat label="Completed" value={`${step + 1} / ${questions.length}`} />
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setEndOpen(false)}>
            Continue Practicing
          </Button>
          <Button variant="danger" leftIcon={PhoneOff} onClick={handleEnd}>
            Generate Report
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function AiVideoTile({ persona, state, speakerOn, currentText, userVideo }) {
  const personaName = persona === "aria" ? "Aria" : persona === "marcus" ? "Marcus" : "Kenji";
  const gradient =
    persona === "aria"
      ? "from-pink-600/30 via-brand-600/30 to-violet-600/20"
      : persona === "marcus"
      ? "from-brand-700/30 via-indigo-600/30 to-accent-600/20"
      : "from-cyan-500/30 via-brand-600/30 to-sky-600/20";

  return (
    <div className={`relative aspect-[16/9] overflow-hidden rounded-3xl border border-token bg-[#0c0d18] bg-gradient-to-br ${gradient} shadow-2xl flex items-center justify-center`}>
      <div className="absolute inset-0 opacity-25 mix-blend-overlay [background:radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_55%)]" />

      {/* Top Left Persona Badge */}
      <div className="absolute left-5 top-5 flex items-center gap-2 z-10">
        <span className="rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
          {personaName} · Lead AI Interviewer
        </span>
        <AnimatePresence mode="wait">
          {state === "speaking" && speakerOn && (
            <motion.span key="spk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white shadow">
              Speaking
            </motion.span>
          )}
          {state === "thinking" && (
            <motion.span key="th" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase text-black shadow">
              Evaluating…
            </motion.span>
          )}
          {state === "listening" && (
            <motion.span key="lis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-accent-400 px-2.5 py-0.5 text-[10px] font-bold uppercase text-black shadow">
              Listening
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Pulsing Avatar in Center */}
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {state === "speaking" && (
            <>
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.6, scale: 1.4 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-brand-400/40" />
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.6, scale: 1.8 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, delay: 0.4, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-accent-400/30" />
            </>
          )}
        </AnimatePresence>
        <motion.div animate={state === "speaking" ? { y: [0, -3, 0, -2, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: state === "speaking" ? Infinity : 0 }} className="relative grid size-44 place-items-center rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl">
          <AiFace state={state} />
        </motion.div>
      </div>

      {/* Waveform Bars */}
      <div className="absolute inset-x-0 bottom-24 flex items-end justify-center gap-1 z-10">
        {[...Array(13)].map((_, i) => (
          <span
            key={i}
            className="wave-bar"
            style={{
              height: `${16 + (i % 4) * 8}px`,
              animationPlayState: state === "speaking" ? "running" : "paused",
              animationDelay: `${i * 0.06}s`,
              opacity: state === "speaking" ? 1 : 0.25,
            }}
          />
        ))}
      </div>

      {/* Captions Pill */}
      <div className="absolute inset-x-6 bottom-5 z-10">
        <div className="glass-strong rounded-2xl border border-white/20 p-3.5 text-white shadow-xl backdrop-blur-xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
            {state === "thinking" ? `${personaName} is evaluating your answer…` : personaName}
          </p>
          <p className="line-clamp-2 text-xs sm:text-sm font-medium mt-0.5">{currentText}</p>
        </div>
      </div>

      {/* User PiP Webcam Feed */}
      <div className="absolute right-5 top-5 z-20">{userVideo}</div>
    </div>
  );
}

function AiFace({ state }) {
  return (
    <svg viewBox="0 0 120 120" className="size-28 text-white">
      <circle cx="60" cy="55" r="34" fill="rgba(255,255,255,0.18)" />
      <motion.ellipse cx="48" cy="52" rx="3" ry={state === "thinking" ? 1.2 : 3} fill="currentColor" animate={{ ry: [3, 0.4, 3] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.4 }} />
      <motion.ellipse cx="72" cy="52" rx="3" ry={state === "thinking" ? 1.2 : 3} fill="currentColor" animate={{ ry: [3, 0.4, 3] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 0.4 }} />
      {state === "speaking" ? (
        <motion.ellipse cx="60" cy="70" rx="9" ry="3.4" fill="currentColor" animate={{ ry: [3, 6, 2, 5, 3] }} transition={{ duration: 0.6, repeat: Infinity }} />
      ) : (
        <path d="M50 70 q10 6 20 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

function UserSelfView({ videoRef, cameraOn, micOn, user, level, recording }) {
  return (
    <div className="bg-surface-2 border border-token relative size-32 sm:size-40 overflow-hidden rounded-2xl shadow-2xl">
      {cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
      ) : (
        <div className="bg-surface-2 grid size-full place-items-center">
          <Avatar name={user?.fullName || "You"} src={user?.avatarUrl} size="lg" />
        </div>
      )}
      <div className="absolute left-2 top-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold uppercase text-white">
        You
      </div>
      <div className={cn("absolute right-2 top-2 flex size-6 items-center justify-center rounded-full shadow", micOn ? "bg-emerald-500" : "bg-rose-500")}>
        {micOn ? <Mic className="size-3 text-white" /> : <MicOff className="size-3 text-white" />}
      </div>
      {recording && (
        <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/50">
          <div
            className="from-emerald-400 to-brand-400 h-full bg-gradient-to-r transition-all duration-100"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ControlBtn({ icon: Icon, label, onClick, active, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl border px-3 py-1.5 transition cursor-pointer select-none",
        danger
          ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
          : active
          ? "border-token bg-surface-2 text-default hover:bg-surface-3"
          : "border-token bg-surface text-muted hover:text-default"
      )}
      title={label}
    >
      <Icon className="size-4" />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function MetricChip({ label, value, progress, tone }) {
  const tones = {
    brand: "from-brand-400 to-brand-600",
    accent: "from-accent-400 to-accent-600",
    emerald: "from-emerald-400 to-emerald-600",
    rose: "from-rose-400 to-rose-600",
    amber: "from-amber-400 to-amber-600",
  };
  return (
    <div className="glass-card rounded-2xl border border-token p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-subtle text-[9px] font-bold uppercase tracking-wider">{label}</span>
        <span className="text-default text-xs font-bold">{value}</span>
      </div>
      <div className="bg-surface-2 mt-1.5 h-1.5 overflow-hidden rounded-full border border-token">
        <motion.div
          animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          transition={{ duration: 0.6 }}
          className={`h-full bg-gradient-to-r ${tones[tone]}`}
        />
      </div>
    </div>
  );
}

function AiStateBadge({ state, recording }) {
  if (recording)
    return (
      <span className="flex items-center gap-1.5 text-rose-400 font-bold">
        <span className="relative inline-flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-rose-400" />
        </span>
        Recording Answer…
      </span>
    );
  if (state === "speaking")
    return (
      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
        <span className="relative inline-flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        Aria is speaking
      </span>
    );
  if (state === "thinking")
    return (
      <span className="flex items-center gap-1.5 text-amber-400 font-bold">
        <ThinkingDots /> Evaluating response…
      </span>
    );
  if (state === "listening")
    return (
      <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
        <Mic className="size-3.5" /> Click <strong>Start Answer</strong> when ready
      </span>
    );
  return null;
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
          className="size-1.5 rounded-full bg-current"
        />
      ))}
    </span>
  );
}

function TranscriptItem({ t, user }) {
  if (t.who === "ai") {
    return (
      <div className="flex items-start gap-2.5">
        <div className="from-brand-500 to-accent-500 grid size-6 place-items-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shrink-0">
          A
        </div>
        <div className="flex-1">
          <p className="text-brand-400 text-[10px] font-bold uppercase tracking-wider">Aria (Interviewer)</p>
          <p className="text-default text-xs mt-0.5 leading-relaxed">{t.text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <Avatar size="xs" name={user?.fullName || "You"} src={user?.avatarUrl} />
      <div className="flex-1">
        <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">You (Candidate)</p>
        <p className="text-default text-xs mt-0.5 leading-relaxed">{t.text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-subtle text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className="text-default font-display text-lg font-extrabold mt-0.5">{value}</p>
    </div>
  );
}
