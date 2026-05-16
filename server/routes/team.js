const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const {
  shouldUseLocalUploads,
  uploadImage,
} = require("../config/cloudinary");
const verifyToken = require("../middlewares/authMiddleware");

const uploadsDir = path.join(__dirname, "..", "uploads");
const CLUB_ROLES = new Set([
  "Joueur",
  "Coach",
  "Assistant coach",
  "Manager",
  "Staff",
]);
const MAX_GALLERY_PHOTOS = 30;

const parseSeasonYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  return year;
};

const parseStatValue = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

if (shouldUseLocalUploads && !fs.existsSync(uploadsDir)) {
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
  storage: shouldUseLocalUploads ? storage : multer.memoryStorage(),
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
    ["club_role", "VARCHAR(50) DEFAULT 'Joueur'"],
    ["profile_photo", "VARCHAR(255)"],
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

const ensurePlayerTeamMembershipsTable = (callback) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS player_team_memberships (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player_id INT NOT NULL,
      team_id INT NOT NULL,
      club_role VARCHAR(50) DEFAULT 'Joueur',
      active TINYINT(1) DEFAULT 1,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, (err) => {
    if (err) return callback(err);

    ensureColumn("player_team_memberships", "club_role", "VARCHAR(50) DEFAULT 'Joueur'", (roleErr) => {
      if (roleErr) return callback(roleErr);
      ensureColumn("player_team_memberships", "active", "TINYINT(1) DEFAULT 1", (activeErr) => {
        if (activeErr) return callback(activeErr);
        ensureColumn("player_team_memberships", "left_at", "DATETIME NULL", (leftErr) => {
          if (leftErr) return callback(leftErr);

          const syncSql = `
            INSERT INTO player_team_memberships (player_id, team_id, club_role, active)
            SELECT p.id, t.id, COALESCE(p.club_role, 'Joueur'), 1
            FROM players p
            JOIN teams t ON LOWER(t.team_name) = LOWER(p.team_name)
            WHERE p.team_name IS NOT NULL
              AND p.team_name <> ''
              AND NOT EXISTS (
                SELECT 1
                FROM player_team_memberships ptm
                WHERE ptm.player_id = p.id AND ptm.team_id = t.id
              )
          `;

          db.query(syncSql, callback);
        });
      });
    });
  });
};

const addPlayerMembership = (teamId, playerId, clubRole, callback) => {
  ensurePlayerTeamMembershipsTable((tableErr) => {
    if (tableErr) return callback(tableErr);

    const existingSql = `
      SELECT id, active
      FROM player_team_memberships
      WHERE team_id = ? AND player_id = ?
      LIMIT 1
    `;

    db.query(existingSql, [teamId, playerId], (existingErr, result) => {
      if (existingErr) return callback(existingErr);

      if (result.length > 0) {
        return db.query(
          `
            UPDATE player_team_memberships
            SET active = 1, club_role = ?, left_at = NULL
            WHERE id = ?
          `,
          [clubRole || "Joueur", result[0].id],
          callback
        );
      }

      db.query(
        `
          INSERT INTO player_team_memberships (team_id, player_id, club_role, active)
          VALUES (?, ?, ?, 1)
        `,
        [teamId, playerId, clubRole || "Joueur"],
        callback
      );
    });
  });
};

const ensureTeamPlayerCountColumn = (callback) => {
  ensureColumn("teams", "player_count", "INT DEFAULT 0", callback);
};

const ensureTeamLogoColumn = (callback) => {
  ensureColumn("teams", "logo_photo", "VARCHAR(255)", callback);
};

const ensureMatchManOfMatchColumn = (callback) => {
  ensureColumn("matches", "man_of_match_player_id", "INT NULL", callback);
};

const ensureTeamPublicColumns = (callback) => {
  ensureTeamPlayerCountColumn((countErr) => {
    if (countErr) return callback(countErr);

    ensureTeamLogoColumn((logoErr) => {
      if (logoErr) return callback(logoErr);
      ensurePlayerTeamMembershipsTable((membershipErr) => {
        if (membershipErr) return callback(membershipErr);
        refreshTeamPlayerCounts(callback);
      });
    });
  });
};

