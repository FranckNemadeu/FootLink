const db = require("../db");

const ensureProfilePhotoColumn = (callback) => {
  const checkSql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'players'
      AND COLUMN_NAME = 'profile_photo'
  `;

  db.query(checkSql, (checkErr, result) => {
    if (checkErr) return callback(checkErr);

    if (result.length > 0) {
      return callback(null);
    }

    db.query(
      "ALTER TABLE players ADD COLUMN profile_photo VARCHAR(255)",
      callback
    );
  });
};

const sendDbError = (res, err, fallbackMessage) => {
  console.log(err);

  res.status(500).json({
    message: fallbackMessage,
    error: err.sqlMessage || err.message,
    code: err.code,
  });
};

const ensureTeamInvitationsTable = (callback) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS team_invitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      player_id INT NOT NULL,
      requested_by VARCHAR(20) DEFAULT 'team',
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, (err) => {
    if (err) return callback(err);

    const checkSql = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'team_invitations'
        AND COLUMN_NAME = 'requested_by'
    `;

    db.query(checkSql, (checkErr, result) => {
      if (checkErr) return callback(checkErr);
      if (result.length > 0) return callback(null);

      db.query(
        "ALTER TABLE team_invitations ADD COLUMN requested_by VARCHAR(20) DEFAULT 'team'",
        callback
      );
    });
  });
};

const ensureTeamPlayerCountColumn = (callback) => {
  const checkSql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'teams'
      AND COLUMN_NAME = 'player_count'
  `;

  db.query(checkSql, (checkErr, result) => {
    if (checkErr) return callback(checkErr);
    if (result.length > 0) return callback(null);

    db.query(
      "ALTER TABLE teams ADD COLUMN player_count INT DEFAULT 0",
      callback
    );
  });
};

const refreshTeamPlayerCounts = (callback) => {
  ensureTeamPlayerCountColumn((columnErr) => {
    if (columnErr) return callback(columnErr);

    const sql = `
      UPDATE teams t
      SET player_count = (
        SELECT COUNT(*)
        FROM players p
        WHERE LOWER(p.team_name) = LOWER(t.team_name)
      )
    `;

    db.query(sql, callback);
  });
};

const getPlayerForUser = (userId, callback) => {
  const sql = "SELECT * FROM players WHERE user_id = ? LIMIT 1";

  db.query(sql, [userId], (err, result) => {
    if (err) return callback(err);

    callback(null, result[0]);
  });
};

const buildPublicPlayerSelect = () => `
  SELECT
    p.id,
    p.position,
    p.age,
    p.city,
    p.height,
    p.preferred_foot,
    p.bio,
    p.team_name,
    p.profile_photo,
    u.name,
    COALESCE(s.matches, 0) AS matches,
    COALESCE(s.goals, 0) AS goals,
    COALESCE(s.assists, 0) AS assists,
    COALESCE(s.yellow_cards, 0) + COALESCE(s.red_cards, 0) AS cards
  FROM players p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN (
    SELECT
      player_id,
      COUNT(match_id) AS matches,
      COALESCE(SUM(goals), 0) AS goals,
      COALESCE(SUM(assists), 0) AS assists,
      COALESCE(SUM(yellow_cards), 0) AS yellow_cards,
      COALESCE(SUM(red_cards), 0) AS red_cards
    FROM match_stats
    GROUP BY player_id
  ) s ON s.player_id = p.id
`;

exports.getPublicPlayers = (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 8, 20);
  const sql = `
    ${buildPublicPlayerSelect()}
    ORDER BY goals DESC, assists DESC, u.name
    LIMIT ?
  `;

  ensureProfilePhotoColumn((columnErr) => {
    if (columnErr) {
      if (columnErr.code === "ER_NO_SUCH_TABLE") {
        return res.json([]);
      }

      return sendDbError(res, columnErr, "Impossible de preparer les joueurs");
    }

    db.query(sql, [limit], (err, players) => {
      if (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          return res.json([]);
        }

        return sendDbError(res, err, "Impossible de charger les joueurs");
      }

      res.json(players);
    });
  });
};

exports.getPublicPlayer = (req, res) => {
  const sql = `
    ${buildPublicPlayerSelect()}
    WHERE p.id = ?
    LIMIT 1
  `;

  ensureProfilePhotoColumn((columnErr) => {
    if (columnErr) {
      return sendDbError(res, columnErr, "Impossible de preparer le joueur");
    }

    db.query(sql, [req.params.playerId], (err, result) => {
      if (err) {
        return sendDbError(res, err, "Impossible de charger le joueur");
      }

      if (result.length === 0) {
        return res.status(404).json({ message: "Joueur introuvable" });
      }

      res.json(result[0]);
    });
  });
};

// CREATE PLAYER
exports.createPlayer = (req, res) => {
  const {
    position,
    age,
    city,
    height,
    preferred_foot,
    bio
  } = req.body;

  const userId = req.user.id;

  const sql = `
    INSERT INTO players
    (user_id, position, age, city, height, preferred_foot, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [userId, position, age, city, height, preferred_foot, bio],
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "Profil joueur créé ✅"
      });
    }
  );
};

