const mysql = require("mysql2");
require("dotenv").config();

//mysql2 → connecter Node a MariaDB/MySQL
//dotenv → lire les variables dans .env

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,

});
//createConnection() → créer une Connexion a la base de donnees MariaDB/MySQL avec les infos de .env

//Connexion a la base de donnees MariaDB/MySQL

//process.env.DB_HOST → vient de .env
//Ça évite de mettre tes infos sensibles dans le code

db.connect((err) => {
  if (err) {
    console.error("Erreur DB ❌", err);
  } else {
    console.log("MariaDB connectee");
  }
});
//Teste la connexion
module.exports = db;

//module.exports = db;

