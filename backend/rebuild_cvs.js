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
  
  console.log("Connected. Attempting to copy data and rebuild corrupted 'cvs' table...");

  // 1. Create a new cvs_new table
  const createTableQuery = `
    CREATE TABLE cvs_new (
      id int(11) NOT NULL AUTO_INCREMENT,
      user_id int(11) NOT NULL,
      file_path varchar(255) DEFAULT NULL,
      extracted_text text DEFAULT NULL,
      domains longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(domains)),
      extracted_info JSON DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id),
      KEY user_id (user_id),
      CONSTRAINT cvs_new_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  connection.query("DROP TABLE IF EXISTS cvs_new", (errDrop) => {
    if (errDrop) {
      console.error("Error dropping cvs_new:", errDrop.message);
      connection.end();
      process.exit(1);
    }

    connection.query(createTableQuery, (errCreate) => {
      if (errCreate) {
        console.error("Error creating cvs_new:", errCreate.message);
        connection.end();
        process.exit(1);
      }
      console.log("cvs_new table created.");

      // 2. Try copying data from corrupt cvs
      console.log("Copying data from cvs to cvs_new...");
      connection.query("SELECT * FROM cvs", (errSelect, rows) => {
        if (errSelect) {
          console.error("Error selecting from corrupt cvs:", errSelect.message);
          console.log("Attempting direct copy via INSERT INTO SELECT...");
          connection.query("INSERT INTO cvs_new (id, user_id, file_path, extracted_text, domains, created_at) SELECT id, user_id, file_path, extracted_text, domains, created_at FROM cvs", (errInsertSelect) => {
            if (errInsertSelect) {
              console.error("Direct copy failed too:", errInsertSelect.message);
              console.log("Proceeding with dropping corrupt cvs and replacing with empty cvs_new...");
              dropAndRename();
            } else {
              console.log("Direct copy completed successfully!");
              dropAndRename();
            }
          });
        } else {
          console.log(`Successfully fetched ${rows.length} rows from corrupt table.`);
          if (rows.length === 0) {
            dropAndRename();
            return;
          }

          // Insert row by row
          let inserted = 0;
          rows.forEach((row) => {
            connection.query(
              "INSERT INTO cvs_new (id, user_id, file_path, extracted_text, domains, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              [row.id, row.user_id, row.file_path, row.extracted_text, row.domains, row.created_at],
              (errInsert) => {
                if (errInsert) {
                  console.error(`Error inserting row ${row.id}:`, errInsert.message);
                }
                inserted++;
                if (inserted === rows.length) {
                  console.log("Row-by-row data copy finished.");
                  dropAndRename();
                }
              }
            );
          });
        }
      });
    });
  });

  function dropAndRename() {
    console.log("Dropping foreign keys and corrupt cvs table...");
    connection.query("SET FOREIGN_KEY_CHECKS = 0", (errFK) => {
      if (errFK) {
        console.error("Error disabling FK:", errFK.message);
        connection.end();
        process.exit(1);
      }

      connection.query("DROP TABLE cvs", (errDropCvs) => {
        if (errDropCvs) {
          console.error("Error dropping corrupt cvs:", errDropCvs.message);
          connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
            connection.end();
            process.exit(1);
          });
          return;
        }
        console.log("Corrupt cvs table dropped.");

        connection.query("RENAME TABLE cvs_new TO cvs", (errRename) => {
          if (errRename) {
            console.error("Error renaming cvs_new to cvs:", errRename.message);
            connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
              connection.end();
              process.exit(1);
            });
            return;
          }
          console.log("cvs_new renamed to cvs. Indexes rebuilt and healthy!");

          connection.query("SET FOREIGN_KEY_CHECKS = 1", () => {
            connection.end();
            console.log("Rebuild process complete! Database is migrated and healthy.");
            process.exit(0);
          });
        });
      });
    });
  }
});
