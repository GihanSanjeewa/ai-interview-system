import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, Award, Briefcase, ChevronLeft, BookOpen, Activity } from "lucide-react";
import "./Report.css";

const LEVEL_COLORS = {
  Beginner: { bg: "rgba(72, 187, 120, 0.1)", color: "#48bb78", border: "rgba(72, 187, 120, 0.3)" },
  Intermediate: { bg: "rgba(237, 137, 54, 0.1)", color: "#ed8936", border: "rgba(237, 137, 54, 0.3)" },
  Advanced: { bg: "rgba(79, 172, 254, 0.1)", color: "#4facfe", border: "rgba(79, 172, 254, 0.3)" },
};

const Report = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const report = location.state?.report;

  if (!report) {
    return (
      <div className="report-error">
        No report data found.{" "}
        <button onClick={() => navigate("/dashboard")}>Go Home</button>
      </div>
    );
  }

  const levelStyle = LEVEL_COLORS[report.performance_level] || LEVEL_COLORS.Intermediate;

  return (
    <div className="report-container">
      <header className="report-header">
        <button onClick={() => navigate("/dashboard")} className="btn-back">
          <ChevronLeft /> Back to Dashboard
        </button>
        <h1>Interview Performance Report</h1>
        {report.performance_level && (
          <div
            className="performance-badge"
            style={{ background: levelStyle.bg, color: levelStyle.color, border: `1px solid ${levelStyle.border}` }}
          >
            {report.performance_level}
          </div>
        )}
      </header>

      <main className="report-grid">
        {/* ML Score Cards — all 6 metrics */}
        <section className="score-cards">
          <div className="score-card">
            <h3>Technical Accuracy</h3>
            <div className="score-circle">
              <span className="score-val">{report.technical_score}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
          <div className="score-card">
            <h3>Communication</h3>
            <div className="score-circle highlight">
              <span className="score-val">{report.communication_score}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
          <div className="score-card">
            <h3>Confidence</h3>
            <div className="score-circle confidence">
              <span className="score-val">{report.confidence_score ?? "—"}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
          <div className="score-card">
            <h3>Fluency</h3>
            <div className="score-circle fluency">
              <span className="score-val">{report.fluency_score ?? "—"}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
          <div className="score-card">
            <h3>Speaking Speed</h3>
            <div className="score-circle speed">
              <span className="score-val">{report.speaking_speed_score ?? "—"}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
          <div className="score-card">
            <h3>Relevance</h3>
            <div className="score-circle relevance">
              <span className="score-val">{report.response_relevance_score ?? "—"}</span>
              <span className="score-max">/100</span>
            </div>
          </div>
        </section>

        {/* ML Badge */}
        <div className="ml-badge">
          <Activity size={14} /> Scores computed by ML: librosa audio analysis + spaCy NLP + TF-IDF similarity
        </div>

        {/* Summary */}
        <section className="glass-card summary-card">
          <h2><Award className="icon" /> Overall Summary</h2>
          <p>{report.summary}</p>
        </section>

        {/* Strengths & Improvements */}
        <div className="details-grid">
          <section className="glass-card">
            <h2><CheckCircle className="icon green" /> Key Strengths</h2>
            <ul>
              {report.key_strengths?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>

          <section className="glass-card">
            <h2><AlertCircle className="icon orange" /> Areas for Improvement</h2>
            <ul>
              {report.areas_for_improvement?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>
        </div>

        {/* Learning Resources */}
        {report.learning_resources?.length > 0 && (
          <section className="glass-card">
            <h2><BookOpen className="icon purple" /> Recommended Learning Resources</h2>
            <div className="resources-grid">
              {report.learning_resources.map((res, i) => (
                <div key={i} className="resource-card">
                  <div className="resource-type">{res.type}</div>
                  <div className="resource-title">{res.title}</div>
                  <div className="resource-desc">{res.description}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Job Recommendations */}
        <section className="glass-card jobs-card">
          <h2><Briefcase className="icon blue" /> Job Recommendations</h2>
          <div className="job-tags">
            {report.recommendations?.map((job, i) => (
              <span key={i} className="job-tag">{job}</span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Report;
