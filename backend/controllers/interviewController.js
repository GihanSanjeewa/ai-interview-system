const db = require("../config/db");
const axios = require("axios");

exports.startInterview = async (req, res) => {
  const { cvId, domain, language } = req.body;
  const userId = req.user.id;

  try {
    // 1. Get CV text
    db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ message: "CV not found" });
      
      const cvText = results[0].extracted_text;

      // 2. Call ML Service to generate first question
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/generate_question`, {
        cv_text: cvText,
        domain: domain,
        history: [],
        language: language || "english"
      });

      // 3. Create Interview record
      db.query(
        "INSERT INTO interviews (user_id, cv_id, type, status) VALUES (?, ?, ?, 'pending')",
        [userId, cvId, domain],
        (err, result) => {
          if (err) return res.status(500).json({ message: "Database error" });
          
          res.json({
            interviewId: result.insertId,
            question: mlRes.data.question
          });
        }
      );
    });
  } catch (error) {
    console.error("Interview start error:", error);
    res.status(500).json({ message: "Failed to start interview" });
  }
};

exports.getNextQuestion = async (req, res) => {
  const { cvId, domain, answer, history, language } = req.body;

  try {
    // 1. Get CV text (could be cached or passed from frontend)
    db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ message: "CV not found" });
      
      const cvText = results[0].extracted_text;

      // 2. Call ML Service for next question
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/generate_question`, {
        cv_text: cvText,
        domain: domain,
        history: [...history, { role: "user", content: answer }],
        language: language || "english"
      });

      res.json({
        question: mlRes.data.question
      });
    });
  } catch (error) {
    console.error("Next question error:", error);
    res.status(500).json({ message: "Failed to get next question" });
  }
};

exports.completeInterview = async (req, res) => {
  const { interviewId, cvId, domain, history, language } = req.body;

  try {
    // 1. Get CV text
    db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
      if (err || results.length === 0) return res.status(404).json({ message: "CV not found" });
      
      const cvText = results[0].extracted_text;

      // 2. Call ML Service for evaluation
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/evaluate_interview`, {
        cv_text: cvText,
        domain: domain,
        history: history,
        language: language || "english"
      });

      const evaluation = mlRes.data;

      // 3. Save report and update interview status
      db.query(
        "INSERT INTO reports (interview_id, summary, technical_score, communication_score, recommendations) VALUES (?, ?, ?, ?, ?)",
        [interviewId, evaluation.summary, evaluation.technical_score, evaluation.communication_score, JSON.stringify(evaluation.recommendations)],
        (err) => {
          if (err) return res.status(500).json({ message: "Database error" });

          db.query(
            "UPDATE interviews SET status = 'completed', score = ? WHERE id = ?",
            [evaluation.technical_score, interviewId],
            () => {
              res.json({ message: "Interview completed", report: evaluation });
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({ message: "Failed to evaluate interview" });
  }
};
