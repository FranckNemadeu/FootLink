const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { isCloudinaryConfigured, uploadImage } = require("../config/cloudinary");
const verifyToken = require("../middlewares/authMiddleware");

const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `team-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: isCloudinaryConfigured ? multer.memoryStorage() : storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Le fichier doit etre une image"));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const sendDbError = (res, err, fallbackMessage) => {
  console.log(err);

  if (res.headersSent) return;

  res.status(500).json({
    message: fallbackMessage,
    error: err.sqlMessage || err.message,
    code: err.code,
  });
};

const ensureColumn = (tableName, columnName, columnDefinition, callback) => {
  const checkSql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `;

  db.query(checkSql, [tableName, columnName], (checkErr, result) => {
    if (checkErr) return callback(checkErr);
    if (result.length > 0) return callback(null);

    db.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
      callback
    );
  });
};

const ensurePlayerTeamColumns = (callback) => {
  const columns = [
    ["team_name", "VARCHAR(100)"],
    ["no_team", "TINYINT(1) DEFAULT 0"],
  ];

  const runNext = (index) => {
    if (index >= columns.length) return callback(null);

    const [columnName, columnDefinition] = columns[index];
    ensureColumn("players", columnName, columnDefinition, (err) => {
      if (err) return callback(err);
      runNext(index + 1);
    });
  };

  runNext(0);
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

    ensureColumn(
      "team_invitations",
      "requested_by",
      "VARCHAR(20) DEFAULT 'team'",
      callback
    );
  });
};

const ensureTeamPlayerCountColumn = (callback) => {
  ensureColumn("teams", "player_count", "INT DEFAULT 0", callback);
};

const ensureTeamLogoColumn = (callback) => {
  ensureColumn("teams", "logo_photo", "VARCHAR(255)", callback);
};

const ensureTeamPublicColumns = (callback) => {
  ensureTeamPlayerCountColumn((countErr) => {
    if (countErr) return callback(countErr);

    ensureTeamLogoColumn((logoErr) => {
      if (logoErr) return callback(logoErr);
      refreshTeamPlayerCounts(callback);
    });
  });
};

const uploadTeamLogo = (req, res, next) => {
  upload.single("logo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || "Erreur lors du televersement du logo",
      });
    }

    next();
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

const getTeamForUser = (userId, callback) => {
  const sql = "SELECT * FROM teams WHERE user_id = ? LIMIT 1";
  db.query(sql, [userId], (err, result) => {
    if (err) return callback(err);

    callback(null, result[0]);
  });
};

const teamPublicSelect = `
  SELECT
    t.id,
    t.team_name,
    t.city,
    t.level,
    t.category,
    t.bio,
    t.player_count,
    t.logo_photo,
    COALESCE(SUM(ms.goals), 0) AS goals,
    COALESCE(SUM(ms.assists), 0) AS assists,
    COUNT(DISTINCT ms.match_id) AS matches,
    (
      SELECT u2.name
      FROM players p2
      JOIN users u2 ON u2.id = p2.user_id
      LEFT JOIN match_stats ms2 ON ms2.player_id = p2.id
      WHERE LOWER(p2.team_name) = LOWER(t.team_name)
      GROUP BY p2.id, u2.name
      ORDER BY COALESCE(SUM(ms2.goals), 0) DESC, u2.name
      LIMIT 1
    ) AS top_scorer,
    (
      SELECT COALESCE(SUM(ms2.goals), 0)
      FROM players p2
      LEFT JOIN match_stats ms2 ON ms2.player_id = p2.id
      WHERE LOWER(p2.team_name) = LOWER(t.team_name)
      GROUP BY p2.id
      ORDER BY COALESCE(SUM(ms2.goals), 0) DESC, p2.id
      LIMIT 1
    ) AS top_scorer_goals,
    (
      SELECT u3.name
      FROM players p3
      JOIN users u3 ON u3.id = p3.user_id
      LEFT JOIN match_stats ms3 ON ms3.player_id = p3.id
      WHERE LOWER(p3.team_name) = LOWER(t.team_name)
      GROUP BY p3.id, u3.name
      ORDER BY COALESCE(SUM(ms3.assists), 0) DESC, u3.name
      LIMIT 1
    ) AS top_assister
    ,
    (
      SELECT COALESCE(SUM(ms3.assists), 0)
      FROM players p3
      LEFT JOIN match_stats ms3 ON ms3.player_id = p3.id
      WHERE LOWER(p3.team_name) = LOWER(t.team_name)
      GROUP BY p3.id
      ORDER BY COALESCE(SUM(ms3.assists), 0) DESC, p3.id
      LIMIT 1
    ) AS top_assister_assists
  FROM teams t
  LEFT JOIN players p ON LOWER(p.team_name) = LOWER(t.team_name)
  LEFT JOIN match_stats ms ON ms.player_id = p.id
`;

