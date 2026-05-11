import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ReactMic } from "react-mic";
import axios from "axios";
import { Mic, Square, Send, User, Bot, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Interview.css";

const Interview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cvId = searchParams.get("cvId");
  const domain = searchParams.get("domain");
  const language = searchParams.get("language") || "english";

  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interviewId, setInterviewId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const synth = window.speechSynthesis;
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Initial Question
    const startInterview = async () => {
      setLoading(true);
      try {
        const res = await axios.post("http://localhost:5000/api/interviews/start", {
          cvId,
          domain,
          language
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        
        setInterviewId(res.data.interviewId);
        const firstQuestion = res.data.question;
        addMessage("assistant", firstQuestion);
        speak(firstQuestion);
      } catch (err) {
        console.error("Failed to start interview", err);
      } finally {
        setLoading(false);
      }
    };

    startInterview();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content }]);
  };

  const speak = (text) => {
    if (synth.speaking) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to find a suitable voice
    const voices = synth.getVoices();
    if (language === "sinhala") {
      utterance.lang = "si-LK";
      // Try to find a Sinhala voice specifically
      const sinhalaVoice = voices.find(v => v.lang.includes("si") || v.lang.includes("LK"));
      if (sinhalaVoice) utterance.voice = sinhalaVoice;
    } else {
      utterance.lang = "en-US";
      const englishVoice = voices.find(v => v.lang.includes("en-US") || v.lang.includes("en-GB"));
      if (englishVoice) utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => setIsAISpeaking(false);
    synth.speak(utterance);
  };

  const onStop = async (recordedBlob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", recordedBlob.blob);

    try {
      // 1. Transcribe
      const transRes = await axios.post("http://localhost:8000/transcribe", formData);
      const userText = transRes.data.text;
      addMessage("user", userText);

      // 2. Get Next Question
      const nextRes = await axios.post("http://localhost:5000/api/interviews/next", {
        cvId,
        domain,
        answer: userText,
        history: messages,
        language
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const nextQuestion = nextRes.data.question;
      addMessage("assistant", nextQuestion);
      speak(nextQuestion);
    } catch (err) {
      console.error("Interview step failed", err);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!window.confirm("Are you sure you want to end the interview?")) return;
    
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:5000/api/interviews/complete", {
        interviewId,
        cvId,
        domain,
        history: messages,
        language
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      // Navigate to report with the evaluation data
      navigate("/report", { state: { report: res.data.report } });
    } catch (err) {
      console.error("Failed to complete interview", err);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="interview-container">
      <div className="interview-header">
        <div className="domain-tag">{domain} Interview ({language})</div>
        <button onClick={endSession} className="btn-exit" disabled={loading}>End Session</button>
      </div>

      <div className="messages-container">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`message-wrapper ${msg.role}`}
            >
              <div className="avatar">
                {msg.role === "assistant" ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className="message-content">
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="loading-indicator">
            <Loader2 className="animate-spin" /> <span>AI is thinking...</span>
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
              onClick={() => setIsRecording(true)}
              disabled={loading || isAISpeaking}
            >
              <Mic size={32} />
              <span>Click to Answer</span>
            </button>
          ) : (
            <button 
              className="mic-btn stop" 
              onClick={() => setIsRecording(false)}
            >
              <Square size={32} />
              <span>Stop Recording</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Interview;
