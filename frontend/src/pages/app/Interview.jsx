import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import InterviewSetup from "./interview/InterviewSetup";
import InterviewRoom from "./interview/InterviewRoom";
import { interviewApi } from "@/services/api";
import { useToast } from "@/context/ToastContext";

export default function Interview() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [session, setSession] = useState(null); // { interview }
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
      toast.error("Couldn't create interview", err?.response?.data?.title);
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-brand-400 size-8 animate-spin" />
          <p className="text-muted text-sm">Setting up your interview room…</p>
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
            transition={{ duration: 0.4 }}
          >
            <InterviewRoom session={session} onExit={handleExit} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
