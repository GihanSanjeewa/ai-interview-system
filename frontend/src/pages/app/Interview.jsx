import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import InterviewSetup from "./interview/InterviewSetup";
import InterviewRoom from "./interview/InterviewRoom";

export default function Interview() {
  const [config, setConfig] = useState(null);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!config ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <InterviewSetup onStart={setConfig} />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <InterviewRoom config={config} onExit={() => setConfig(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
