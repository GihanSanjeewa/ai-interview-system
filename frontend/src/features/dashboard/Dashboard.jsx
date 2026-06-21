import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Mic, Upload, History, LogOut } from "lucide-react";
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
    } catch (err) {
      alert(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startInterview = () => {
    if (!selectedDomain) return;
    navigate(
      `/interview?cvId=${cvId}&domain=${encodeURIComponent(selectedDomain)}&language=${language}&difficulty=${difficulty}`
    );
  };

  const initials = user?.username?.slice(0, 2).toUpperCase() || "U";

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <Mic size={18} color="white" />
          </div>
          <span className="logo">VoicePrep AI</span>
        </div>
        <div className="user-info">
          <button onClick={() => navigate("/history")} className="btn-history">
            <History size={14} style={{ marginRight: 6 }} />
            My History
          </button>
          <div className="user-avatar">{initials}</div>
          <span className="user-name">{user?.username}</span>
          <button onClick={logout} className="btn-logout">
            <LogOut size={14} style={{ marginRight: 6 }} />
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            Welcome back, <span>{user?.username}</span>
          </h1>
          <p>Prepare for your next career move with AI-powered mock interviews.</p>
        </header>

        <section className="upload-section">
          <div className="glass-card">
            <div className="card-step">Step 1</div>
            <h2>Upload Your CV</h2>
            <p>Upload your PDF or DOCX resume and our AI will analyze your skills and detect relevant domains.</p>
            <form onSubmit={handleUpload} className="upload-form">
              <label className="file-drop-zone">
                <input type="file" onChange={handleFileChange} accept=".pdf,.docx" />
                <Upload size={32} className="file-drop-icon" />
                <div className="file-drop-label">
                  {file ? (
                    <span className="file-selected">{file.name}</span>
                  ) : (
                    <>
                      <span>Click to upload</span> or drag your CV here
                    </>
                  )}
                </div>
                <div className="file-drop-label" style={{ fontSize: "0.78rem" }}>
                  PDF or DOCX accepted
                </div>
              </label>
              <button type="submit" className="btn-primary" disabled={loading || !file}>
                {loading ? "Analyzing your CV..." : "Upload & Analyze"}
              </button>
            </form>
          </div>

          {domains.length > 0 && (
            <div className="glass-card fade-in">
              <div className="card-step">Step 2</div>
              <h2>Configure Your Interview</h2>
              <p>We detected these domains from your CV. Select one and configure your session.</p>
              <div className="domain-grid">
                {domains.map((domain) => (
                  <button
                    key={domain}
                    className={`domain-btn ${selectedDomain === domain ? "active" : ""}`}
                    onClick={() => setSelectedDomain(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
              <div className="config-grid">
                <div className="config-group">
                  <label>Difficulty Level</label>
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
              <button
                className="start-btn"
                onClick={startInterview}
                disabled={!selectedDomain}
              >
                Start AI Interview
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
