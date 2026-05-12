const mysql = require("mysql2");
require("dotenv").config();

const databaseName = process.env.DB_NAME;

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: databaseName,
  port: process.env.DB_PORT || 3306,
};

let connection = mysql.createConnection(connectionConfig);

const db = {
  query: (...args) => connection.query(...args),
  beginTransaction: (...args) => connection.beginTransaction(...args),
  commit: (...args) => connection.commit(...args),
  rollback: (...args) => connection.rollback(...args),
  promise: () => connection.promise(),
  end: (...args) => connection.end(...args),
};

const connectToDatabase = () => {
  connection.connect((err) => {
    if (!err) {
      console.log("MariaDB connectee");
      return;
    }

    if (err.code !== "ER_BAD_DB_ERROR" || !databaseName) {
      console.error("Erreur DB", err);
      return;
    }

    const setupConnection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT || 3306,
    });

    setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``, (setupErr) => {
      setupConnection.end();

      if (setupErr) {
        console.error("Impossible de creer la base MariaDB", setupErr);
        return;
      }

      connection = mysql.createConnection(connectionConfig);
      connection.connect((retryErr) => {
        if (retryErr) {
          console.error("Erreur DB", retryErr);
          return;
        }

        console.log("MariaDB connectee");
      });
    });
  });
};

connectToDatabase();

module.exports = db;