// GET PLAYER
exports.getPlayer = (req, res) => {
  const userId = req.user.id;

  const sql = "SELECT * FROM players WHERE user_id = ?";

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.json({ message: "Aucun profil trouvé" });
    }

    res.json(result[0]);
  });
};

// GET PLAYER STATS
exports.getPlayerStats = (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT
      p.id AS player_id,
      COUNT(ms.match_id) AS matches,
      COALESCE(SUM(ms.goals), 0) AS goals,
      COALESCE(SUM(ms.assists), 0) AS assists,
      COALESCE(SUM(ms.yellow_cards), 0) AS yellow_cards,
      COALESCE(SUM(ms.red_cards), 0) AS red_cards,
      COALESCE(SUM(ms.yellow_cards), 0) + COALESCE(SUM(ms.red_cards), 0) AS cards
    FROM players p
    LEFT JOIN match_stats ms ON ms.player_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.json({
        message: "Profil joueur introuvable",
        matches: 0,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        cards: 0,
      });
    }

    res.json(result[0]);
  });
};

// UPLOAD PLAYER PHOTO
exports.uploadPlayerPhoto = (req, res) => {
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ message: "Aucune photo envoyee" });
  }

  const photoUrl = `/uploads/${req.file.filename}`;

  ensureProfilePhotoColumn((columnErr) => {
    if (columnErr) return res.status(500).json(columnErr);

    const sql = "UPDATE players SET profile_photo = ? WHERE user_id = ?";

    db.query(sql, [photoUrl, userId], (err, result) => {
      if (err) return res.status(500).json(err);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Profil joueur introuvable",
        });
      }

      res.json({
        message: "Photo de profil mise a jour",
        profile_photo: photoUrl,
      });
    });
  });
};

// UPDATE PLAYER
exports.updatePlayer = (req, res) => {
  const { position, age, city, height, preferred_foot, bio } = req.body;
  const userId = req.user.id;

  const sql = `
    UPDATE players 
    SET position = ?, age = ?, city = ?, height = ?, preferred_foot = ?, bio = ?
    WHERE user_id = ?
  `;

  db.query(
    sql,
    [position, age, city, height || null, preferred_foot || null, bio || null, userId],
    (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Profil joueur introuvable" });
    }

    res.json({ message: "Profil mis a jour" });
    }
  );
};

exports.leaveTeam = (req, res) => {
  const userId = req.user.id;

  const sql = `
    UPDATE players
    SET team_name = NULL, no_team = 1
    WHERE user_id = ?
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return sendDbError(res, err, "Impossible de quitter le club");

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Profil joueur introuvable" });
    }

    refreshTeamPlayerCounts((countErr) => {
      if (countErr) {
        return sendDbError(
          res,
          countErr,
          "Impossible de mettre a jour le compteur du club"
        );
      }

      res.json({ message: "Tu as quitte ton club" });
    });
  });
};

// SEARCH PLAYERS
exports.searchPlayers = (req, res) => {
  const { position, city, maxAge } = req.query;

  let sql = `
    SELECT p.*, u.name, u.email
    FROM players p
    JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  const values = [];

  if (position) {
    sql += " AND p.position = ?";
    values.push(position);
  }

  if (city) {
    sql += " AND p.city = ?";
    values.push(city);
  }

  if (maxAge) {
    sql += " AND p.age <= ?";
    values.push(maxAge);
  }

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
};

exports.changePlayerTeam = (req, res) => {
  const { team_name } = req.body;
  const userId = req.user.id;

  if (!team_name) {
    return res.status(400).json({ message: "Le club selectionne est requis" });
  }

  const checkTeamSql = `SELECT id, team_name FROM teams WHERE LOWER(team_name) = LOWER(?) LIMIT 1`;
  db.query(checkTeamSql, [team_name], (teamErr, teamResult) => {
    if (teamErr) return res.status(500).json(teamErr);

    if (teamResult.length === 0) {
      return res.status(400).json({ message: "Club introuvable ou non enregistre" });
    }

    const team = teamResult[0];

    getPlayerForUser(userId, (playerErr, player) => {
      if (playerErr) {
        return sendDbError(res, playerErr, "Impossible de charger le joueur");
      }

      if (!player) {
        return res.status(404).json({ message: "Profil joueur introuvable" });
      }

      if (
        player.team_name &&
        player.team_name.toLowerCase() === team.team_name.toLowerCase()
      ) {
        return res.status(400).json({ message: "Tu es deja dans ce club" });
      }

      ensureTeamInvitationsTable((tableErr) => {
        if (tableErr) {
          return sendDbError(res, tableErr, "Impossible de preparer les demandes");
        }

        const existingSql = `
          SELECT id
          FROM team_invitations
          WHERE team_id = ? AND player_id = ? AND status = 'pending'
          LIMIT 1
        `;

        db.query(existingSql, [team.id, player.id], (existingErr, existing) => {
          if (existingErr) {
            return sendDbError(res, existingErr, "Impossible de verifier les demandes");
          }

          if (existing.length > 0) {
            return res.status(400).json({ message: "Demande deja envoyee" });
          }

          const insertSql = `
            INSERT INTO team_invitations (team_id, player_id, requested_by, status)
            VALUES (?, ?, 'player', 'pending')
          `;

          db.query(insertSql, [team.id, player.id], (insertErr) => {
            if (insertErr) {
              return sendDbError(res, insertErr, "Impossible d'envoyer la demande");
            }

            res.json({
              message: "Demande envoyee au club",
              team_name: team.team_name,
            });
          });
        });
      });
    });
  });
};

