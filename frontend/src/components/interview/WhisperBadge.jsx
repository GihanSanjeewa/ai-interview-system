import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Waves } from "lucide-react";
import { audioApi } from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * Small inline badge that reports which Whisper model is serving this session.
 * Shows the green "Fine-tuned" pill if the ML service has a fine-tuned Sinhala
 * checkpoint mounted.
 */
export default function WhisperBadge({ language = "en", live }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    audioApi
      .whisperInfo()
      .then((d) => {
        if (!cancelled) setInfo(d?.info ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer live per-request info if the parent passes it (e.g. response from /transcribe)
  const choice = live ?? (info && (language === "si" ? info.si : info.en));
  if (!choice) return null;

  const finetuned = !!choice.finetuned;
  const label =
    choice.label ||
    (typeof choice.model === "string" ? choice.model.split("/").pop() : "Whisper");

  return (
    <motion.span
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
        finetuned
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border-token bg-surface-2 text-muted"
      )}
      title={typeof choice.model === "string" ? choice.model : undefined}
    >
      {finetuned ? <Sparkles className="size-3" /> : <Waves className="size-3" />}
      <span>{finetuned ? "Fine-tuned · " : ""}{label}</span>
    </motion.span>
  );
}
