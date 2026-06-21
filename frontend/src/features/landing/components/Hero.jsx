import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Play, Sparkles } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: "easeOut", delay },
  }),
};

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="lp-hero">
      <div className="lp-hero-glow lp-hero-glow--left" />
      <div className="lp-hero-glow lp-hero-glow--right" />

      <div className="lp-hero-inner">
        <motion.div
          className="lp-hero-content"
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp} custom={0} className="lp-hero-badge">
            <Sparkles size={13} />
            AI-Powered Interview Practice for Sri Lanka
          </motion.div>

          <motion.h1 variants={fadeUp} custom={0.1} className="lp-hero-title">
            Ace Your Next Interview with{" "}
            <span className="lp-gradient-text">AI Voice Practice</span>
          </motion.h1>

          <motion.p variants={fadeUp} custom={0.2} className="lp-hero-subtitle">
            Upload your CV, practice realistic voice interviews in English or Sinhala, and
            get detailed ML-powered performance feedback to land your dream job.
          </motion.p>

          <motion.div variants={fadeUp} custom={0.3} className="lp-hero-actions">
            <button className="lp-btn-cta" onClick={() => navigate("/register")}>
              Start Practicing Free
              <ArrowRight size={18} />
            </button>
            <button className="lp-btn-demo" onClick={() => navigate("/login")}>
              <Play size={15} />
              Sign In
            </button>
          </motion.div>

          <motion.div variants={fadeUp} custom={0.4} className="lp-hero-proof">
            <div className="lp-proof-avatars">
              {["S", "A", "R", "K"].map((l, i) => (
                <div key={i} className="lp-proof-avatar" style={{ zIndex: 4 - i }}>
                  {l}
                </div>
              ))}
            </div>
            <span>Join hundreds of job seekers improving their interview skills</span>
          </motion.div>
        </motion.div>

        <motion.div
          className="lp-hero-visual"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <div className="lp-mock-card">
            <div className="lp-mock-header">
              <div className="lp-mock-dot lp-dot-red" />
              <div className="lp-mock-dot lp-dot-yellow" />
              <div className="lp-mock-dot lp-dot-green" />
              <span className="lp-mock-title">Live Interview Session</span>
            </div>

            <div className="lp-mock-domain">
              <span className="lp-mock-tag">Software Engineering</span>
              <span className="lp-mock-tag lp-mock-tag--diff">Intermediate</span>
              <span className="lp-mock-tag lp-mock-tag--lang">English</span>
            </div>

            <div className="lp-mock-msg lp-mock-msg--ai">
              <div className="lp-mock-avatar lp-mock-avatar--ai">
                <Mic size={14} />
              </div>
              <div className="lp-mock-bubble">
                Can you explain the difference between REST and GraphQL APIs?
              </div>
            </div>

            <div className="lp-mock-msg lp-mock-msg--user">
              <div className="lp-mock-bubble lp-mock-bubble--user">
                REST uses fixed endpoints while GraphQL allows flexible queries...
              </div>
              <div className="lp-mock-avatar lp-mock-avatar--user">U</div>
            </div>

            <div className="lp-mock-wave-box">
              <div className="lp-wave-bars">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="lp-wave-bar"
                    style={{ animationDelay: `${i * 0.07}s` }}
                  />
                ))}
              </div>
              <span className="lp-wave-label">Recording your answer...</span>
            </div>

            <div className="lp-mock-scores">
              {[
                { label: "Technical", val: 87, color: "#4facfe" },
                { label: "Communication", val: 92, color: "#00f2fe" },
                { label: "Confidence", val: 78, color: "#9f7aea" },
              ].map(({ label, val, color }) => (
                <div key={label} className="lp-mock-score">
                  <span className="lp-mock-score-label">{label}</span>
                  <div className="lp-mock-score-bar">
                    <div
                      className="lp-mock-score-fill"
                      style={{ width: `${val}%`, background: color }}
                    />
                  </div>
                  <span className="lp-mock-score-val" style={{ color }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
