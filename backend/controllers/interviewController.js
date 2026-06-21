const db = require("../config/db");
const axios = require("axios");

// Try INSERT with new columns; fall back to original schema if columns don't exist yet.
function insertInterview(userId, cvId, domain, language, difficulty, callback) {
  db.query(
    "INSERT INTO interviews (user_id, cv_id, type, status, language, difficulty) VALUES (?, ?, ?, 'pending', ?, ?)",
    [userId, cvId, domain, language, difficulty],
    (err, result) => {
      if (err && err.code === "ER_BAD_FIELD_ERROR") {
        // Migration not run yet — fall back to base schema
        db.query(
          "INSERT INTO interviews (user_id, cv_id, type, status) VALUES (?, ?, ?, 'pending')",
          [userId, cvId, domain],
          callback
        );
      } else {
        callback(err, result);
      }
    }
  );
}

exports.startInterview = (req, res) => {
  const { cvId, domain, language, difficulty } = req.body;
  const userId = req.user.id;

  db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
    if (err) {
      console.error("DB error fetching CV:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (results.length === 0) return res.status(404).json({ message: "CV not found" });

    const cvText = results[0].extracted_text;

    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/generate_question`, {
        cv_text: cvText,
        domain,
        history: [],
        language: language || "english",
        difficulty: difficulty || "intermediate"
      });

      insertInterview(userId, cvId, domain, language || "english", difficulty || "intermediate", (err, result) => {
        if (err) {
          console.error("DB error inserting interview:", err);
          return res.status(500).json({ message: "Database error saving interview" });
        }
        res.json({ interviewId: result.insertId, question: mlRes.data.question });
      });
    } catch (error) {
      console.error("ML service error in startInterview:", error.message);
      res.status(500).json({ message: "Failed to generate first question" });
    }
  });
};

exports.getNextQuestion = (req, res) => {
  const { cvId, domain, answer, history, language, difficulty } = req.body;

  db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
    if (err) {
      console.error("DB error fetching CV:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (results.length === 0) {
      console.error("CV not found for cvId:", cvId);
      return res.status(404).json({ message: "CV not found" });
    }

    const cvText = results[0].extracted_text;

    // Ensure history is always a valid array before spreading
    const safeHistory = Array.isArray(history) ? history : [];

    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/generate_question`, {
        cv_text: cvText,
        domain,
        history: [...safeHistory, { role: "user", content: answer || "" }],
        language: language || "english",
        difficulty: difficulty || "intermediate"
      });

      res.json({ question: mlRes.data.question });
    } catch (error) {
      console.error("ML service error in getNextQuestion:", error.message);
      res.status(500).json({ message: "Failed to generate next question" });
    }
  });
};

exports.completeInterview = (req, res) => {
  const { interviewId, cvId, domain, history, language, difficulty, audioMetrics } = req.body;

  db.query("SELECT extracted_text FROM cvs WHERE id = ?", [cvId], async (err, results) => {
    if (err) {
      console.error("DB error fetching CV:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (results.length === 0) return res.status(404).json({ message: "CV not found" });

    const cvText = results[0].extracted_text;

    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/evaluate_interview`, {
        cv_text: cvText,
        domain,
        history,
        language: language || "english",
        difficulty: difficulty || "intermediate",
        audio_metrics: audioMetrics || []
      });

      const evaluation = mlRes.data;

      // Try full insert with new columns; fall back to base schema if migration not run
      db.query(
        `INSERT INTO reports
           (interview_id, summary, technical_score, communication_score, recommendations,
            confidence_score, performance_level, key_strengths, areas_for_improvement, learning_resources)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          interviewId,
          evaluation.summary,
          evaluation.technical_score,
          evaluation.communication_score,
          JSON.stringify(evaluation.recommendations),
          evaluation.confidence_score,
          evaluation.performance_level,
          JSON.stringify(evaluation.key_strengths),
          JSON.stringify(evaluation.areas_for_improvement),
          JSON.stringify(evaluation.learning_resources)
        ],
        (err) => {
          if (err && err.code === "ER_BAD_FIELD_ERROR") {
            // Migration not run — fall back to base schema
            db.query(
              "INSERT INTO reports (interview_id, summary, technical_score, communication_score, recommendations) VALUES (?, ?, ?, ?, ?)",
              [interviewId, evaluation.summary, evaluation.technical_score, evaluation.communication_score, JSON.stringify(evaluation.recommendations)],
              (err) => {
                if (err) console.error("DB error saving report (fallback):", err);
              }
            );
          } else if (err) {
            console.error("DB error saving report:", err);
          }

          db.query(
            "UPDATE interviews SET status = 'completed', score = ? WHERE id = ?",
            [evaluation.technical_score, interviewId],
            () => res.json({ message: "Interview completed", report: evaluation })
          );
        }
      );
    } catch (error) {
      console.error("ML service error in completeInterview:", error.message);
      res.status(500).json({ message: "Failed to evaluate interview" });
    }
  });
};

exports.getInterviewHistory = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT
      i.id,
      i.type        AS domain,
      i.status,
      i.score,
      i.created_at,
      COALESCE(i.language, 'english')      AS language,
      COALESCE(i.difficulty, 'intermediate') AS difficulty,
      r.summary,
      r.technical_score,
      r.communication_score,
      r.confidence_score,
      r.performance_level,
      r.recommendations,
      r.key_strengths,
      r.areas_for_improvement,
      r.learning_resources
    FROM interviews i
    LEFT JOIN reports r ON i.id = r.interview_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB error fetching history:", err);
      // If the new columns don't exist, fall back to a query that works
      if (err.code === "ER_BAD_FIELD_ERROR") {
        const fallbackQuery = `
          SELECT i.id, i.type AS domain, i.status, i.score, i.created_at,
                 'english' AS language, 'intermediate' AS difficulty,
                 r.summary, r.technical_score, r.communication_score,
                 NULL AS confidence_score, NULL AS performance_level, r.recommendations,
                 NULL AS key_strengths, NULL AS areas_for_improvement, NULL AS learning_resources
          FROM interviews i
          LEFT JOIN reports r ON i.id = r.interview_id
          WHERE i.user_id = ?
          ORDER BY i.created_at DESC
        `;
        return db.query(fallbackQuery, [userId], (err2, rows) => {
          if (err2) return res.status(500).json({ message: "Database error" });
          res.json(rows.map((row) => ({
            ...row,
            recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
            key_strengths: [],
            areas_for_improvement: [],
            learning_resources: []
          })));
        });
      }
      return res.status(500).json({ message: "Database error" });
    }

    const history = results.map((row) => ({
      ...row,
      recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
      key_strengths: row.key_strengths ? JSON.parse(row.key_strengths) : [],
      areas_for_improvement: row.areas_for_improvement ? JSON.parse(row.areas_for_improvement) : [],
      learning_resources: row.learning_resources ? JSON.parse(row.learning_resources) : []
    }));

    res.json(history);
  });
};
