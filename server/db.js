const mysql = require("mysql2");
require("dotenv").config();

const databaseName = process.env.DB_NAME;

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: databaseName,
  port: process.env.DB_PORT || 3306,
  connectionLimit: 10,
};

// Pool plutot qu'une connexion unique partagee : avec une seule connexion,
// deux requetes concurrentes (ex. deux suppressions de compte en meme temps)
// pouvaient s'executer sur la meme transaction MySQL et se corrompre l'une
// l'autre. Chaque requete prend maintenant sa propre connexion du pool.
let pool = mysql.createPool(connectionConfig);

const db = {
  query: (...args) => pool.query(...args),
  getConnection: (...args) => pool.getConnection(...args),
  promise: () => pool.promise(),
  end: (...args) => pool.end(...args),
};

const connectToDatabase = () => {
  pool.getConnection((err, connection) => {
    if (!err) {
      connection.release();
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

      pool = mysql.createPool(connectionConfig);
      db.query = (...args) => pool.query(...args);
      db.getConnection = (...args) => pool.getConnection(...args);
      db.promise = () => pool.promise();
      db.end = (...args) => pool.end(...args);

      pool.getConnection((retryErr, connection) => {
        if (retryErr) {
          console.error("Erreur DB", retryErr);
          return;
        }

        connection.release();
        console.log("MariaDB connectee");
      });
    });
  });
};

connectToDatabase();

module.exports = db;
