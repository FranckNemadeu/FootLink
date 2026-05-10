const db = require("../db");

// CREATE MATCH
exports.createMatch = (req, res) => {
  const { team_id, type, match_date } = req.body;

  const sql =
    "INSERT INTO matches (team_id, type, match_date) VALUES (?, ?, ?)";

  db.query(sql, [team_id, type, match_date], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json({
      message: "Match créé ✅",
      matchId: result.insertId,
    });
  });
};

// ADD STATS
exports.addStats = (req, res) => {
  const {
    match_id,
    player_id,
    goals,
    assists,
    yellow_cards,
    red_cards,
  } = req.body;

  const sql = `
    INSERT INTO match_stats
    (match_id, player_id, goals, assists, yellow_cards, red_cards)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [match_id, player_id, goals, assists, yellow_cards, red_cards],
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "Stats ajoutées ✅",
      });
    }
  );
};

// GET MATCH STATS
exports.getMatchStats = (req, res) => {
  const { matchId } = req.params;

  const sql = `
    SELECT *
    FROM match_stats
    WHERE match_id = ?
  `;

  db.query(sql, [matchId], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
};

/* Ce fichier définit les fonctions du contrôleur pour gérer les matchs et les stats
Il utilise la connexion à la base de données (db) pour exécuter des requêtes SQL
Les fonctions définies sont :
createMatch → créer un match en insérant une ligne dans la table matches
addStats → ajouter des stats à un match en insérant une ligne dans la table match_stats
getMatchStats → récupérer les stats d’un match en sélectionnant les lignes de la table match_stats pour un match donné
Ces fonctions sont utilisées dans les routes définies dans routes/match.js 
pour gérer les requêtes liées aux matchs et aux stats
*/