router.get("/players", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  ensurePlayerTeamColumns((columnErr) => {
    if (columnErr) {
      return sendDbError(res, columnErr, "Impossible de preparer les joueurs");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const sql = `
        SELECT
          p.*,
          u.name,
          u.email,
          COALESCE(SUM(ms.goals), 0) AS goals,
          COALESCE(SUM(ms.assists), 0) AS assists,
          COALESCE(SUM(ms.yellow_cards), 0) + COALESCE(SUM(ms.red_cards), 0) AS cards
        FROM players p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN match_stats ms ON ms.player_id = p.id
        WHERE LOWER(p.team_name) = LOWER(?)
        GROUP BY p.id, u.name, u.email
        ORDER BY u.name
      `;

      db.query(sql, [team.team_name], (playersErr, players) => {
        if (playersErr) {
          return sendDbError(res, playersErr, "Impossible de charger les joueurs");
        }

        refreshTeamPlayerCounts((countErr) => {
          if (countErr) {
            return sendDbError(
              res,
              countErr,
              "Impossible de mettre a jour le compteur du club"
            );
          }

          getTeamForUser(req.user.id, (freshTeamErr, freshTeam) => {
            if (freshTeamErr) {
              return sendDbError(res, freshTeamErr, "Impossible de charger l'equipe");
            }

            res.json({
              team: freshTeam || team,
              players,
            });
          });
        });
      });
    });
  });
});

router.post("/logo", verifyToken, uploadTeamLogo, async (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Action reservee aux equipes" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Aucun logo envoye" });
  }

  let logoUrl;
  try {
    logoUrl = await uploadImage(req.file, "footlink/teams");
  } catch (err) {
    return sendDbError(res, err, "Impossible de televerser le logo");
  }

  ensureTeamLogoColumn((columnErr) => {
    if (columnErr) {
      return sendDbError(res, columnErr, "Impossible de preparer le logo du club");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const sql = "UPDATE teams SET logo_photo = ? WHERE user_id = ?";
      db.query(sql, [logoUrl, req.user.id], (updateErr) => {
        if (updateErr) {
          return sendDbError(res, updateErr, "Impossible de mettre a jour le logo");
        }

        if (team.logo_photo && team.logo_photo.startsWith("/uploads/")) {
          const oldLogoPath = path.join(
            __dirname,
            "..",
            team.logo_photo.replace(/^[/\\]+/, "")
          );
          fs.unlink(oldLogoPath, () => {});
        }

        res.json({
          message: "Logo du club mis a jour",
          logo_photo: logoUrl,
        });
      });
    });
  });
});

router.get("/list", (req, res) => {
  const loadTeams = () => {
    const sql = `
      ${teamPublicSelect}
      GROUP BY
        t.id,
        t.team_name,
        t.city,
        t.level,
        t.category,
        t.bio,
        t.player_count,
        t.logo_photo
      ORDER BY team_name
    `;

    db.query(sql, (err, teams) => {
      if (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          return res.json([]);
        }
        return sendDbError(res, err, "Impossible de charger la liste des clubs");
      }

      res.json(teams);
    });
  };

  ensureTeamPublicColumns((countErr) => {
    if (countErr) {
      if (countErr.code === "ER_NO_SUCH_TABLE") {
        return res.json([]);
      }
      return sendDbError(res, countErr, "Impossible de mettre a jour les clubs");
    }

    loadTeams();
  });
});