exports.getTeamInvitations = (req, res) => {
  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getPlayerForUser(req.user.id, (playerErr, player) => {
      if (playerErr) {
        return sendDbError(res, playerErr, "Impossible de charger le joueur");
      }

      if (!player) {
        return res.status(404).json({ message: "Profil joueur introuvable" });
      }

      const sql = `
        SELECT
          ti.*,
          t.team_name,
          t.city,
          t.level,
          t.category
        FROM team_invitations ti
        JOIN teams t ON t.id = ti.team_id
        WHERE ti.player_id = ? AND ti.status = 'pending' AND ti.requested_by = 'team'
        ORDER BY ti.created_at DESC
      `;

      db.query(sql, [player.id], (err, invitations) => {
        if (err) {
          return sendDbError(res, err, "Impossible de charger les invitations");
        }

        res.json(invitations);
      });
    });
  });
};

exports.acceptTeamInvitation = (req, res) => {
  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getPlayerForUser(req.user.id, (playerErr, player) => {
      if (playerErr) {
        return sendDbError(res, playerErr, "Impossible de charger le joueur");
      }

      if (!player) {
        return res.status(404).json({ message: "Profil joueur introuvable" });
      }

      const inviteSql = `
        SELECT ti.*, t.team_name
        FROM team_invitations ti
        JOIN teams t ON t.id = ti.team_id
        WHERE ti.id = ? AND ti.player_id = ? AND ti.status = 'pending' AND ti.requested_by = 'team'
        LIMIT 1
      `;

      db.query(inviteSql, [req.params.invitationId, player.id], (inviteErr, result) => {
        if (inviteErr) {
          return sendDbError(res, inviteErr, "Impossible de verifier l'invitation");
        }

        if (result.length === 0) {
          return res.status(404).json({ message: "Invitation introuvable" });
        }

        const invitation = result[0];
        const updatePlayerSql = `
          UPDATE players
          SET team_name = ?, no_team = 0
          WHERE id = ?
        `;

        db.query(updatePlayerSql, [invitation.team_name, player.id], (updateErr) => {
          if (updateErr) {
            return sendDbError(res, updateErr, "Impossible de changer le club");
          }

          const updateInviteSql = `
            UPDATE team_invitations
            SET status = CASE
              WHEN id = ? THEN 'accepted'
              WHEN player_id = ? AND status = 'pending' THEN 'declined'
              ELSE status
            END
            WHERE id = ? OR player_id = ?
          `;

          db.query(
            updateInviteSql,
            [invitation.id, player.id, invitation.id, player.id],
            (statusErr) => {
              if (statusErr) {
                return sendDbError(
                  res,
                  statusErr,
                  "Impossible de mettre a jour l'invitation"
                );
              }

              refreshTeamPlayerCounts((countErr) => {
                if (countErr) {
                  return sendDbError(
                    res,
                    countErr,
                    "Impossible de mettre a jour le compteur du club"
                  );
                }

                res.json({
                  message: "Invitation acceptee",
                  team_name: invitation.team_name,
                });
              });
            }
          );
        });
      });
    });
  });
};

exports.declineTeamInvitation = (req, res) => {
  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getPlayerForUser(req.user.id, (playerErr, player) => {
      if (playerErr) {
        return sendDbError(res, playerErr, "Impossible de charger le joueur");
      }

      if (!player) {
        return res.status(404).json({ message: "Profil joueur introuvable" });
      }

      const sql = `
        UPDATE team_invitations
        SET status = 'declined'
        WHERE id = ? AND player_id = ? AND status = 'pending'
      `;

      db.query(sql, [req.params.invitationId, player.id], (err, result) => {
        if (err) {
          return sendDbError(res, err, "Impossible de refuser l'invitation");
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Invitation introuvable" });
        }

        res.json({ message: "Invitation refusee" });
      });
    });
  });
};
