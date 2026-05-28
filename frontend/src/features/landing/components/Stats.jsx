import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

const STATS = [
  { value: "6", label: "AI Metrics Analysed", sub: "per interview session" },
  { value: "2", label: "Languages Supported", sub: "English & Sinhala" },
  { value: "Real-time", label: "Voice Analysis", sub: "powered by ML pipeline" },
  { value: "100%", label: "Personalised", sub: "CV-based questions" },
];

const Stats = () => {
  const navigate = useNavigate();

  return (
    <section id="stats" className="lp-section">
      <div className="lp-section-inner">
        <motion.div
          className="lp-section-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <span className="lp-section-badge">Why VoicePrep AI</span>
          <h2 className="lp-section-title">
            Built for Serious <span className="lp-gradient-text">Job Seekers</span>
          </h2>
          <p className="lp-section-sub">
            Unlike generic mock interview tools, VoicePrep AI is purpose-built for
            voice-first, CV-personalized interview preparation.
          </p>
        </motion.div>

        <div className="lp-stats-grid">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="lp-stat-card"
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <div className="lp-stat-value">{s.value}</div>
              <div className="lp-stat-label">{s.label}</div>
              <div className="lp-stat-sub">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="lp-cta-banner"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.3 }}
        >
          <div className="lp-cta-banner-glow" />
          <div className="lp-cta-banner-content">
            <Zap size={28} color="#4facfe" />
            <div>
              <h3>Ready to start practicing?</h3>
              <p>Create your free account and complete your first AI interview in minutes.</p>
            </div>
            <button className="lp-btn-cta" onClick={() => navigate("/register")}>
              Get Started Free <ArrowRight size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Stats;
