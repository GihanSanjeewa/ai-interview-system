import { motion } from "framer-motion";
import { Upload, Settings2, Mic, FileBarChart } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: <Upload size={26} />,
    title: "Upload Your CV",
    description:
      "Upload your PDF or DOCX resume. Our AI instantly reads and analyzes your skills, experience, and suggests the most relevant interview domains.",
    color: "#4facfe",
  },
  {
    number: "02",
    icon: <Settings2 size={26} />,
    title: "Configure Your Session",
    description:
      "Select your target domain, set the difficulty level (Beginner to Advanced), and choose your preferred interview language.",
    color: "#9f7aea",
  },
  {
    number: "03",
    icon: <Mic size={26} />,
    title: "Practice with AI",
    description:
      "Engage in a real-time voice interview. The AI asks questions, listens to your spoken answers, and keeps the conversation flowing naturally.",
    color: "#48bb78",
  },
  {
    number: "04",
    icon: <FileBarChart size={26} />,
    title: "Review Your Report",
    description:
      "Get a comprehensive ML-powered performance report with scores across 6 metrics, strengths, improvements, and job recommendations.",
    color: "#ed8936",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="lp-section lp-section--alt">
    <div className="lp-section-inner">
      <motion.div
        className="lp-section-header"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
      >
        <span className="lp-section-badge">How It Works</span>
        <h2 className="lp-section-title">
          From CV to Confidence in <span className="lp-gradient-text">4 Simple Steps</span>
        </h2>
        <p className="lp-section-sub">
          Get started in minutes. No complicated setup — just upload and practice.
        </p>
      </motion.div>

      <div className="lp-steps">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.number}
            className="lp-step"
            initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <div className="lp-step-left">
              <div
                className="lp-step-icon"
                style={{ color: step.color, background: `${step.color}18` }}
              >
                {step.icon}
              </div>
              {i < STEPS.length - 1 && <div className="lp-step-connector" />}
            </div>
            <div className="lp-step-body">
              <span className="lp-step-number" style={{ color: step.color }}>
                {step.number}
              </span>
              <h3 className="lp-step-title">{step.title}</h3>
              <p className="lp-step-desc">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
