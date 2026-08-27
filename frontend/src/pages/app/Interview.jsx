import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Sparkles } from "lucide-react";
import InterviewSetup from "./interview/InterviewSetup";
import InterviewRoom from "./interview/InterviewRoom";
import { interviewApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";

export default function Interview() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState(null);
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState(null);

  // Read query params from CV page → suggested track + cv id
  useEffect(() => {
    const track = params.get("track");
    const cvId = params.get("cvId");
    if (track || cvId) {
      setPrefill({ track, cvId });
    }
  }, [params]);

  const handleStart = async (config) => {
    setCreating(true);
    try {
      const { interview } = await interviewApi.create({
        role: config.roleLabel,
        category: config.category,
        language: config.language === "Sinhala" ? "si" : "en",
        difficulty: config.difficulty.toLowerCase(),
        persona: config.persona,
        plannedSec: config.duration * 60,
        cvId: config.cvId || undefined,
      });
      setSession({ interview });
    } catch (err) {
      toast.error("Couldn't initialize interview loop", err?.response?.data?.title);
    } finally {
      setCreating(false);
    }
  };

  const handleExit = () => {
    setSession(null);
    setParams({});
  };

  if (creating) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="glass-card rounded-3xl p-8 border border-token text-center max-w-sm flex flex-col items-center shadow-2xl">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-brand-400 border border-brand-500/30 shadow-lg">
            <Loader2 className="size-8 animate-spin" />
          </div>
          <h3 className="font-display text-default text-lg font-bold mt-5">
            Preparing Studio Room
          </h3>
          <p className="text-muted text-xs mt-1.5 leading-relaxed">
            Aria is loading your target scenario question bank and configuring speech telemetry…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <InterviewSetup onStart={handleStart} prefill={prefill} />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <InterviewRoom session={session} onExit={handleExit} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