const ensureTeamListColumns = (callback) => {
  ensureTeamPlayerCountColumn((countErr) => {
    if (countErr) return callback(countErr);

    ensureTeamLogoColumn((logoErr) => {
      if (logoErr) return callback(logoErr);
      ensurePlayerTeamMembershipsTable(callback);
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

const uploadGalleryPhoto = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || "Erreur lors du televersement de la photo",
      });
    }

    next();
  });
};

const ensureTeamGalleryTable = (callback) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS team_gallery (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      image_url VARCHAR(255) NOT NULL,
      caption VARCHAR(160),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, (err) => {
    if (err) return callback(err);
    ensureColumn("team_gallery", "caption", "VARCHAR(160)", callback);
  });
};

const refreshTeamPlayerCounts = (callback) => {
  ensureTeamPlayerCountColumn((columnErr) => {
    if (columnErr) return callback(columnErr);

    ensurePlayerTeamMembershipsTable((membershipErr) => {
      if (membershipErr) return callback(membershipErr);

      const sql = `
        UPDATE teams t
        SET player_count = (
          SELECT COUNT(DISTINCT ptm.player_id)
          FROM player_team_memberships ptm
          WHERE ptm.team_id = t.id AND ptm.active = 1
        )
      `;

      db.query(sql, callback);
    });
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
          FROM player_team_memberships ptm2
          JOIN players p2 ON p2.id = ptm2.player_id
          JOIN users u2 ON u2.id = p2.user_id
          LEFT JOIN match_stats ms2 ON ms2.player_id = p2.id
          WHERE ptm2.team_id = t.id AND ptm2.active = 1
      GROUP BY p2.id, u2.name
      ORDER BY COALESCE(SUM(ms2.goals), 0) DESC, u2.name
      LIMIT 1
    ) AS top_scorer,
    (
      SELECT COALESCE(SUM(ms2.goals), 0)
      FROM player_team_memberships ptm2
      JOIN players p2 ON p2.id = ptm2.player_id
      LEFT JOIN match_stats ms2 ON ms2.player_id = p2.id
      WHERE ptm2.team_id = t.id AND ptm2.active = 1
      GROUP BY p2.id
      ORDER BY COALESCE(SUM(ms2.goals), 0) DESC, p2.id
      LIMIT 1
    ) AS top_scorer_goals,
    (
      SELECT u3.name
      FROM player_team_memberships ptm3
      JOIN players p3 ON p3.id = ptm3.player_id
      JOIN users u3 ON u3.id = p3.user_id
      LEFT JOIN match_stats ms3 ON ms3.player_id = p3.id
      WHERE ptm3.team_id = t.id AND ptm3.active = 1
      GROUP BY p3.id, u3.name
      ORDER BY COALESCE(SUM(ms3.assists), 0) DESC, u3.name
      LIMIT 1
    ) AS top_assister
    ,
    (
      SELECT COALESCE(SUM(ms3.assists), 0)
      FROM player_team_memberships ptm3
      JOIN players p3 ON p3.id = ptm3.player_id
      LEFT JOIN match_stats ms3 ON ms3.player_id = p3.id
      WHERE ptm3.team_id = t.id AND ptm3.active = 1
      GROUP BY p3.id
      ORDER BY COALESCE(SUM(ms3.assists), 0) DESC, p3.id
      LIMIT 1
    ) AS top_assister_assists
  FROM teams t
  LEFT JOIN player_team_memberships ptm ON ptm.team_id = t.id AND ptm.active = 1
  LEFT JOIN players p ON p.id = ptm.player_id
  LEFT JOIN match_stats ms ON ms.player_id = p.id
`;

const teamListSelect = `
  SELECT
    t.id,
    t.team_name,
    t.city,
    t.level,
    t.category,
    t.bio,
    COALESCE(active_players.player_count, t.player_count, 0) AS player_count,
    t.logo_photo,
    COALESCE(team_stats.goals, 0) AS goals,
    COALESCE(team_stats.assists, 0) AS assists,
    COALESCE(team_stats.matches, 0) AS matches,
    NULL AS top_scorer,
    0 AS top_scorer_goals,
    NULL AS top_assister,
    0 AS top_assister_assists
  FROM teams t
  LEFT JOIN (
    SELECT team_id, COUNT(*) AS player_count
    FROM player_team_memberships
    WHERE active = 1
    GROUP BY team_id
  ) active_players ON active_players.team_id = t.id
  LEFT JOIN (
    SELECT
      ptm.team_id,
      COALESCE(SUM(ms.goals), 0) AS goals,
      COALESCE(SUM(ms.assists), 0) AS assists,
      COUNT(DISTINCT ms.match_id) AS matches
    FROM player_team_memberships ptm
    LEFT JOIN players p ON p.id = ptm.player_id
    LEFT JOIN match_stats ms ON ms.player_id = p.id
    WHERE ptm.active = 1
    GROUP BY ptm.team_id
  ) team_stats ON team_stats.team_id = t.id
`;

const teamOptionsSelect = `
  SELECT
    t.id,
    t.team_name,
    t.city,
    t.level,
    t.category,
    t.bio,
    COALESCE(t.player_count, 0) AS player_count,
    t.logo_photo,
    0 AS goals,
    0 AS assists,
    0 AS matches,
    NULL AS top_scorer,
    0 AS top_scorer_goals,
    NULL AS top_assister,
    0 AS top_assister_assists
  FROM teams t
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

      ensureMatchManOfMatchColumn((motmColumnErr) => {
        if (motmColumnErr) {
          return sendDbError(
            res,
            motmColumnErr,
            "Impossible de preparer les hommes du match"
          );
        }

      ensurePlayerTeamMembershipsTable((membershipTableErr) => {
        if (membershipTableErr) {
          return sendDbError(
            res,
            membershipTableErr,
            "Impossible de preparer les clubs du joueur"
          );
        }

      const seasonYear = parseSeasonYear(req.query.year);
      const statsWhere = seasonYear
        ? "WHERE m.team_id = ? AND YEAR(m.match_date) = ?"
        : "WHERE m.team_id = ?";
      const statsValues = seasonYear ? [team.id, seasonYear] : [team.id];
      const sql = `
        SELECT
          p.*,
          u.name,
          u.email,
          COALESCE(s.goals, 0) AS goals,
          COALESCE(s.assists, 0) AS assists,
          COALESCE(s.yellow_cards, 0) + COALESCE(s.red_cards, 0) AS cards,
            COALESCE(s.motm_count, 0) AS motm_count,
            ptm.club_role AS club_role
        FROM player_team_memberships ptm
        JOIN players p ON p.id = ptm.player_id
        JOIN users u ON u.id = p.user_id
        LEFT JOIN (
          SELECT
            ms.player_id,
            COALESCE(SUM(ms.goals), 0) AS goals,
            COALESCE(SUM(ms.assists), 0) AS assists,
            COALESCE(SUM(ms.yellow_cards), 0) AS yellow_cards,
            COALESCE(SUM(ms.red_cards), 0) AS red_cards,
            COUNT(DISTINCT CASE WHEN m.man_of_match_player_id = ms.player_id THEN m.id END) AS motm_count
          FROM match_stats ms
          JOIN matches m ON m.id = ms.match_id
          ${statsWhere}
          GROUP BY ms.player_id
        ) s ON s.player_id = p.id
        WHERE ptm.team_id = ? AND ptm.active = 1
        ORDER BY u.name
      `;

      db.query(sql, [...statsValues, team.id], (playersErr, players) => {
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
    if (err.code === "CLOUDINARY_NOT_CONFIGURED") {
      return res.status(500).json({ message: err.message });
    }

    return res.status(500).json({
      message:
        err.message ||
        "Impossible de televerser le logo. Verifie la configuration Cloudinary.",
      code: err.code,
    });
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

router.get("/options", (req, res) => {
  const sql = `${teamOptionsSelect} ORDER BY t.team_name`;

  ensureTeamListColumns((columnErr) => {
    if (columnErr) {
      if (columnErr.code === "ER_NO_SUCH_TABLE") {
        return res.json([]);
      }

      return sendDbError(res, columnErr, "Impossible de preparer les clubs");
    }

    db.query(sql, (err, teams) => {
      if (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          return res.json([]);
        }

        return sendDbError(res, err, "Impossible de charger les clubs");
      }

      res.json(teams);
    });
  });
});

router.get("/list", (req, res) => {
  const sql = `${teamListSelect} ORDER BY t.team_name`;
  const loadOptions = () => {
    db.query(`${teamOptionsSelect} ORDER BY t.team_name`, (optionErr, teams) => {
      if (optionErr) {
        if (optionErr.code === "ER_NO_SUCH_TABLE") {
          return res.json([]);
        }

        return sendDbError(res, optionErr, "Impossible de charger la liste des clubs");
      }

      res.json(teams);
    });
  };

  ensureTeamListColumns((columnErr) => {
    if (columnErr) {
      if (columnErr.code === "ER_NO_SUCH_TABLE") {
        return res.json([]);
      }

      return sendDbError(res, columnErr, "Impossible de preparer les clubs");
    }

    db.query(sql, (err, teams) => {
      if (err) {
        if (err.code === "ER_NO_SUCH_TABLE") {
          return loadOptions();
        }

        return sendDbError(res, err, "Impossible de charger la liste des clubs");
      }

      res.json(teams);
    });
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
      ensurePlayerTeamColumns((playerColumnErr) => {
        if (playerColumnErr) {
          return sendDbError(
            res,
            playerColumnErr,
            "Impossible de preparer les joueurs"
          );
        }

        ensureColumn("players", "profile_photo", "VARCHAR(255)", (photoErr) => {
          if (photoErr) {
            return sendDbError(res, photoErr, "Impossible de preparer les photos");
          }

          ensureMatchManOfMatchColumn((motmColumnErr) => {
            if (motmColumnErr) {
              return sendDbError(
                res,
                motmColumnErr,
                "Impossible de preparer les hommes du match"
              );
            }

          const seasonYear = parseSeasonYear(req.query.year);
          const statsWhere = seasonYear
            ? "WHERE m.team_id = ? AND YEAR(m.match_date) = ?"
            : "WHERE m.team_id = ?";
          const statsValues = seasonYear ? [team.id, seasonYear] : [team.id];
          const playersSql = `
            SELECT
              p.id,
              p.position,
              p.city,
              p.profile_photo,
              COALESCE(ptm.club_role, p.club_role) AS club_role,
              u.name,
              COALESCE(s.goals, 0) AS goals,
              COALESCE(s.assists, 0) AS assists,
              COALESCE(s.yellow_cards, 0) + COALESCE(s.red_cards, 0) AS cards,
              COALESCE(s.motm_count, 0) AS motm_count
            FROM player_team_memberships ptm
            JOIN players p ON p.id = ptm.player_id
            JOIN users u ON u.id = p.user_id
            LEFT JOIN (
              SELECT
                ms.player_id,
                COALESCE(SUM(ms.goals), 0) AS goals,
                COALESCE(SUM(ms.assists), 0) AS assists,
                COALESCE(SUM(ms.yellow_cards), 0) AS yellow_cards,
                COALESCE(SUM(ms.red_cards), 0) AS red_cards,
                COUNT(DISTINCT CASE WHEN m.man_of_match_player_id = ms.player_id THEN m.id END) AS motm_count
              FROM match_stats ms
              JOIN matches m ON m.id = ms.match_id
              ${statsWhere}
              GROUP BY ms.player_id
            ) s ON s.player_id = p.id
            WHERE ptm.team_id = ? AND ptm.active = 1
            ORDER BY goals DESC, u.name
          `;

          db.query(playersSql, [...statsValues, team.id], (playersErr, players) => {
            if (playersErr) {
              return sendDbError(res, playersErr, "Impossible de charger les joueurs");
            }

              const matchesSql = `
                SELECT
                  m.id,
                  m.type,
                  m.match_date,
                  m.man_of_match_player_id,
                  m.created_at,
                  u.name AS man_of_match_name
                FROM matches m
                LEFT JOIN players p ON p.id = m.man_of_match_player_id
                LEFT JOIN users u ON u.id = p.user_id
                WHERE m.team_id = ?
                ORDER BY m.match_date DESC, m.id DESC
                LIMIT 8
              `;

              db.query(matchesSql, [team.id], (matchesErr, matches) => {
                if (matchesErr) {
                  return sendDbError(res, matchesErr, "Impossible de charger les matchs");
                }

              ensureTeamGalleryTable((galleryTableErr) => {
                if (galleryTableErr) {
                  return sendDbError(
                    res,
                    galleryTableErr,
                    "Impossible de preparer la galerie"
                  );
                }

                const gallerySql = `
                  SELECT id, image_url, caption, created_at
                  FROM team_gallery
                  WHERE team_id = ?
                  ORDER BY created_at DESC, id DESC
                `;

                db.query(gallerySql, [team.id], (galleryErr, gallery) => {
                  if (galleryErr) {
                    return sendDbError(
                      res,
                      galleryErr,
                      "Impossible de charger la galerie"
                    );
                  }

                  res.json({ team, players, matches, gallery });
                });
              });
              });
            });
          });
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

      ensurePlayerTeamMembershipsTable((membershipTableErr) => {
        if (membershipTableErr) {
          return sendDbError(
            res,
            membershipTableErr,
            "Impossible de verifier les clubs du joueur"
          );
        }

      const checkPlayerSql = `
        SELECT
          p.id,
          p.team_name,
          ptm.id AS membership_id
        FROM players p
        LEFT JOIN player_team_memberships ptm
          ON ptm.player_id = p.id AND ptm.team_id = ? AND ptm.active = 1
        WHERE p.id = ?
        LIMIT 1
      `;
      db.query(checkPlayerSql, [team.id, req.params.playerId], (playerErr, playerResult) => {
        if (playerErr) {
          return sendDbError(res, playerErr, "Impossible de verifier le joueur");
        }

        if (playerResult.length === 0) {
          return res.status(404).json({ message: "Joueur introuvable" });
        }

        if (playerResult[0].membership_id) {
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

      ensureMatchManOfMatchColumn((columnErr) => {
        if (columnErr) {
          return sendDbError(res, columnErr, "Impossible de preparer les matchs");
        }

        const sql = `
          SELECT
            m.*,
            u.name AS man_of_match_name
          FROM matches m
          LEFT JOIN players p ON p.id = m.man_of_match_player_id
          LEFT JOIN users u ON u.id = p.user_id
          WHERE m.team_id = ?
          ORDER BY m.match_date DESC, m.id DESC
        `;

        db.query(sql, [team.id], (err, matches) => {
          if (err) {
            return sendDbError(res, err, "Impossible de charger les matchs");
          }

          res.json(matches);
        });
      });
    });
  });

router.get("/matches/:matchId/stats", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  const matchId = Number(req.params.matchId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ message: "Match invalide" });
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
        MIN(ms.id) AS id,
        ms.match_id,
        ms.player_id,
        COALESCE(SUM(ms.goals), 0) AS goals,
        COALESCE(SUM(ms.assists), 0) AS assists,
        COALESCE(SUM(ms.yellow_cards), 0) AS yellow_cards,
        COALESCE(SUM(ms.red_cards), 0) AS red_cards,
        u.name AS player_name,
        p.position
      FROM match_stats ms
      JOIN matches m ON m.id = ms.match_id
      JOIN players p ON p.id = ms.player_id
      JOIN users u ON u.id = p.user_id
      WHERE ms.match_id = ? AND m.team_id = ?
      GROUP BY ms.match_id, ms.player_id, u.name, p.position
      ORDER BY u.name
    `;

    db.query(sql, [matchId, team.id], (err, stats) => {
      if (err) {
        return sendDbError(res, err, "Impossible de charger les stats du match");
      }

      res.json(stats);
    });
  });
});

router.get("/gallery", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  ensureTeamGalleryTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer la galerie");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const sql = `
        SELECT id, image_url, caption, created_at
        FROM team_gallery
        WHERE team_id = ?
        ORDER BY created_at DESC, id DESC
      `;

      db.query(sql, [team.id], (err, gallery) => {
        if (err) {
          return sendDbError(res, err, "Impossible de charger la galerie");
        }

        res.json(gallery);
      });
    });
  });
});

router.post("/gallery", verifyToken, uploadGalleryPhoto, async (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Action reservee aux equipes" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Aucune photo envoyee" });
  }

  let imageUrl;
  try {
    imageUrl = await uploadImage(req.file, "footlink/team-gallery");
  } catch (err) {
    if (err.code === "CLOUDINARY_NOT_CONFIGURED") {
      return res.status(500).json({ message: err.message });
    }

    return res.status(500).json({
      message:
        err.message ||
        "Impossible de televerser la photo. Verifie la configuration Cloudinary.",
      code: err.code,
    });
  }

  ensureTeamGalleryTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer la galerie");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      db.query(
        "SELECT COUNT(*) AS total FROM team_gallery WHERE team_id = ?",
        [team.id],
        (countErr, countResult) => {
          if (countErr) {
            return sendDbError(res, countErr, "Impossible de verifier la galerie");
          }

          if (Number(countResult[0]?.total || 0) >= MAX_GALLERY_PHOTOS) {
            return res.status(400).json({
              message: `La galerie est limitee a ${MAX_GALLERY_PHOTOS} photos par club.`,
            });
          }

      const caption =
        typeof req.body.caption === "string"
          ? req.body.caption.trim().slice(0, 160)
          : "";
      const sql = `
        INSERT INTO team_gallery (team_id, image_url, caption)
        VALUES (?, ?, ?)
      `;

      db.query(sql, [team.id, imageUrl, caption || null], (err, result) => {
        if (err) {
          return sendDbError(res, err, "Impossible d'ajouter la photo");
        }

        res.json({
          message: "Photo ajoutee a la galerie",
          photo: {
            id: result.insertId,
            team_id: team.id,
            image_url: imageUrl,
            caption: caption || null,
          },
        });
      });
        }
      );
    });
  });
});

router.delete("/gallery/:photoId", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Action reservee aux equipes" });
  }

  ensureTeamGalleryTable((tableErr) => {
    if (tableErr) {
      return sendDbError(res, tableErr, "Impossible de preparer la galerie");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const findSql = `
        SELECT id, image_url
        FROM team_gallery
        WHERE id = ? AND team_id = ?
        LIMIT 1
      `;

      db.query(findSql, [req.params.photoId, team.id], (findErr, result) => {
        if (findErr) {
          return sendDbError(res, findErr, "Impossible de verifier la photo");
        }

        if (result.length === 0) {
          return res.status(404).json({ message: "Photo introuvable" });
        }

        const photo = result[0];
        const deleteSql = "DELETE FROM team_gallery WHERE id = ? AND team_id = ?";
        db.query(deleteSql, [photo.id, team.id], (deleteErr) => {
          if (deleteErr) {
            return sendDbError(res, deleteErr, "Impossible de supprimer la photo");
          }

          if (photo.image_url && photo.image_url.startsWith("/uploads/")) {
            const imagePath = path.join(
              __dirname,
              "..",
              photo.image_url.replace(/^[/\\]+/, "")
            );
            fs.unlink(imagePath, () => {});
          }

          res.json({ message: "Photo supprimee" });
        });
      });
    });
  });
});

router.get("/former-members", verifyToken, (req, res) => {
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
          p.id,
          p.position,
          p.city,
          p.profile_photo,
          p.club_role,
          u.name,
          COUNT(DISTINCT ms.match_id) AS matches,
          COALESCE(SUM(ms.goals), 0) AS goals,
          COALESCE(SUM(ms.assists), 0) AS assists,
          COALESCE(SUM(ms.yellow_cards), 0) + COALESCE(SUM(ms.red_cards), 0) AS cards
        FROM match_stats ms
        JOIN matches m ON m.id = ms.match_id
        JOIN players p ON p.id = ms.player_id
        JOIN users u ON u.id = p.user_id
        WHERE m.team_id = ?
          AND NOT EXISTS (
            SELECT 1
            FROM player_team_memberships ptm
            WHERE ptm.player_id = p.id AND ptm.team_id = ? AND ptm.active = 1
          )
        GROUP BY p.id, p.position, p.city, p.profile_photo, p.club_role, u.name
        ORDER BY goals DESC, assists DESC, u.name
      `;

      db.query(sql, [team.id, team.id], (err, formerMembers) => {
        if (err) {
          return sendDbError(res, err, "Impossible de charger les anciens membres");
        }

        res.json(formerMembers);
      });
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
        addPlayerMembership(team.id, invitation.player_id, "Joueur", (membershipErr) => {
          if (membershipErr) {
            return sendDbError(res, membershipErr, "Impossible d'ajouter le joueur");
          }

          const updatePlayerSql = `
            UPDATE players
            SET team_name = CASE
                  WHEN team_name IS NULL OR team_name = '' THEN ?
                  ELSE team_name
                END,
                no_team = 0
            WHERE id = ?
          `;

          db.query(updatePlayerSql, [team.team_name, invitation.player_id], (playerErr) => {
            if (playerErr) {
              return sendDbError(res, playerErr, "Impossible de mettre a jour le joueur");
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
        UPDATE player_team_memberships
        SET active = 0, left_at = NOW()
        WHERE player_id = ? AND team_id = ? AND active = 1
      `;

    db.query(sql, [req.params.playerId, team.id], (err, result) => {
      if (err) {
        return sendDbError(res, err, "Impossible de retirer le joueur");
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Joueur introuvable dans cette equipe" });
      }

      const clearLegacySql = `
        UPDATE players p
        SET p.team_name = (
              SELECT t.team_name
              FROM player_team_memberships ptm
              JOIN teams t ON t.id = ptm.team_id
              WHERE ptm.player_id = p.id AND ptm.active = 1
              ORDER BY ptm.joined_at ASC, ptm.id ASC
              LIMIT 1
            ),
            p.no_team = NOT EXISTS (
              SELECT 1
              FROM player_team_memberships ptm2
              WHERE ptm2.player_id = p.id AND ptm2.active = 1
            )
        WHERE p.id = ?
      `;

      db.query(clearLegacySql, [req.params.playerId], (legacyErr) => {
        if (legacyErr) {
          return sendDbError(res, legacyErr, "Impossible de mettre a jour le joueur");
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
  });

router.put("/players/:playerId/role", verifyToken, (req, res) => {
  if (req.user.role !== "team") {
    return res.status(403).json({ message: "Acces reserve aux equipes" });
  }

  const { club_role } = req.body;
  if (!CLUB_ROLES.has(club_role)) {
    return res.status(400).json({ message: "Role invalide" });
  }

  ensurePlayerTeamColumns((columnErr) => {
    if (columnErr) {
      return sendDbError(res, columnErr, "Impossible de preparer les roles");
    }

    getTeamForUser(req.user.id, (teamErr, team) => {
      if (teamErr) {
        return sendDbError(res, teamErr, "Impossible de charger l'equipe");
      }

      if (!team) {
        return res.status(404).json({ message: "Equipe introuvable" });
      }

      const sql = `
        UPDATE player_team_memberships
        SET club_role = ?
        WHERE player_id = ? AND team_id = ? AND active = 1
      `;

      db.query(sql, [club_role, req.params.playerId, team.id], (err, result) => {
        if (err) {
          return sendDbError(res, err, "Impossible de mettre a jour le role");
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Membre introuvable dans ce club" });
        }

        res.json({ message: "Role mis a jour", club_role });
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
    man_of_match_player_id,
  } = req.body;
  const playerId = Number(req.params.playerId);
  const matchId = Number(match_id);
  const statValues = {
    goals: parseStatValue(goals),
    assists: parseStatValue(assists),
    yellow_cards: parseStatValue(yellow_cards),
    red_cards: parseStatValue(red_cards),
  };

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ message: "Joueur invalide" });
  }

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ message: "match_id est requis" });
  }

  if (Object.values(statValues).some((value) => value === null)) {
    return res.status(400).json({ message: "Les stats doivent etre des nombres positifs" });
  }

  getTeamForUser(req.user.id, (teamErr, team) => {
    if (teamErr) {
      return sendDbError(res, teamErr, "Impossible de charger l'equipe");
    }

    if (!team) {
      return res.status(404).json({ message: "Equipe introuvable" });
    }

    const checkSql = `
      SELECT p.id
      FROM player_team_memberships ptm
      JOIN players p ON p.id = ptm.player_id
      JOIN matches m ON m.id = ?
      WHERE ptm.player_id = ?
        AND ptm.team_id = ?
        AND ptm.active = 1
        AND m.team_id = ?
    `;

    db.query(checkSql, [matchId, playerId, team.id, team.id], (checkErr, result) => {
      if (checkErr) {
        return sendDbError(res, checkErr, "Impossible de verifier le joueur");
      }

      if (result.length === 0) {
        return res.status(404).json({ message: "Joueur introuvable dans cette equipe" });
      }

      const finishStatsSave = (message, mode, statId, duplicateIds = []) => {
        if (duplicateIds.length === 0) {
          return res.json({ message, mode, stat_id: statId });
        }

        db.query(
          "DELETE FROM match_stats WHERE id IN (?)",
          [duplicateIds],
          (deleteErr) => {
            if (deleteErr) {
              return sendDbError(res, deleteErr, "Impossible de nettoyer les stats en double");
            }

            res.json({ message, mode, stat_id: statId });
          }
        );
      };

      const saveStats = () => {
        const existingSql = `
          SELECT id
          FROM match_stats
          WHERE match_id = ? AND player_id = ?
          ORDER BY id ASC
        `;

        db.query(existingSql, [matchId, playerId], (existingErr, existingRows) => {
          if (existingErr) {
            return sendDbError(res, existingErr, "Impossible de verifier les stats");
          }

          if (existingRows.length > 0) {
            const statId = existingRows[0].id;
            const duplicateIds = existingRows.slice(1).map((row) => row.id);
            const updateSql = `
              UPDATE match_stats
              SET goals = ?, assists = ?, yellow_cards = ?, red_cards = ?
              WHERE id = ?
            `;

            return db.query(
              updateSql,
              [
                statValues.goals,
                statValues.assists,
                statValues.yellow_cards,
                statValues.red_cards,
                statId,
              ],
              (updateErr) => {
                if (updateErr) {
                  return sendDbError(res, updateErr, "Impossible de modifier les stats");
                }

                finishStatsSave("Stats mises a jour", "updated", statId, duplicateIds);
              }
            );
          }

          const insertSql = `
            INSERT INTO match_stats
            (match_id, player_id, goals, assists, yellow_cards, red_cards)
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertSql,
            [
              matchId,
              playerId,
              statValues.goals,
              statValues.assists,
              statValues.yellow_cards,
              statValues.red_cards,
            ],
            (insertErr, insertResult) => {
              if (insertErr) {
                return sendDbError(res, insertErr, "Impossible d'ajouter les stats");
              }

              res.json({
                message: "Stats ajoutees",
                mode: "created",
                stat_id: insertResult.insertId,
              });
            }
          );
        });
      };

      const motmPlayerId = Number(man_of_match_player_id);
      if (!motmPlayerId) {
        return saveStats();
      }

      ensureMatchManOfMatchColumn((columnErr) => {
        if (columnErr) {
          return sendDbError(
            res,
            columnErr,
            "Impossible de preparer l'homme du match"
          );
        }

        const motmSql = `
          SELECT player_id AS id
          FROM player_team_memberships
          WHERE player_id = ? AND team_id = ? AND active = 1
          LIMIT 1
        `;

        db.query(motmSql, [motmPlayerId, team.id], (motmErr, motmResult) => {
          if (motmErr) {
            return sendDbError(res, motmErr, "Impossible de verifier l'homme du match");
          }

          if (motmResult.length === 0) {
            return res.status(400).json({ message: "Homme du match invalide" });
          }

          db.query(
            "UPDATE matches SET man_of_match_player_id = ? WHERE id = ? AND team_id = ?",
            [motmPlayerId, matchId, team.id],
            (updateErr) => {
              if (updateErr) {
                return sendDbError(
                  res,
                  updateErr,
                  "Impossible de mettre a jour l'homme du match"
                );
              }

              saveStats();
            }
          );
        });
      });
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

      ensureTeamGalleryTable((galleryTableErr) => {
        if (galleryTableErr) {
          return sendDbError(res, galleryTableErr, "Impossible de preparer la galerie");
        }

      db.beginTransaction((transactionErr) => {
        if (transactionErr) {
          return sendDbError(res, transactionErr, "Impossible de demarrer la suppression");
        }

        const rollback = (message) => {
          db.rollback(() => res.status(500).json({ message }));
        };

        db.query("DELETE FROM player_team_memberships WHERE team_id = ?", [team.id], (membershipErr) => {
          if (membershipErr) return rollback("Impossible de supprimer les appartenances");

        db.query("DELETE FROM team_gallery WHERE team_id = ?", [team.id], (galleryErr) => {
          if (galleryErr) return rollback("Impossible de supprimer la galerie");

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
    });
  });
});

module.exports = router;
