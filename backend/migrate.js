const mysql = require("mysql2");
require("dotenv").config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
  console.log("Connected to MySQL database for migration.");

  const queries = [
    // 1. Alter interviews table
    `ALTER TABLE interviews 
     ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'english',
     ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate'`,

    // 2. Alter reports table
    `ALTER TABLE reports 
     ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS performance_level VARCHAR(20) DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS key_strengths TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS areas_for_improvement TEXT DEFAULT NULL,
     ADD COLUMN IF NOT EXISTS learning_resources TEXT DEFAULT NULL`,

    // 3. Alter cvs table
    `ALTER TABLE cvs 
     ADD COLUMN IF NOT EXISTS extracted_info JSON DEFAULT NULL`
  ];

  let completed = 0;
  queries.forEach((q, idx) => {
    // If IF NOT EXISTS is not supported, we can fallback to standard query
    // by catching error or executing gracefully
    connection.query(q, (err) => {
      if (err) {
        // If IF NOT EXISTS syntax failed, let's try adding columns one by one
        // or check if it's already added
        if (err.code === "ER_PARSE_ERROR" || err.message.includes("syntax")) {
          console.log(`IF NOT EXISTS syntax not supported. Running standard column additions for query ${idx + 1}...`);
          runColumnAdditionsFallback(idx);
        } else if (err.code === "ER_DUP_COLUMNNAME") {
          console.log(`Columns already exist for query ${idx + 1}.`);
          checkCompletion();
        } else {
          console.error(`Error executing query ${idx + 1}:`, err.message);
          checkCompletion();
        }
      } else {
        console.log(`Query ${idx + 1} completed successfully.`);
        checkCompletion();
      }
    });
  });

  function runColumnAdditionsFallback(queryIdx) {
    let fallbackQueries = [];
    if (queryIdx === 0) {
      fallbackQueries = [
        "ALTER TABLE interviews ADD COLUMN language VARCHAR(20) NOT NULL DEFAULT 'english'",
        "ALTER TABLE interviews ADD COLUMN difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate'"
      ];
    } else if (queryIdx === 1) {
      fallbackQueries = [
        "ALTER TABLE reports ADD COLUMN confidence_score INT DEFAULT NULL",
        "ALTER TABLE reports ADD COLUMN performance_level VARCHAR(20) DEFAULT NULL",
        "ALTER TABLE reports ADD COLUMN key_strengths TEXT DEFAULT NULL",
        "ALTER TABLE reports ADD COLUMN areas_for_improvement TEXT DEFAULT NULL",
        "ALTER TABLE reports ADD COLUMN learning_resources TEXT DEFAULT NULL"
      ];
    } else if (queryIdx === 2) {
      fallbackQueries = [
        "ALTER TABLE cvs ADD COLUMN extracted_info JSON DEFAULT NULL"
      ];
    }

    let doneFallback = 0;
    if (fallbackQueries.length === 0) {
      checkCompletion();
      return;
    }

    fallbackQueries.forEach((fq) => {
      connection.query(fq, (err) => {
        if (err && err.code !== "ER_DUP_COLUMNNAME") {
          console.error(`Fallback error executing [${fq}]:`, err.message);
        } else {
          console.log(`Fallback success or column exists: [${fq.substring(0, 40)}...]`);
        }
        doneFallback++;
        if (doneFallback === fallbackQueries.length) {
          checkCompletion();
        }
      });
    });
  }

  function checkCompletion() {
    completed++;
    if (completed === queries.length) {
      console.log("Migration complete!");
      connection.end();
      process.exit(0);
    }
  }
});
