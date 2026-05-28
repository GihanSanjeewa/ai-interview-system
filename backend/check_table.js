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
  
  connection.query("CHECK TABLE cvs", (err, results) => {
    if (err) {
      console.error("Error executing query:", err.message);
      connection.end();
      process.exit(1);
    }
    console.log("Check table details:\n", results);
    connection.end();
    process.exit(0);
  });
});