router.get("/public/:teamId", (req, res) => {
  ensureTeamPublicColumns((countErr) => {
    if (countErr) {
      if (countErr.code === "ER_NO_SUCH_TABLE") {
        return res.status(404).json({ message: "Club introuvable" });
      }

      return sendDbError(res, countErr, "Impossible de mettre a jour les clubs");
    }

    const teamSql = `
      ${teamPublicSelect}
      WHERE t.id = ?
      GROUP BY
        t.id,
        t.team_name,
        t.city,
        t.level,
        t.category,
        t.bio,
        t.player_count,
        t.logo_photo
      LIMIT 1
    `;

    db.query(teamSql, [req.params.teamId], (teamErr, teamResult) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger le club");
      }

      if (teamResult.length === 0) {
        return res.status(404).json({ message: "Club introuvable" });
      }

      const team = teamResult[0];
      ensureColumn("players", "profile_photo", "VARCHAR(255)", (photoErr) => {
        if (photoErr) {
          return sendDbError(res, photoErr, "Impossible de preparer les photos");
        }

        const playersSql = `
          SELECT
            p.id,
            p.position,
            p.city,
            p.profile_photo,
            u.name,
            COALESCE(SUM(ms.goals), 0) AS goals,
            COALESCE(SUM(ms.assists), 0) AS assists,
            COALESCE(SUM(ms.yellow_cards), 0) + COALESCE(SUM(ms.red_cards), 0) AS cards
          FROM players p
          JOIN users u ON u.id = p.user_id
          LEFT JOIN match_stats ms ON ms.player_id = p.id
          WHERE LOWER(p.team_name) = LOWER(?)
          GROUP BY p.id, p.position, p.city, p.profile_photo, u.name
          ORDER BY goals DESC, u.name
        `;

        db.query(playersSql, [team.team_name], (playersErr, players) => {
          if (playersErr) {
            return sendDbError(res, playersErr, "Impossible de charger les joueurs");
          }

          const matchesSql = `
            SELECT id, type, match_date, created_at
            FROM matches
            WHERE team_id = ?
            ORDER BY match_date DESC, id DESC
            LIMIT 8
          `;

          db.query(matchesSql, [team.id], (matchesErr, matches) => {
            if (matchesErr) {
              return sendDbError(res, matchesErr, "Impossible de charger les matchs");
            }

            res.json({ team, players, matches });
          });
        });
      });
    });
  });
});

router.post("/players/:playerId/invite", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const checkPlayerSql = "SELECT id, team_name FROM players WHERE id = ? LIMIT 1";
      db.query(checkPlayerSql, [req.params.playerId], (playerErr, playerResult) => {
        if (playerErr) {
          return sendDbError(res, playerErr, "Impossible de verifier le joueur");
        }

        if (playerResult.length === 0) {
          return res.status(404).json({ message: "Joueur introuvable" });
        }

        if (
          playerResult[0].team_name &&
          playerResult[0].team_name.toLowerCase() === team.team_name.toLowerCase()
        ) {
          return res.status(400).json({ message: "Ce joueur est deja dans ton equipe" });
        }

        const existingInvitationSql = `
          SELECT id
          FROM team_invitations
          WHERE team_id = ? AND player_id = ? AND status = 'pending'
          LIMIT 1
        `;

        db.query(
          existingInvitationSql,
          [team.id, req.params.playerId],
          (existingErr, existingResult) => {
            if (existingErr) {
              return sendDbError(
                res,
                existingErr,
                "Impossible de verifier les invitations"
              );
            }

            if (existingResult.length > 0) {
              return res.status(400).json({ message: "Invitation deja envoyee" });
            }

            const insertSql = `
              INSERT INTO team_invitations (team_id, player_id, requested_by, status)
              VALUES (?, ?, 'team', 'pending')
            `;

            db.query(insertSql, [team.id, req.params.playerId], (insertErr) => {
              if (insertErr) {
                return sendDbError(
                  res,
                  insertErr,
                  "Impossible d'envoyer l'invitation"
                );
              }

              res.json({ message: "Invitation envoyee au joueur" });
            });
          }
        );
      });
    });
  });
});

