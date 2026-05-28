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
  const [status, setStatus] = useState("");

  const synth = window.speechSynthesis;
  const messagesEndRef = useRef(null);
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
        const msg =
          err.response?.data?.message ||
          "Failed to start interview. Check that the backend is running.";
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
      const englishVoice = voices.find(
        (v) => v.lang.includes("en-US") || v.lang.includes("en-GB")
      );
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

    try {
      const transRes = await axios.post("http://localhost:8000/transcribe", formData);
      const userText = transRes.data.text;
      const metrics = transRes.data.metrics;

      if (!userText || !userText.trim()) {
        setError("Could not hear your answer. Please try recording again.");
        setStatus("");
        setLoading(false);
        return;
      }

      if (metrics) setAudioMetrics((prev) => [...prev, metrics]);

      addMessage("user", userText);
      setStatus("Getting next question...");

      const nextRes = await axios.post(
        "http://localhost:5000/api/interviews/next",
        {
          cvId,
          domain,
          answer: userText,
          history: messagesRef.current,
          language,
          difficulty,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const nextQuestion = nextRes.data.question;
      addMessage("assistant", nextQuestion);
      speak(nextQuestion);
      setStatus("");
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Something went wrong. Please try again.";
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
          audioMetrics,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      navigate("/report", { state: { report: res.data.report } });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to generate report.";
      setError(msg);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const difficultyLabel =
    { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[difficulty] ||
    difficulty;

  return (
    <div className="interview-container">
      <div className="interview-header">
        <div className="domain-tag">
          {domain}
          <span className="difficulty-badge">{difficultyLabel}</span>
          <span className="lang-badge">{language === "sinhala" ? "සිංහල" : "English"}</span>
        </div>
        <button onClick={endSession} className="btn-exit" disabled={loading}>
          End Session
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={15} /> {error}
          <button onClick={() => setError(null)} className="error-dismiss">
            ✕
          </button>
        </div>
      )}

      <div className="messages-container">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`message-wrapper ${msg.role}`}
            >
              <div className="avatar">
                {msg.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className="message-content">{msg.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="loading-indicator">
            <Loader2 size={16} className="animate-spin" />
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
            backgroundColor="#08080e"
          />
        </div>

        <div className="action-buttons">
          {!isRecording ? (
            <button
              className="mic-btn start"
              onClick={() => {
                setError(null);
                setIsRecording(true);
              }}
              disabled={loading || isAISpeaking}
            >
              <Mic size={28} />
              <span>Click to Answer</span>
            </button>
          ) : (
            <button className="mic-btn stop" onClick={() => setIsRecording(false)}>
              <Square size={28} />
              <span>Stop Recording</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interview;
