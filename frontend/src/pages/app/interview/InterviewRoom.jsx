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
  { id: "intro", label: "Self introduction" },
  { id: "tech", label: "Technical" },
  { id: "follow", label: "Follow-up" },
  { id: "behavior", label: "Behavioral" },
  { id: "wrap", label: "Wrap-up" },
];

// No answer has been scored yet, so there is nothing to show. The previous
// values (72/80/78/76/76/138) rendered as if the candidate had already been
// measured before saying a word.
const initialMetrics = {
  confidence: null,
  communication: null,
  relevance: null,
  technical: null,
  fluency: null,
  pace: null,
};

const TTS_LANG = { en: "en-US", si: "si-LK" };

/** Render a 0-100 metric, or an em dash when nothing has been measured yet. */
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
      text: `Hi ${user?.fullName?.split(" ")[0] || "there"}, I'm Aria. We'll keep this conversational — ready when you are.`,
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
    language: language === "si" ? "si-LK" : "en-US"
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
        toast.error("Camera blocked", "Allow camera access for the realistic experience.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Speak `text` and resolve when the voice finishes.
   *
   * Resolving on `onend` is what lets the interviewer say something and *then*
   * ask the next question, instead of the two overlapping. Resolves immediately
   * when speech synthesis is unavailable so the interview never blocks.
   */
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
        // Some browsers drop `onend` for long utterances; cap the wait so a
        // missed event cannot freeze the interview.
        const guard = setTimeout(done, Math.min(30000, 400 + text.length * 90));
        const clear = () => clearTimeout(guard);
        utter.addEventListener?.("end", clear);
        utter.addEventListener?.("error", clear);
        window.speechSynthesis.speak(utter);
      }),
    [language, speakerOn]
  );

  // TTS — speak the current question
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

  /**
   * Say the interviewer's line, then run `next` (which usually advances the
   * question). Keeps the acknowledgement and the next question in order.
   */
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

  // Speak whenever the question index changes
  useEffect(() => {
    if (!currentQuestion || step === 0) return;
    speak(currentQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Phase index
  const phaseIndex = useMemo(() => {
    // Read the phase off the current question. Deriving it from step/total was
    // wrong as soon as the interview started appending follow-up questions,
    // because the denominator changed mid-round.
    const idx = PHASES.findIndex((p) => p.id === currentQuestion?.phase);
    if (idx >= 0) return idx;
    if (!questions.length) return 0;
    return Math.min(PHASES.length - 1, Math.floor((step / questions.length) * PHASES.length));
  }, [currentQuestion, step, questions.length]);

  // Mic toggle controls live recording
  const startListening = useCallback(async () => {
    if (!micOn) return;
    setPartialAnswer("");
    await recorder.start();
  }, [micOn, recorder]);

  /**
   * Submit the answer, then let the interviewer respond before moving on.
   *
   * The backend returns what the interviewer says (`say`) plus what happens
   * next (`action`). Saying "I don't know" now produces an acknowledgement and
   * advances the interview; a shallow answer draws a follow-up; asking for a
   * repeat re-asks the same question. Acoustic metrics from transcription are
   * sent back so confidence, fluency and pace are measured, not assumed.
   */
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

        // The interviewer reacts out loud first — this is the conversational bit.
        if (turn.say) {
          setTranscript((tr) => [...tr, { who: "ai", text: turn.say }]);
        }

        // "Could you repeat that?" — same question again, nothing consumed.
        if (turn.action === "repeat") {
          await speakThen(turn.say, () => speak(currentQuestion.text));
          return;
        }

        // A follow-up probe or an easier question generated for this answer.
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
          // The plan grew server-side; append and advance.
          setQuestions((qs) => [...qs, turn.nextQuestion]);
          await speakThen(turn.say, () => setStep((i) => i + 1));
        }
      } catch (err) {
        toast.error("Couldn't submit answer", err?.response?.data?.title);
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentQuestion, interview.id, questions, step, toast]
  );

  /** Stop recording, transcribe, and take the turn. */
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
        // Acoustic metrics measured by the ML service during transcription.
        if (stt?.metrics) audio = stt.metrics;
      } catch (err) {
        console.warn("Audio transcription fell back to live text:", err);
      } finally {
        setTranscribing(false);
      }
    }

    // An empty answer is a real outcome: the interviewer should respond to
    // silence, not have the submission silently dropped.
    await submitTurn({ text, durationMs: result?.durationMs, audio });
  }, [
    currentQuestion,
    recorder,
    partialAnswer,
    language,
    submitTurn,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  /** Explicit "I don't know / skip" — the same path a spoken skip takes. */
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
      toast.success("Interview complete", "Generating your performance report…");
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
    <div className="bg-app -mx-4 lg:-mx-8 -my-6 lg:-my-8">
      <div className="relative min-h-[calc(100vh-4rem)]">
        <div className="glow-blob from-brand-500 to-accent-500 left-1/4 top-0 size-[420px] bg-gradient-to-br opacity-30" />
        <div className="glow-blob right-0 top-1/3 size-[420px] bg-gradient-to-br from-pink-500 to-violet-500 opacity-20" />

        {/* Top bar */}
        <header className="glass-strong relative z-10 flex items-center justify-between border-b px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="relative flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-rose-400">
              <CircleDot className="size-3" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Live</span>
            </span>
            <div>
              <p className="text-default text-sm font-semibold leading-tight">
                {interview.role}
              </p>
              <p className="text-subtle text-[11px]">
                {interview.difficulty} ·{" "}
                {interview.persona === "aria"
                  ? "Aria"
                  : interview.persona === "marcus"
                  ? "Marcus"
                  : "Kenji"}{" "}
                · {language === "si" ? "සිංහල" : "English"}
              </p>
            </div>
            <WhisperBadge language={language} />
          </div>

          <div className="hidden flex-1 px-8 md:block">
            <div className="flex items-center gap-3">
              {PHASES.map((p, i) => (
                <div key={p.id} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      i <= phaseIndex ? "bg-brand-400" : "bg-surface-2"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      i === phaseIndex ? "text-default" : "text-subtle"
                    )}
                  >
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-surface-2 mt-2 h-1 overflow-hidden rounded-full">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="from-brand-400 to-accent-400 h-full bg-gradient-to-r"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-surface-2 border-token text-default rounded-xl border px-3 py-1.5 font-mono text-sm">
              {formatDuration(elapsed)}
              <span className="text-subtle"> / {formatDuration(totalSec)}</span>
            </div>
            <Button
              variant="danger"
              size="sm"
              leftIcon={PhoneOff}
              onClick={() => setEndOpen(true)}
            >
              End
            </Button>
          </div>
        </header>

        {/* Main grid */}
        <main className="relative z-10 grid gap-4 px-4 py-4 lg:grid-cols-12 lg:gap-6 lg:px-8 lg:py-6">
          {/* AI tile + user webcam */}
          <div className="space-y-4 lg:col-span-8">
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

            {/* Controls dock */}
            <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
              <div className="flex items-center gap-2">
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
                  label={cameraOn ? "Camera" : "Camera off"}
                />
                <ControlBtn
                  active={speakerOn}
                  onClick={() => setSpeakerOn((v) => !v)}
                  icon={speakerOn ? Volume2 : VolumeX}
                  label="Speaker"
                />
                <span className="bg-surface-2 ml-1 h-6 w-px" />
                <ControlBtn
                  active={!paused}
                  onClick={() => setPaused((v) => !v)}
                  icon={paused ? PlayCircle : PauseCircle}
                  label={paused ? "Resume" : "Pause"}
                />
              </div>
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
                  {showTranscript ? "Hide transcript" : "Show transcript"}
                </Button>

                {!recorder.recording ? (
                  <Button
                    size="sm"
                    leftIcon={Mic}
                    onClick={startListening}
                    disabled={aiState === "speaking" || !micOn || submitting}
                  >
                    Start answer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={Square}
                    onClick={stopAndSubmit}
                    loading={submitting || transcribing}
                  >
                    {transcribing ? "Transcribing…" : "Submit answer"}
                  </Button>
                )}
                {/*
                  Routed through the same turn handler as a spoken "I don't
                  know", so the interviewer acknowledges it and the report
                  records the gap. Previously this advanced the step counter
                  client-side only, leaving the question invisible to scoring.
                */}
                <Button
                  size="sm"
                  variant="ghost"
                  rightIcon={SkipForward}
                  onClick={skipQuestion}
                  disabled={submitting || transcribing}
                  title="Tell the interviewer you don't know this one"
                >
                  I don't know
                </Button>
              </div>
            </div>

            {/* Live metrics — proposal §3.3 */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

          {/* Side panel */}
          <aside className="lg:col-span-4">
            <div className="space-y-4">
              <div className="bg-surface border-token rounded-3xl border p-5">
                <div className="flex items-center gap-2">
                  <Badge variant="brand" icon={Sparkles}>
                    Question {step + 1} / {questions.length}
                  </Badge>
                  <span className="text-subtle text-[10px] font-semibold uppercase tracking-wider">
                    {PHASES[phaseIndex].label} phase
                  </span>
                </div>
                <p className="text-default mt-3 text-lg font-semibold leading-snug">
                  {currentQuestion?.text}
                  {aiState === "speaking" && <span className="cursor-blink" />}
                </p>
                <div className="text-subtle mt-3 flex items-center gap-2 text-xs">
                  <AiStateBadge state={aiState} recording={recorder.recording} />
                </div>
                {recorder.error && (
                  <p className="text-rose-400 mt-3 text-xs">{recorder.error}</p>
                )}
              </div>

              <AnimatePresence initial={false}>
                {showTranscript && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="bg-surface border-token flex max-h-[420px] flex-col rounded-3xl border"
                  >
                    <div className="border-token flex items-center justify-between border-b px-5 py-3">
                      <div>
                        <p className="text-default text-sm font-semibold">Live transcript</p>
                        <p className="text-subtle text-[11px]">
                          {recorder.recording ? "Recording your answer…" : "Idle"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "size-7 rounded-lg grid place-items-center",
                          recorder.recording ? "bg-rose-500/15 text-rose-400" : "bg-surface-2 text-muted"
                        )}
                      >
                        <CircleDot className="size-4" />
                      </span>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-5">
                      {transcript.map((t, i) => (
                        <TranscriptItem key={i} t={t} user={user} />
                      ))}
                      {recorder.recording && partialAnswer && (
                        <div className="flex gap-3 text-xs opacity-95">
                          <Avatar size="sm" name={user?.fullName || "You"} />
                          <div className="bg-surface-2 border-token rounded-2xl rounded-tl-none border p-3.5">
                            <p className="text-default leading-relaxed flex items-center gap-2">
                              <span className="inline-block size-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {partialAnswer}
                            </p>
                          </div>
                        </div>
                      )}
                      {transcribing && (
                        <div className="text-subtle flex items-center gap-2 text-xs">
                          <Loader2 className="size-3.5 animate-spin" /> Transcribing your answer…
                        </div>
                      )}
                      {aiState === "thinking" && !transcribing && (
                        <div className="text-subtle flex items-center gap-2 text-xs">
                          <ThinkingDots /> Aria is preparing the next question…
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {showNotes && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="bg-surface border-token rounded-3xl border p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-default text-sm font-semibold">Personal notes</p>
                      <span className="text-subtle text-[11px]">Saved locally</span>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Jot down keywords, things to mention…"
                      className="bg-surface-2 border-token text-default min-h-[140px] w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </main>
      </div>

      <Modal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        title="End the interview?"
        description="You'll receive a full performance report. You can replay this session anytime."
      >
        <div className="bg-surface-2 border-token mt-2 grid grid-cols-2 gap-3 rounded-2xl border p-4">
          <Stat label="Elapsed" value={formatDuration(elapsed)} />
          <Stat label="Questions" value={`${step + 1}/${questions.length}`} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEndOpen(false)}>
            Keep going
          </Button>
          <Button variant="danger" leftIcon={PhoneOff} onClick={handleEnd}>
            End interview
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function AiVideoTile({ persona, state, speakerOn, currentText, userVideo }) {
  const personaName = persona === "aria" ? "Aria" : persona === "marcus" ? "Marcus" : "Kenji";
  const gradient =
    persona === "aria"
      ? "from-pink-500 via-brand-500 to-violet-500"
      : persona === "marcus"
      ? "from-brand-700 via-brand-500 to-accent-500"
      : "from-cyan-400 via-brand-500 to-sky-500";

  return (
    <div className={`relative aspect-[16/9] overflow-hidden rounded-3xl border border-token bg-gradient-to-br ${gradient}`}>
      <div className="absolute inset-0 opacity-30 mix-blend-overlay [background:radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent_55%)]" />

      <div className="absolute left-5 top-5 flex items-center gap-2">
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          {personaName} · AI Interviewer
        </span>
        <AnimatePresence mode="wait">
          {state === "speaking" && speakerOn && (
            <motion.span key="spk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold uppercase text-white">
              Speaking
            </motion.span>
          )}
          {state === "thinking" && (
            <motion.span key="th" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-amber-400 px-2 py-1 text-[10px] font-semibold uppercase text-white">
              Thinking
            </motion.span>
          )}
          {state === "listening" && (
            <motion.span key="lis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-full bg-cyan-400 px-2 py-1 text-[10px] font-semibold uppercase text-white">
              Listening
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="relative">
          <AnimatePresence>
            {state === "speaking" && (
              <>
                <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.6, scale: 1.4 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-white/40" />
                <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.6, scale: 1.8 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, delay: 0.4, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-white/25" />
              </>
            )}
          </AnimatePresence>
          <motion.div animate={state === "speaking" ? { y: [0, -2, 0, -3, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: state === "speaking" ? Infinity : 0 }} className="relative grid size-44 place-items-center rounded-full bg-white/15 backdrop-blur-2xl">
            <AiFace state={state} />
          </motion.div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-24 flex items-end justify-center gap-1">
        {[...Array(11)].map((_, i) => (
          <span
            key={i}
            className="wave-bar"
            style={{
              height: `${20 + (i % 4) * 8}px`,
              animationPlayState: state === "speaking" ? "running" : "paused",
              animationDelay: `${i * 0.07}s`,
              opacity: state === "speaking" ? 1 : 0.3,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-6 bottom-5">
        <div className="glass-strong rounded-2xl border border-white/15 p-3.5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
            {state === "thinking" ? "Aria is composing the next question…" : "Aria"}
          </p>
          <p className="line-clamp-2 text-sm">{currentText}</p>
        </div>
      </div>

      <div className="absolute right-5 top-5">{userVideo}</div>
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
    <div className="bg-surface-2 border-token relative size-32 overflow-hidden rounded-2xl border shadow-xl sm:size-44">
      {cameraOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
      ) : (
        <div className="bg-surface-2 grid size-full place-items-center">
          <Avatar name={user?.fullName || "You"} src={user?.avatarUrl} size="xl" />
        </div>
      )}
      <div className="absolute left-2 top-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
        You
      </div>
      <div className={cn("absolute right-2 top-2 flex size-7 items-center justify-center rounded-full", micOn ? "bg-emerald-500/80" : "bg-rose-500/80")}>
        {micOn ? <Mic className="size-3.5 text-white" /> : <MicOff className="size-3.5 text-white" />}
      </div>
      {recording && (
        <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="from-emerald-400 to-brand-400 h-full bg-gradient-to-r transition-all"
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
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition",
        danger
          ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
          : active
          ? "border-token bg-surface-2 text-default hover:bg-surface"
          : "border-token bg-surface text-muted hover:text-default"
      )}
      title={label}
    >
      <Icon className="size-4.5" />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
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
    <div className="bg-surface border-token rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <span className="text-subtle text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-default text-xs font-semibold">{value}</span>
      </div>
      <div className="bg-surface-2 mt-2 h-1.5 overflow-hidden rounded-full">
        <motion.div animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }} transition={{ duration: 0.6 }} className={`h-full bg-gradient-to-r ${tones[tone]}`} />
      </div>
    </div>
  );
}

function AiStateBadge({ state, recording }) {
  if (recording)
    return (
      <span className="flex items-center gap-1.5 text-rose-400">
        <span className="relative inline-flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-rose-400" />
        </span>
        Recording — talk now
      </span>
    );
  if (state === "speaking")
    return (
      <span className="flex items-center gap-1.5 text-emerald-400">
        <span className="relative inline-flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        Aria is speaking
      </span>
    );
  if (state === "thinking")
    return (
      <span className="flex items-center gap-1.5 text-amber-400">
        <ThinkingDots /> Thinking…
      </span>
    );
  if (state === "listening")
    return (
      <span className="flex items-center gap-1.5 text-cyan-400">
        <Mic className="size-3.5" /> Press <strong>Start answer</strong> when ready
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
        <div className="from-brand-500 to-accent-500 grid size-7 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white">
          A
        </div>
        <div className="flex-1">
          <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">Aria</p>
          <p className="text-default text-sm">{t.text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <Avatar size="sm" name={user?.fullName || "You"} src={user?.avatarUrl} />
      <div className="flex-1">
        <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">You</p>
        <p className="text-default text-sm">{t.text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-subtle text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-default font-display text-xl font-bold">{value}</p>
    </div>
  );
}
