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
    console.error("DB Connection failed:", err.message);
    process.exit(1);
  }
  
  console.log("Connected. Disabling foreign key checks...");
  connection.query("SET FOREIGN_KEY_CHECKS = 0", (errFK) => {
    if (errFK) {
      console.error("Error setting FK checks:", errFK.message);
      connection.end();
      process.exit(1);
    }

    connection.query("SHOW COLUMNS FROM cvs LIKE 'extracted_info'", (err, results2) => {
      if (err) {
        console.error("Error checking columns:", err.message);
        connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
          connection.end();
          process.exit(1);
        });
        return;
      }
      
      if (results2.length > 0) {
        console.log("Column extracted_info already exists in cvs table.");
        connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
          connection.end();
          process.exit(0);
        });
      } else {
        console.log("Column extracted_info does not exist. Adding it...");
        connection.query("ALTER TABLE cvs ADD COLUMN extracted_info JSON DEFAULT NULL", (err2) => {
          if (err2) {
            console.error("Error adding column with FK checks disabled:", err2.message);
            connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
              connection.end();
              process.exit(1);
            });
            return;
          }
          console.log("Column extracted_info added successfully to cvs table!");
          connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
            connection.end();
            process.exit(0);
          });
        });
      }
    });
  });
});
