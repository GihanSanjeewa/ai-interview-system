import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [cvId, setCvId] = useState(null);
  const [language, setLanguage] = useState("english");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("skills");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("cv", file);

    try {
      const res = await axios.post("http://localhost:5000/api/cvs/upload", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setDomains(res.data.domains);
      setCvId(res.data.cvId);
      setExtractedInfo(res.data.extracted_info || null);
    } catch (err) {
      alert(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startInterview = () => {
    if (!selectedDomain) return;
    navigate(`/interview?cvId=${cvId}&domain=${encodeURIComponent(selectedDomain)}&language=${language}&difficulty=${difficulty}`);
  };

  return (
    <div className="dashboard-container">
      <motion.nav
        className="dashboard-nav"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="logo">AI Interviewer</div>
        <div className="user-info">
          <button onClick={() => navigate("/history")} className="btn-history">My History</button>
          <span>{user?.username}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </motion.nav>

      <main className="dashboard-main">
        <motion.header
          className="dashboard-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>Welcome, {user?.username}!</h1>
          <p>Prepare for your next career move with AI-powered mock interviews.</p>
        </motion.header>

        <section className="upload-section">
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2>Step 1: Upload your CV</h2>
            <p>Upload your PDF or DOCX resume to let our AI analyze your skills.</p>
            <form onSubmit={handleUpload} className="upload-form">
              <input type="file" onChange={handleFileChange} accept=".pdf,.docx" />
              <motion.button
                type="submit"
                className="btn-primary"
                disabled={loading || !file}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? "Analyzing..." : "Upload & Analyze"}
              </motion.button>
            </form>
          </motion.div>

          <AnimatePresence>
            {extractedInfo && (
              <motion.div
                className="glass-card cv-profile-card"
                initial={{ opacity: 0, scale: 0.96, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 30 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2>Extracted Profile Summary</h2>
                <p className="profile-subtitle">We've parsed your resume using NLP to build your interactive profile.</p>
                
                <div className="profile-tabs">
                  {["skills", "technologies", "experience", "education", "certifications"].map((tab) => (
                    <button
                      key={tab}
                      className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="tab-content">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      transition={{ duration: 0.25 }}
                    >
                      {activeTab === "skills" && (
                        <div className="skills-container">
                          {extractedInfo.skills && extractedInfo.skills.length > 0 ? (
                            extractedInfo.skills.map((skill, i) => (
                              <motion.span
                                key={i}
                                className="badge skill-badge"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.02, duration: 0.2 }}
                                whileHover={{ scale: 1.08 }}
                              >
                                {skill}
                              </motion.span>
                            ))
                          ) : (
                            <p className="no-data">No skills extracted.</p>
                          )}
                        </div>
                      )}
                      
                      {activeTab === "technologies" && (
                        <div className="skills-container">
                          {extractedInfo.technologies && extractedInfo.technologies.length > 0 ? (
                            extractedInfo.technologies.map((tech, i) => (
                              <motion.span
                                key={i}
                                className="badge tech-badge"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.02, duration: 0.2 }}
                                whileHover={{ scale: 1.08 }}
                              >
                                {tech}
                              </motion.span>
                            ))
                          ) : (
                            <p className="no-data">No technologies extracted.</p>
                          )}
                        </div>
                      )}

                      {activeTab === "experience" && (
                        <ul className="timeline-list">
                          {extractedInfo.experience && extractedInfo.experience.length > 0 ? (
                            extractedInfo.experience.map((exp, i) => (
                              <motion.li
                                key={i}
                                className="timeline-item"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.3 }}
                              >
                                {exp}
                              </motion.li>
                            ))
                          ) : (
                            <p className="no-data">No experience extracted.</p>
                          )}
                        </ul>
                      )}

                      {activeTab === "education" && (
                        <ul className="timeline-list">
                          {extractedInfo.education && extractedInfo.education.length > 0 ? (
                            extractedInfo.education.map((edu, i) => (
                              <motion.li
                                key={i}
                                className="timeline-item edu-item"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.3 }}
                              >
                                {edu}
                              </motion.li>
                            ))
                          ) : (
                            <p className="no-data">No education details extracted.</p>
                          )}
                        </ul>
                      )}

                      {activeTab === "certifications" && (
                        <div className="certs-grid">
                          {extractedInfo.certifications && extractedInfo.certifications.length > 0 ? (
                            extractedInfo.certifications.map((cert, i) => (
                              <motion.div
                                key={i}
                                className="cert-item"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.3 }}
                                whileHover={{ scale: 1.02 }}
                              >
                                {cert}
                              </motion.div>
                            ))
                          ) : (
                            <p className="no-data">No certifications extracted.</p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {domains.length > 0 && (
              <motion.div
                className="glass-card"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2>Step 2: Configure Your Interview</h2>
                <p>We've detected these potential domains based on your CV:</p>
                <div className="domain-grid">
                  {domains.map((domain, index) => (
                    <motion.button
                      key={domain}
                      className={`domain-btn ${selectedDomain === domain ? "active" : ""}`}
                      onClick={() => setSelectedDomain(domain)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {domain}
                    </motion.button>
                  ))}
                </div>
                
                <div className="config-grid">
                  <div className="config-group">
                    <label>Difficulty</label>
                    <select
                      className="premium-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="config-group">
                    <label>Interview Language</label>
                    <select
                      className="premium-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="english">English</option>
                      <option value="sinhala">Sinhala (සිංහල)</option>
                    </select>
                  </div>
                </div>
                
                <motion.button
                  className="btn-primary start-btn"
                  onClick={startInterview}
                  disabled={!selectedDomain}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start AI Interview
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