router.get("/invitations", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      ensureColumn("players", "profile_photo", "VARCHAR(255)", (photoErr) => {
        if (photoErr) {
          return sendDbError(res, photoErr, "Impossible de preparer les photos");
        }

        const sql = `
          SELECT ti.*, u.name, p.position, p.city, p.team_name, p.profile_photo
          FROM team_invitations ti
          JOIN players p ON p.id = ti.player_id
          JOIN users u ON u.id = p.user_id
          WHERE ti.team_id = ?
          ORDER BY ti.created_at DESC
        `;

        db.query(sql, [team.id], (err, invitations) => {
          if (err) {
            return sendDbError(res, err, "Impossible de charger les invitations");
          }

          res.json(invitations);
        });
      });
    });
  });
});

router.get("/matches", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const sql = `
      SELECT *
      FROM matches
      WHERE team_id = ?
      ORDER BY match_date DESC, id DESC
    `;

    db.query(sql, [team.id], (err, matches) => {
      if (err) {
        return sendDbError(res, err, "Impossible de charger les matchs");
      }

      res.json(matches);
    });
  });
});

router.post("/matches", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  const { type = "local", match_date } = req.body;

  if (!match_date) {
    return res.status(400).json({ message: "La date du match est requise" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const sql = "INSERT INTO matches (team_id, type, match_date) VALUES (?, ?, ?)";

    db.query(sql, [team.id, type, match_date], (err, result) => {
      if (err) {
        return sendDbError(res, err, "Impossible de creer le match");
      }

      res.json({
        message: "Match cree",
        match: {
          id: result.insertId,
          team_id: team.id,
          type,
          match_date,
        },
      });
    });
  });
});

router.post("/invitations/:invitationId/accept", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  ensureTeamInvitationsTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer les invitations");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const inviteSql = `
        SELECT *
        FROM team_invitations
        WHERE id = ? AND team_id = ? AND status = 'pending' AND requested_by = 'player'
        LIMIT 1
      `;

      db.query(inviteSql, [req.params.invitationId, team.id], (inviteErr, result) => {
        if (inviteErr) {
          return sendDbError(res, inviteErr, "Impossible de verifier la demande");
        }

        if (result.length === 0) {
          return res.status(404).json({ message: "Demande introuvable" });
        }

        const invitation = result[0];
        const updatePlayerSql = `
          UPDATE players
          SET team_name = ?, no_team = 0
          WHERE id = ?
        `;

        db.query(updatePlayerSql, [team.team_name, invitation.player_id], (playerErr) => {
          if (playerErr) {
            return sendDbError(res, playerErr, "Impossible d'ajouter le joueur");
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
            [
              invitation.id,
              invitation.player_id,
              invitation.id,
              invitation.player_id,
            ],
            (statusErr) => {
              if (statusErr) {
                return sendDbError(
                  res,
                  statusErr,
                  "Impossible de mettre a jour la demande"
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

                res.json({ message: "Demande acceptee" });
              });
            }
          );
        });
      });
    });
  });
});

router.post("/invitations/:invitationId/decline", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const sql = `
      UPDATE team_invitations
      SET status = 'declined'
      WHERE id = ? AND team_id = ? AND status = 'pending' AND requested_by = 'player'
    `;

    db.query(sql, [req.params.invitationId, team.id], (err, result) => {
      if (err) {
        return sendDbError(res, err, "Impossible de refuser la demande");
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Demande introuvable" });
      }

      res.json({ message: "Demande refusee" });
    });
  });
});

router.delete("/players/:playerId", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const sql = `
      UPDATE players
      SET team_name = NULL, no_team = 1
      WHERE id = ? AND LOWER(team_name) = LOWER(?)
    `;

    db.query(sql, [req.params.playerId, team.team_name], (err, result) => {
      if (err) {
        return sendDbError(res, err, "Impossible de retirer le joueur");
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Joueur introuvable dans cette equipe" });
      }

      refreshTeamPlayerCounts((countErr) => {
        if (countErr) {
          return sendDbError(
            res,
            countErr,
            "Impossible de mettre a jour le compteur du club"
          );
        }

        res.json({ message: "Joueur retire de l'equipe" });
      });
    });
  });
});

router.post("/players/:playerId/stats", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  const {
    match_id,
    goals = 0,
    assists = 0,
    yellow_cards = 0,
    red_cards = 0,
  } = req.body;

  if (!match_id) {
    return res.status(400).json({ message: "match_id est requis" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const checkSql = `
      SELECT id
      FROM players
      WHERE id = ? AND LOWER(team_name) = LOWER(?)
    `;

    db.query(checkSql, [req.params.playerId, team.team_name], (checkErr, result) => {
      if (checkErr) {
        return sendDbError(res, checkErr, "Impossible de verifier le joueur");
      }

      if (result.length === 0) {
        return res.status(404).json({ message: "Joueur introuvable dans cette equipe" });
      }

      const insertSql = `
        INSERT INTO match_stats
        (match_id, player_id, goals, assists, yellow_cards, red_cards)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertSql,
        [
          match_id,
          req.params.playerId,
          goals,
          assists,
          yellow_cards,
          red_cards,
        ],
        (insertErr) => {
          if (insertErr) {
            return sendDbError(res, insertErr, "Impossible d'ajouter les stats");
          }

          res.json({ message: "Stats ajoutees" });
        }
      );
    });
  });
});

