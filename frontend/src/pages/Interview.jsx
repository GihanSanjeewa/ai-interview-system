import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ReactMic } from "react-mic";
import axios from "axios";
import { Mic, Square, User, Bot, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Interview.css";

const Interview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cvId = searchParams.get("cvId");
  const domain = searchParams.get("domain");
  const language = searchParams.get("language") || "english";
  const difficulty = searchParams.get("difficulty") || "intermediate";

  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interviewId, setInterviewId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [audioMetrics, setAudioMetrics] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(""); // short status line shown above the mic

  const synth = window.speechSynthesis;
  const messagesEndRef = useRef(null);
  // Keep a ref to messages for use inside stale closures (e.g. ReactMic's onStop)
  const messagesRef = useRef([]);

  const addMessage = (role, content) => {
    setMessages((prev) => {
      const next = [...prev, { role, content }];
      messagesRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const startInterview = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.post(
          "http://localhost:5000/api/interviews/start",
          { cvId, domain, language, difficulty },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        setInterviewId(res.data.interviewId);
        const firstQuestion = res.data.question;
        addMessage("assistant", firstQuestion);
        speak(firstQuestion);
      } catch (err) {
        const msg = err.response?.data?.message || "Failed to start interview. Check that the backend is running.";
        console.error("Start interview error:", err);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    startInterview();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text) => {
    if (synth.speaking) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();

    if (language === "sinhala") {
      utterance.lang = "si-LK";
      const sinhalaVoice = voices.find((v) => v.lang.includes("si") || v.lang.includes("LK"));
      if (sinhalaVoice) utterance.voice = sinhalaVoice;
    } else {
      utterance.lang = "en-US";
      const englishVoice = voices.find((v) => v.lang.includes("en-US") || v.lang.includes("en-GB"));
      if (englishVoice) utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => setIsAISpeaking(false);
    synth.speak(utterance);
  };

  const onStop = async (recordedBlob) => {
    setLoading(true);
    setError(null);
    setStatus("Transcribing your answer...");
    const formData = new FormData();
    formData.append("audio", recordedBlob.blob);
    formData.append("language", language);

    try {
      // 1. Transcribe
      const transRes = await axios.post("http://localhost:8000/transcribe", formData);
      const userText = transRes.data.text;
      const metrics = transRes.data.metrics;

      if (!userText || !userText.trim()) {
        setError("Could not hear your answer. Please try recording again.");
        setStatus("");
        setLoading(false);
        return;
      }

      if (metrics) {
        setAudioMetrics((prev) => [...prev, metrics]);
      }

      addMessage("user", userText);
      setStatus("Getting next question...");

      // 2. Get next question — use the ref to get the latest messages
      const nextRes = await axios.post(
        "http://localhost:5000/api/interviews/next",
        {
          cvId,
          domain,
          answer: userText,
          history: messagesRef.current,
          language,
          difficulty
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const nextQuestion = nextRes.data.question;
      addMessage("assistant", nextQuestion);
      speak(nextQuestion);
      setStatus("");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Something went wrong. Please try again.";
      console.error("Interview step failed:", err);
      setError(msg);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!window.confirm("Are you sure you want to end the interview?")) return;

    setLoading(true);
    setError(null);
    setStatus("Generating your report...");
    try {
      const res = await axios.post(
        "http://localhost:5000/api/interviews/complete",
        {
          interviewId,
          cvId,
          domain,
          history: messagesRef.current,
          language,
          difficulty,
          audioMetrics
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      navigate("/report", { state: { report: res.data.report } });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate report.";
      console.error("Complete interview error:", err);
      setError(msg);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const difficultyLabel = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[difficulty] || difficulty;

  const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === "assistant");
  const actualLastAssistantIdx = lastAssistantIdx !== -1 ? messages.length - 1 - lastAssistantIdx : -1;

  const [code, setCode] = useState("// Write your solution here...\ndef solve():\n    pass");
  const [codeLang, setCodeLang] = useState("python");
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeEvalResult, setCodeEvalResult] = useState(null);

  const evaluateCodeSubmit = async () => {
    setLoading(true);
    setStatus("Evaluating your code submission...");
    try {
      const res = await axios.post("http://localhost:8000/evaluate_code", {
        code,
        language: codeLang,
        problem: messagesRef.current[messagesRef.current.length - 1]?.content || ""
      });
      setCodeEvalResult(res.data);
      addMessage("user", `[Submitted Code Solution (${codeLang.toUpperCase()} - Score: ${res.data.score}/100)]\n\`\`\`${codeLang}\n${code}\n\`\`\``);
      setStatus("");
    } catch (err) {
      console.error("Code evaluation error:", err);
      setError("Failed to evaluate code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="interview-container">
      <div className="interview-header">
        <div className="domain-tag">
          {domain}
          <span className="difficulty-badge">{difficultyLabel}</span>
          <span className="lang-badge">{language === "sinhala" ? "සිංහල" : "English"}</span>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => setShowCodeEditor(!showCodeEditor)} 
            className="btn-code-toggle"
          >
            {showCodeEditor ? "Hide Code Playground" : "💻 Code Playground"}
          </button>
          <button onClick={endSession} className="btn-exit" disabled={loading}>
            End Session
          </button>
        </div>
      </div>

      {showCodeEditor && (
        <div className="code-playground-drawer">
          <div className="code-playground-header">
            <h4>Live Coding Evaluation</h4>
            <select 
              value={codeLang} 
              onChange={(e) => setCodeLang(e.target.value)}
              className="lang-select"
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="php">PHP</option>
            </select>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="code-textarea"
            rows={8}
            placeholder="Write your code solution here..."
          />
          <div className="code-playground-actions">
            <button onClick={evaluateCodeSubmit} className="btn-eval-code" disabled={loading}>
              Run Code Evaluation
            </button>
            {codeEvalResult && (
              <div className="eval-result-badge">
                Score: {codeEvalResult.score}/100 | Correctness: {codeEvalResult.correctness}% | Complexity: {codeEvalResult.complexity}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} className="error-dismiss">✕</button>
        </div>
      )}

      <div className="messages-container">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`message-wrapper ${msg.role}`}
            >
              <div className={`avatar ${msg.role === "assistant" && idx === actualLastAssistantIdx && isAISpeaking ? "speaking" : ""}`}>
                {msg.role === "assistant" ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-content">{msg.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="loading-indicator">
            <Loader2 className="animate-spin" />
            <span>{status || "AI is thinking..."}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="controls-footer">
        <div className="visualizer-box">
          <ReactMic
            record={isRecording}
            className="sound-wave"
            onStop={onStop}
            strokeColor="#4facfe"
            backgroundColor="#0a0a0f"
          />
        </div>

        <div className="action-buttons">
          {!isRecording ? (
            <button
              className="mic-btn start"
              onClick={() => { setError(null); setIsRecording(true); }}
              disabled={loading || isAISpeaking}
            >
              <div className="mic-icon-wrapper">
                <Mic size={32} />
              </div>
              <span>Click to Answer</span>
            </button>
          ) : (
            <div className="ripple-wrapper">
              <div className="ripple-circle"></div>
              <div className="ripple-circle"></div>
              <div className="ripple-circle"></div>
              <button className="mic-btn stop" onClick={() => setIsRecording(false)}>
                <div className="mic-icon-wrapper active">
                  <Square size={32} />
                </div>
                <span>Stop Recording</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interview;
