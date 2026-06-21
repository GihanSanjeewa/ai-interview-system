import { motion } from "framer-motion";
import { Mic, FileText, Globe, BarChart3, ClipboardList, Briefcase } from "lucide-react";

const FEATURES = [
  {
    icon: <Mic size={24} />,
    title: "AI Voice Interviews",
    description:
      "Engage in realistic conversational interviews with our AI interviewer that adapts to your responses in real time.",
    color: "#4facfe",
    glow: "rgba(79, 172, 254, 0.12)",
  },
  {
    icon: <FileText size={24} />,
    title: "Smart CV Analysis",
    description:
      "Upload your resume and our AI automatically detects your skills, experience, and suggests relevant interview domains.",
    color: "#00f2fe",
    glow: "rgba(0, 242, 254, 0.12)",
  },
  {
    icon: <Globe size={24} />,
    title: "Multi-language Support",
    description:
      "Practice in English or Sinhala (සිංහල). Perfect for Sri Lankan job seekers targeting local and international roles.",
    color: "#48bb78",
    glow: "rgba(72, 187, 120, 0.12)",
  },
  {
    icon: <BarChart3 size={24} />,
    title: "ML-Powered Metrics",
    description:
      "Get scored across 6 dimensions: Technical Accuracy, Communication, Confidence, Fluency, Speaking Speed, and Relevance.",
    color: "#9f7aea",
    glow: "rgba(159, 122, 234, 0.12)",
  },
  {
    icon: <ClipboardList size={24} />,
    title: "Detailed Performance Reports",
    description:
      "Receive comprehensive feedback with key strengths, areas to improve, and personalized learning resource recommendations.",
    color: "#ed8936",
    glow: "rgba(237, 137, 54, 0.12)",
  },
  {
    icon: <Briefcase size={24} />,
    title: "Job Recommendations",
    description:
      "Get tailored job role suggestions based on your CV analysis and interview performance to guide your career path.",
    color: "#f687b3",
    glow: "rgba(246, 135, 179, 0.12)",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

const Features = () => (
  <section id="features" className="lp-section">
    <div className="lp-section-inner">
      <motion.div
        className="lp-section-header"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
      >
        <span className="lp-section-badge">Features</span>
        <h2 className="lp-section-title">
          Everything You Need to <span className="lp-gradient-text">Interview Confidently</span>
        </h2>
        <p className="lp-section-sub">
          From CV upload to job offer — our AI platform covers every step of your interview preparation journey.
        </p>
      </motion.div>

      <div className="lp-features-grid">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="lp-feature-card"
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={cardVariants}
            style={{ "--card-glow": f.glow }}
          >
            <div className="lp-feature-icon" style={{ color: f.color, background: f.glow }}>
              {f.icon}
            </div>
            <h3 className="lp-feature-title" style={{ color: f.color }}>
              {f.title}
            </h3>
            <p className="lp-feature-desc">{f.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