router.delete("/account", verifyToken, (req, res) => {
  const { password } = req.body;

  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Action reservee aux equipes" });
  }

  if (!password) {
    return res.status(400).json({ message: "Mot de passe requis" });
  }

  const userSql = "SELECT id, password FROM users WHERE id = ? LIMIT 1";
  db.query(userSql, [req.user.id], async (userErr, users) => {
    if (userErr) {
      return sendDbError(res, userErr, "Impossible de verifier le compte");
    }

    if (users.length === 0) {
      return res.status(404).json({ message: "Compte introuvable" });
    }

    const passwordMatches = await bcrypt.compare(password, users[0].password);
    if (!passwordMatches) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      db.beginTransaction((transactionErr) => {
        if (transactionErr) {
          return sendDbError(res, transactionErr, "Impossible de demarrer la suppression");
        }

        const rollback = (message) => {
          db.rollback(() => res.status(500).json({ message }));
        };

        db.query("DELETE FROM team_invitations WHERE team_id = ?", [team.id], (inviteErr) => {
          if (inviteErr) return rollback("Impossible de supprimer les invitations");

          db.query(
            "DELETE FROM match_stats WHERE match_id IN (SELECT id FROM matches WHERE team_id = ?)",
            [team.id],
            (statsErr) => {
              if (statsErr) return rollback("Impossible de supprimer les stats des matchs");

              db.query("DELETE FROM matches WHERE team_id = ?", [team.id], (matchesErr) => {
                if (matchesErr) return rollback("Impossible de supprimer les matchs");

                db.query(
                  "UPDATE players SET team_name = NULL, no_team = 1 WHERE LOWER(team_name) = LOWER(?)",
                  [team.team_name],
                  (playersErr) => {
                    if (playersErr) return rollback("Impossible de detacher les joueurs");

                    db.query("DELETE FROM teams WHERE id = ? AND user_id = ?", [team.id, req.user.id], (teamDeleteErr) => {
                      if (teamDeleteErr) return rollback("Impossible de supprimer le club");

                      db.query("DELETE FROM users WHERE id = ?", [req.user.id], (userDeleteErr) => {
                        if (userDeleteErr) return rollback("Impossible de supprimer le compte");

                        db.commit((commitErr) => {
                          if (commitErr) return rollback("Impossible de finaliser la suppression");

                          if (team.logo_photo && team.logo_photo.startsWith("/uploads/")) {
                            const logoPath = path.join(
                              __dirname,
                              "..",
                              team.logo_photo.replace(/^[/\\]+/, "")
                            );
                            fs.unlink(logoPath, () => {});
                          }

                          res.json({ message: "Compte equipe supprime" });
                        });
                      });
                    });
                  }
                );
              });
            }
          );
        });
      });
    });
  });
});

module.exports = router;
