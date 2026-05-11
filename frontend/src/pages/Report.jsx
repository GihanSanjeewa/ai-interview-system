import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, Award, Briefcase, ChevronLeft } from "lucide-react";
import "./Report.css";

const Report = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const report = location.state?.report;

  if (!report) {
    return <div className="report-error">No report data found. <button onClick={() => navigate("/dashboard")}>Go Home</button></div>;
  }

  return (
    <div className="report-container">
      <header className="report-header">
        <button onClick={() => navigate("/dashboard")} className="btn-back">
          <ChevronLeft /> Back to Dashboard
        </button>
        <h1>Interview Performance Report</h1>
      </header>

      <main className="report-grid">
        <section className="score-cards">
          <div className="score-card">
            <h3>Technical Score</h3>
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
        </section>

        <section className="glass-card summary-card">
          <h2><Award className="icon" /> Overall Summary</h2>
          <p>{report.summary}</p>
        </section>

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
