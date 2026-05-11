import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import "./Dashboard.css";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [cvId, setCvId] = useState(null);
  const [language, setLanguage] = useState("english");

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
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const startInterview = () => {
    if (!selectedDomain) return;
    // Navigate to interview page with state
    window.location.href = `/interview?cvId=${cvId}&domain=${encodeURIComponent(selectedDomain)}&language=${language}`;
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="logo">AI Interviewer</div>
        <div className="user-info">
          <span>{user?.username}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </nav>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>Welcome, {user?.username}!</h1>
          <p>Prepare for your next career move with AI-powered mock interviews.</p>
        </header>

        <section className="upload-section">
          <div className="glass-card">
            <h2>Step 1: Upload your CV</h2>
            <p>Upload your PDF resume to let our AI analyze your skills.</p>
            <form onSubmit={handleUpload} className="upload-form">
              <input type="file" onChange={handleFileChange} accept=".pdf" />
              <button type="submit" className="btn-primary" disabled={loading || !file}>
                {loading ? "Analyzing..." : "Upload & Analyze"}
              </button>
            </form>
          </div>

          {domains.length > 0 && (
            <div className="glass-card fade-in">
              <h2>Step 2: Select Interview Domain</h2>
              <p>We've detected these potential domains based on your CV:</p>
              <div className="domain-grid">
                {domains.map((domain) => (
                  <button
                    key={domain}
                    className={`domain-btn ${selectedDomain === domain ? 'active' : ''}`}
                    onClick={() => setSelectedDomain(domain)}
                  >
                    {domain}
                  </button>
                ))}
              </div>
              <div className="config-grid">
                <div className="config-group">
                  <label>Difficulty</label>
                  <select className="premium-select">
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
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
                className="btn-primary start-btn" 
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
