import { useEffect, useRef } from "react";
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
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !report) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Handle high pixel density displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.36;

    const targetMetrics = [
      { label: "Technical", val: report.technical_score ?? 0 },
      { label: "Communication", val: report.communication_score ?? 0 },
      { label: "Confidence", val: report.confidence_score ?? 0 },
      { label: "Fluency", val: report.fluency_score ?? 0 },
      { label: "Pace", val: report.speaking_speed_score ?? 0 },
      { label: "Relevance", val: report.response_relevance_score ?? 0 }
    ];

    const numAxes = targetMetrics.length;
    let animationFrameId;
    let progress = 0; // Animation progress (0 to 1)
    const duration = 50; // Total frames (~800ms)

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Concentric Circles and Scale Labels
      const numLevels = 5;
      for (let level = 1; level <= numLevels; level++) {
        const currentRadius = radius * (level / numLevels);
        ctx.beginPath();
        for (let i = 0; i < numAxes; i++) {
          const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
          const x = center.x + currentRadius * Math.cos(angle);
          const y = center.y + currentRadius * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw value indices along the top vertical axis
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillText(`${level * 20}`, center.x + 6, center.y - currentRadius + 3);
      }

      // 2. Draw Axes and Labels
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.stroke();

        // Draw Labels
        const labelX = center.x + (radius + 20) * Math.cos(angle);
        const labelY = center.y + (radius + 14) * Math.sin(angle);

        ctx.fillStyle = "#a0aec0";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textBaseline = "middle";

        if (Math.abs(Math.cos(angle)) < 0.1) {
          ctx.textAlign = "center";
        } else if (Math.cos(angle) > 0) {
          ctx.textAlign = "left";
        } else {
          ctx.textAlign = "right";
        }
        ctx.fillText(targetMetrics[i].label, labelX, labelY);
      }

      // 3. Draw Performance Polygon Area (scaled by progress)
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const valPercent = Math.min(100, Math.max(0, targetMetrics[i].val * progress)) / 100;
        const x = center.x + radius * valPercent * Math.cos(angle);
        const y = center.y + radius * valPercent * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Fill with modern radial gradient
      const fillGrad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
      fillGrad.addColorStop(0, "rgba(79, 172, 254, 0.15)");
      fillGrad.addColorStop(1, "rgba(0, 242, 254, 0.4)");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Stroke with neon glow
      ctx.strokeStyle = "#00f2fe";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(0, 242, 254, 0.5)";
      ctx.shadowBlur = 8;
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // 4. Draw vertices dots
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const valPercent = Math.min(100, Math.max(0, targetMetrics[i].val * progress)) / 100;
        const x = center.x + radius * valPercent * Math.cos(angle);
        const y = center.y + radius * valPercent * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#4facfe";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (progress < 1) {
        progress += 1 / duration;
        if (progress > 1) progress = 1;
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [report]);

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
        <div className="header-title-section">
          <h1>Interview Performance Report</h1>
          <p className="subtitle">Detailed evaluation driven by Artificial Intelligence & Machine Learning models.</p>
        </div>
        {report.performance_level && (
          <div
            className="performance-badge"
            style={{ background: levelStyle.bg, color: levelStyle.color, border: `1px solid ${levelStyle.border}` }}
          >
            Tier: {report.performance_level}
          </div>
        )}
      </header>

      <main className="report-grid">
        {/* Upper Panel: Dashboard breakdown */}
        <div className="upper-panel">
          {/* Radar Chart section */}
          <section className="glass-card radar-card">
            <h2><Activity className="icon purple" size={20} /> Skill Radar Assessment</h2>
            <div className="radar-canvas-container">
              <canvas ref={canvasRef} style={{ width: "100%", height: "270px" }}></canvas>
            </div>
            <div className="ml-badge">
              <Activity size={14} /> Multi-dimensional scores computed by speech features & semantic metrics
            </div>
          </section>

          {/* Right Side: Score overview grid */}
          <section className="score-cards-panel">
            <div className="score-cards">
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
                <h3>Confidence Level</h3>
                <div className="score-circle confidence">
                  <span className="score-val">{report.confidence_score ?? "—"}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>
              <div className="score-card">
                <h3>Speech Fluency</h3>
                <div className="score-circle fluency">
                  <span className="score-val">{report.fluency_score ?? "—"}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>
              <div className="score-card">
                <h3>Speaking Pace</h3>
                <div className="score-circle speed">
                  <span className="score-val">{report.speaking_speed_score ?? "—"}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>
              <div className="score-card">
                <h3>Relevance Score</h3>
                <div className="score-circle relevance">
                  <span className="score-val">{report.response_relevance_score ?? "—"}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Summary Card */}
        <section className="glass-card summary-card">
          <h2><Award className="icon gold" /> Overall Evaluation & Summary</h2>
          <p>{report.summary}</p>
        </section>

        {/* Strengths & Improvements */}
        <div className="details-grid">
          <section className="glass-card strength-section">
            <h2><CheckCircle className="icon green" /> Key Strengths Identified</h2>
            <ul>
              {report.key_strengths?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>

          <section className="glass-card improvement-section">
            <h2><AlertCircle className="icon orange" /> Target Areas for Improvement</h2>
            <ul>
              {report.areas_for_improvement?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>
        </div>

        {/* Job Recommendations: Glassmorphic Action Cards */}
        <section className="glass-card jobs-card">
          <h2><Briefcase className="icon blue" /> AI Job & Career Path Recommendations</h2>
          <p className="section-desc">Based on your parsed CV skills matching your technical and communication performance:</p>
          <div className="recommendations-container">
            {report.recommendations?.map((job, i) => {
              const isObject = typeof job === 'object' && job !== null;
              const title = isObject ? job.title : job;
              const matchScore = isObject ? job.match_score : 80;
              const rationale = isObject ? job.rationale : "Recommended based on matching domain skills and performance metrics.";
              const careerPath = isObject ? job.career_path : "Junior -> Mid-Level -> Senior Developer / Lead Engineer";

              const radius = 22;
              const strokeWidth = 4;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (matchScore / 100) * circumference;

              return (
                <div key={i} className="job-rec-card fade-in">
                  <div className="job-rec-header">
                    <div className="job-rec-info">
                      <h3>{title}</h3>
                      {isObject && (
                        <div className="career-path-badge">
                          <span>Growth Path:</span> {careerPath}
                        </div>
                      )}
                    </div>
                    <div className="job-rec-score-wrapper">
                      <svg className="progress-circle" width="56" height="56">
                        <circle className="progress-circle-bg" cx="28" cy="28" r={radius} strokeWidth={strokeWidth} fill="transparent" />
                        <circle
                          className="progress-circle-bar"
                          cx="28"
                          cy="28"
                          r={radius}
                          strokeWidth={strokeWidth}
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="job-rec-score-text">{matchScore}%</span>
                    </div>
                  </div>
                  <p className="job-rec-rationale">{rationale}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Learning Resources */}
        {report.learning_resources?.length > 0 && (
          <section className="glass-card resources-card">
            <h2><BookOpen className="icon purple" /> Curated Learning Roadmaps & Resources</h2>
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
      </main>
    </div>
  );
};

export default Report;
