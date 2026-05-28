const db = require("../config/db");
const path = require("path");

const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

exports.uploadCV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please upload a file" });
  }

  const userId = req.user.id;
  const filePath = req.file.path;

  try {
    // Send to ML service
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL}/parse_cv`, formData, {
      headers: formData.getHeaders(),
    });

    const { text, extracted_info, domains } = mlResponse.data;

    // Save to database
    db.query(
      "INSERT INTO cvs (user_id, file_path, extracted_text, domains, extracted_info) VALUES (?, ?, ?, ?, ?)",
      [userId, filePath, text, JSON.stringify(domains), JSON.stringify(extracted_info)],
      (err, result) => {
        if (err) {
          console.error("DB error saving CV details:", err);
          return res.status(500).json({ message: "Database error" });
        }
        
        res.status(201).json({
          message: "CV uploaded and analyzed successfully",
          cvId: result.insertId,
          domains: domains,
          extracted_info: extracted_info
        });
      }
    );
  } catch (error) {
    console.error("ML Service error:", error);
    res.status(500).json({ message: "Error analyzing CV" });
  }
};

exports.getUserCVs = (req, res) => {
  const userId = req.user.id;

  db.query("SELECT * FROM cvs WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
};
