import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, Clock, Award, Mic } from "lucide-react";
import { motion } from "framer-motion";
import "./History.css";

const LEVEL_COLORS = {
  Beginner: { bg: "rgba(72, 187, 120, 0.1)", color: "#48bb78" },
  Intermediate: { bg: "rgba(237, 137, 54, 0.1)", color: "#ed8936" },
  Advanced: { bg: "rgba(79, 172, 254, 0.1)", color: "#4facfe" },
};

const History = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/interviews/history", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setInterviews(res.data);
      } catch (err) {
        setError("Failed to load interview history.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : "—";

  return (
    <div className="history-container">
      <motion.header
        className="history-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <button onClick={() => navigate("/dashboard")} className="btn-back-hist">
          <ChevronLeft size={18} /> Back to Dashboard
        </button>
        <h1>Interview History</h1>
        <span className="history-count">{interviews.length} sessions</span>
      </motion.header>

      <main className="history-main">
        {loading && <div className="history-loading">Loading your history...</div>}
        {error && <div className="history-error">{error}</div>}

        {!loading && !error && interviews.length === 0 && (
          <motion.div
            className="history-empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Mic size={48} className="empty-icon" />
            <p>No interviews yet. Complete your first interview to see your history here.</p>
            <button className="btn-primary-hist" onClick={() => navigate("/dashboard")}>
              Start an Interview
            </button>
          </motion.div>
        )}

        {!loading && interviews.length > 0 && (
          <motion.div
            className="history-grid"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.08 }
              }
            }}
          >
            {interviews.map((item) => {
              const levelStyle = LEVEL_COLORS[item.performance_level] || LEVEL_COLORS.Intermediate;
              const isCompleted = item.status === "completed";
              return (
                <motion.div
                  key={item.id}
                  className={`history-card ${isCompleted ? "clickable-card" : "pending-card"}`}
                  onClick={() => isCompleted && navigate("/report", { state: { report: item } })}
                  variants={{
                    hidden: { opacity: 0, y: 30, scale: 0.96 },
                    show: { opacity: 1, y: 0, scale: 1 }
                  }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={isCompleted ? { y: -6, scale: 1.015, borderColor: "rgba(79, 172, 254, 0.25)" } : {}}
                  whileTap={isCompleted ? { scale: 0.985 } : {}}
                >
                  <div className="history-card-top">
                    <div className="history-domain">{item.domain}</div>
                    <div className="history-meta">
                      {item.performance_level && (
                        <span
                          className="level-chip"
                          style={{ background: levelStyle.bg, color: levelStyle.color }}
                        >
                          {item.performance_level}
                        </span>
                      )}
                      <span className={`status-chip ${item.status}`}>{capitalize(item.status)}</span>
                    </div>
                  </div>

                  <div className="history-badges">
                    <span className="lang-chip">{capitalize(item.language)}</span>
                    <span className="diff-chip">{capitalize(item.difficulty)}</span>
                  </div>

                  {isCompleted && (
                    <div className="score-row">
                      <div className="score-pill">
                        <span className="score-label">Technical</span>
                        <span className="score-num">{item.technical_score ?? "—"}</span>
                      </div>
                      <div className="score-pill">
                        <span className="score-label">Communication</span>
                        <span className="score-num">{item.communication_score ?? "—"}</span>
                      </div>
                      <div className="score-pill">
                        <span className="score-label">Confidence</span>
                        <span className="score-num">{item.confidence_score ?? "—"}</span>
                      </div>
                    </div>
                  )}

                  {item.summary && (
                    <p className="history-summary">{item.summary}</p>
                  )}

                  <div className="history-date-row">
                    <div className="history-date">
                      <Clock size={13} /> {formatDate(item.created_at)}
                    </div>
                    {isCompleted && (
                      <span className="view-report-hint">View Report →</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default History;
