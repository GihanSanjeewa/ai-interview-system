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
  
  connection.query("SHOW CREATE TABLE cvs", (err, results) => {
    if (err) {
      console.error("Error executing query:", err.message);
      connection.end();
      process.exit(1);
    }
    console.log("Create table details:\n", results[0]['Create Table']);
    connection.end();
    process.exit(0);
  });
});
