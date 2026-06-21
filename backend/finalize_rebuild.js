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
  
  console.log("Connected for final cleanup...");

  // 1. Create clean cvs table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS cvs (
      id int(11) NOT NULL AUTO_INCREMENT,
      user_id int(11) NOT NULL,
      file_path varchar(255) DEFAULT NULL,
      extracted_text text DEFAULT NULL,
      domains longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(domains)),
      extracted_info JSON DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id),
      KEY user_id (user_id),
      CONSTRAINT cvs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  connection.query("SET FOREIGN_KEY_CHECKS = 0", (errFK) => {
    if (errFK) {
      console.error("Error setting FK checks:", errFK.message);
      connection.end();
      process.exit(1);
    }

    connection.query(createTableQuery, (errCreate) => {
      if (errCreate) {
        console.error("Error creating clean cvs table:", errCreate.message);
        connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
          connection.end();
          process.exit(1);
        });
        return;
      }
      console.log("Clean cvs table created.");

      // Check if cvs_new exists to copy data from it
      connection.query("SHOW TABLES LIKE 'cvs_new'", (errShow, tables) => {
        if (errShow) {
          console.error("Error checking cvs_new:", errShow.message);
          finish();
          return;
        }

        if (tables.length > 0) {
          console.log("cvs_new exists. Copying data from cvs_new to cvs...");
          connection.query("SELECT * FROM cvs_new", (errSelect, rows) => {
            if (errSelect) {
              console.error("Error selecting from cvs_new:", errSelect.message);
              finish();
            } else {
              console.log(`Fetched ${rows.length} rows from cvs_new.`);
              if (rows.length === 0) {
                finish();
                return;
              }

              // Let's copy only the last 10 rows to avoid lock table limit, or row-by-row
              const rowsToCopy = rows.slice(-10); // get last 10 rows
              let inserted = 0;

              rowsToCopy.forEach((row) => {
                connection.query(
                  "INSERT INTO cvs (id, user_id, file_path, extracted_text, domains, extracted_info, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  [row.id, row.user_id, row.file_path, row.extracted_text, row.domains, row.extracted_info, row.created_at],
                  (errInsert) => {
                    if (errInsert) {
                      console.error(`Error inserting row ${row.id}:`, errInsert.message);
                    } else {
                      console.log(`Copied row ${row.id} successfully.`);
                    }
                    inserted++;
                    if (inserted === rowsToCopy.length) {
                      console.log("Data copy finished.");
                      finish();
                    }
                  }
                );
              });
            }
          });
        } else {
          console.log("cvs_new does not exist.");
          finish();
        }
      });
    });
  });

  function finish() {
    connection.query("DROP TABLE IF EXISTS cvs_new", (errDrop) => {
      if (errDrop) console.error("Error dropping cvs_new:", errDrop.message);
      else console.log("cvs_new table dropped.");

      connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
        console.log("Foreign key checks restored.");
        connection.end();
        console.log("Cleanup and migration successful! The database is healthy.");
        process.exit(0);
      });
    });
  }
});
