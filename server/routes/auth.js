const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { ensureCoreTables } = require("../dbSchema");
const { sendEmail } = require("../config/email");

const sendDbError = (res, err, fallbackMessage) => {
  console.log(err);

  if (res.headersSent) return;

  res.status(500).json({
    message: fallbackMessage,
    error: err.sqlMessage || err.message,
    code: err.code,
  });
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
]);

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeEmail = (value) => cleanText(value).toLowerCase();

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

const createSecureToken = () => crypto.randomBytes(32).toString("hex");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const addHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);

const isDisposableEmail = (email) => {
  const domain = email.split("@")[1];
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
};

const validateBaseAccount = ({ name, email, password }) => {
  if (!NAME_REGEX.test(name)) {
    return "Le nom doit contenir au moins 2 lettres et aucun chiffre.";
  }

  if (!EMAIL_REGEX.test(email) || isDisposableEmail(email)) {
    return "Entre une adresse email valide et non temporaire.";
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return "Le mot de passe doit contenir au moins 8 caracteres, avec lettres et chiffres.";
  }

  return null;
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

const ensureUserRoleColumn = (callback) => {
  const checkSql = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
  `;

  db.query(checkSql, (checkErr, result) => {
    if (checkErr) return callback(checkErr);

    if (result.length === 0) {
      return db.query(
        "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'player'",
        callback
      );
    }

    db.query(
      "ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'player'",
      callback
    );
  });
};

const ensureUserSecurityColumns = (callback) => {
  const columns = [
    ["email_verified", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["email_verification_token", "VARCHAR(128)"],
    ["email_verification_expires", "DATETIME"],
    ["reset_password_token", "VARCHAR(128)"],
    ["reset_password_expires", "DATETIME"],
  ];

  const runNext = (index) => {
    if (index >= columns.length) return callback(null);

    const [columnName, columnDefinition] = columns[index];
    ensureColumn("users", columnName, columnDefinition, (err) => {
      if (err) return callback(err);
      runNext(index + 1);
    });
  };

  runNext(0);
};

const ensureTeamsTable = (callback) => {
  const sql = `
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      team_name VARCHAR(100),
      city VARCHAR(100),
      level VARCHAR(100),
      category VARCHAR(100),
      player_count INT DEFAULT 0,
      bio TEXT,
      logo_photo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, callback);
};

const ensureTeamColumns = (callback) => {
  const columns = [
    ["user_id", "INT"],
    ["team_name", "VARCHAR(100)"],
    ["city", "VARCHAR(100)"],
    ["level", "VARCHAR(100)"],
    ["category", "VARCHAR(100)"],
    ["player_count", "INT DEFAULT 0"],
    ["bio", "TEXT"],
    ["logo_photo", "VARCHAR(255)"],
  ];

  const runNext = (index) => {
    if (index >= columns.length) return callback(null);

    const [columnName, columnDefinition] = columns[index];
    ensureColumn("teams", columnName, columnDefinition, (err) => {
      if (err) return callback(err);
      runNext(index + 1);
    });
  };

  runNext(0);
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

const checkTeamExists = (teamName, callback) => {
  const sql = `SELECT * FROM teams WHERE LOWER(team_name) = LOWER(?) LIMIT 1`;
  db.query(sql, [teamName], (err, result) => {
    if (err) return callback(err);
    callback(null, result.length > 0 ? result[0] : null);
  });
};

const sendVerificationEmail = (user, token) => {
  const verificationUrl = `${getFrontendUrl()}/verify-email?token=${token}`;

  return sendEmail({
    to: user.email,
    subject: "Verifie ton email FootLink",
    text: `Salut ${user.name}, verifie ton email FootLink ici: ${verificationUrl}`,
    html: `
      <p>Salut ${user.name},</p>
      <p>Confirme ton adresse email pour activer ton compte FootLink.</p>
      <p><a href="${verificationUrl}">Verifier mon email</a></p>
    `,
  });
};

const sendPasswordResetEmail = (user, token) => {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;

  return sendEmail({
    to: user.email,
    subject: "Reinitialisation de ton mot de passe FootLink",
    text: `Salut ${user.name}, choisis un nouveau mot de passe ici: ${resetUrl}`,
    html: `
      <p>Salut ${user.name},</p>
      <p>Tu peux choisir un nouveau mot de passe FootLink avec ce lien.</p>
      <p><a href="${resetUrl}">Reinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans 1 heure.</p>
    `,
  });
};

const createUser = async ({ name, email, password, role, verificationToken }, callback) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationHash = hashToken(verificationToken);
  const verificationExpires = addHours(24);
  const sql = `
    INSERT INTO users
    (name, email, password, role, email_verified, email_verification_token, email_verification_expires)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `;

  db.query(
    sql,
    [name, email, hashedPassword, role, verificationHash, verificationExpires],
    callback
  );
};

// REGISTER PLAYER
router.post("/register/player", (req, res) => {
  const {
    name: rawName,
    email: rawEmail,
    password,
    position,
    age,
    city: rawCity,
    height,
    preferred_foot,
    team_name,
    no_team,
    bio,
  } = req.body;

  const name = cleanText(rawName);
  const email = normalizeEmail(rawEmail);
  const city = cleanText(rawCity);
  const bioText = cleanText(bio);
  const numericAge = Number(age);
  const numericHeight = height ? Number(height) : null;

  if (!name || !email || !password || !position || !age || !city) {
    return res.status(400).json({ message: "Tous les champs sont requis" });
  }

  const baseValidationError = validateBaseAccount({ name, email, password });
  if (baseValidationError) {
    return res.status(400).json({ message: baseValidationError });
  }

  if (/\d/.test(city)) {
    return res.status(400).json({ message: "La ville ne doit pas contenir de chiffre" });
  }

  if (
    !["Gardien", "Defenseur", "Milieu", "Attaquant"].includes(position) ||
    !["Droit", "Gauche", "Deux pieds"].includes(preferred_foot)
  ) {
    return res.status(400).json({ message: "Poste ou pied fort invalide" });
  }

  if (!Number.isInteger(numericAge) || numericAge < 5 || numericAge > 60) {
    return res.status(400).json({ message: "L'age doit etre compris entre 5 et 60 ans" });
  }

  if (numericHeight && (numericHeight < 100 || numericHeight > 230)) {
    return res.status(400).json({ message: "La taille doit etre comprise entre 100 et 230 cm" });
  }

  if (!no_team && !team_name) {
    return res.status(400).json({ message: "Indique ton equipe ou coche sans equipe" });
  }

  ensureCoreTables()
    .then(() => ensureUserRoleColumn(async (roleErr) => {
    if (roleErr) {
      return sendDbError(res, roleErr, "Impossible de preparer la table users");
    }

    ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de preparer la verification email");
      }

    ensurePlayerTeamColumns(async (playerColumnsErr) => {
      if (playerColumnsErr) {
        return sendDbError(
          res,
          playerColumnsErr,
          "Impossible de preparer la table players"
        );
      }

      const finalTeamName = no_team ? null : cleanText(team_name);

      const createPlayerProfile = (userId, verificationToken) => {
        const playerSql = `
          INSERT INTO players
          (user_id, position, age, city, height, preferred_foot, team_name, no_team, bio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
          playerSql,
          [
            userId,
            position,
            numericAge,
            city,
            numericHeight,
            preferred_foot || null,
            finalTeamName,
            no_team ? 1 : 0,
            bioText || null,
          ],
          (playerErr) => {
            if (playerErr) {
              return sendDbError(
                res,
                playerErr,
                "Impossible de creer le profil joueur"
              );
            }

            sendVerificationEmail({ name, email }, verificationToken).catch((mailErr) =>
              console.log("Email verification non envoye", mailErr)
            );

            res.json({
              message: "Compte joueur cree. Verifie ton email avant de te connecter.",
            });
          }
        );
      };

      const processPlayerCreation = () => {
        const verificationToken = createSecureToken();

        createUser(
          { name, email, password, role: "player", verificationToken },
          (userErr, result) => {
            if (userErr) {
              if (userErr.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ message: "Cet email est deja utilise" });
              }

              return sendDbError(res, userErr, "Impossible de creer le compte");
            }

            createPlayerProfile(result.insertId, verificationToken);
          }
        );
      };

      if (!no_team) {
        checkTeamExists(finalTeamName, (teamErr, team) => {
          if (teamErr) {
            return sendDbError(res, teamErr, "Impossible de verifier le club");
          }

          if (!team) {
            return res.status(400).json({ message: "Club introuvable ou non enregistre" });
          }

          processPlayerCreation();
        });
      } else {
        processPlayerCreation();
      }
    });
    });
  }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

// REGISTER TEAM
router.post("/register/team", (req, res) => {
  const {
    name: rawName,
    email: rawEmail,
    password,
    team_name: rawTeamName,
    city: rawCity,
    level: rawLevel,
    category: rawCategory,
    bio,
  } = req.body;

  const name = cleanText(rawName);
  const email = normalizeEmail(rawEmail);
  const team_name = cleanText(rawTeamName);
  const city = cleanText(rawCity);
  const level = cleanText(rawLevel);
  const category = cleanText(rawCategory);
  const bioText = cleanText(bio);

  if (!name || !email || !password || !team_name || !city || !level || !category) {
    return res.status(400).json({ message: "Tous les champs sont requis" });
  }

  const baseValidationError = validateBaseAccount({ name, email, password });
  if (baseValidationError) {
    return res.status(400).json({ message: baseValidationError });
  }

  if (/\d/.test(city)) {
    return res.status(400).json({ message: "La ville ne doit pas contenir de chiffre" });
  }

  ensureCoreTables()
    .then(() => ensureUserRoleColumn((roleErr) => {
    if (roleErr) {
      return sendDbError(res, roleErr, "Impossible de preparer la table users");
    }

    ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de preparer la verification email");
      }

    ensureTeamsTable((teamTableErr) => {
      if (teamTableErr) {
        return sendDbError(res, teamTableErr, "Impossible de creer la table teams");
      }

      ensureTeamColumns(async (teamColumnsErr) => {
        if (teamColumnsErr) {
          return sendDbError(
            res,
            teamColumnsErr,
            "Impossible de preparer les colonnes equipe"
          );
        }

        try {
          const verificationToken = createSecureToken();

          await createUser(
            { name, email, password, role: "team", verificationToken },
            (userErr, result) => {
              if (userErr) {
                if (userErr.code === "ER_DUP_ENTRY") {
                  return res
                    .status(409)
                    .json({ message: "Cet email est deja utilise" });
                }

                return sendDbError(res, userErr, "Impossible de creer le compte");
              }

              const teamSql = `
                INSERT INTO teams
                (user_id, team_name, city, level, category, bio)
                VALUES (?, ?, ?, ?, ?, ?)
              `;

              db.query(
                teamSql,
                [
                  result.insertId,
                  team_name,
                  city,
                  level,
                  category,
                  bioText || null,
                ],
                (insertTeamErr) => {
                  if (insertTeamErr) {
                    return sendDbError(
                      res,
                      insertTeamErr,
                      "Impossible de creer le profil equipe"
                    );
                  }

                  sendVerificationEmail({ name, email }, verificationToken).catch((mailErr) =>
                    console.log("Email verification non envoye", mailErr)
                  );

                  res.json({
                    message: "Compte equipe cree. Verifie ton email avant de te connecter.",
                  });
                }
              );
            }
          );
        } catch (err) {
          sendDbError(res, err, "Impossible de creer le compte equipe");
        }
      });
    });
    });
  }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

// LOGIN
router.post("/login", (req, res) => {
  const { email: rawEmail, password } = req.body;
  const email = normalizeEmail(rawEmail);
  const sql = "SELECT * FROM users WHERE email = ?";

  if (!EMAIL_REGEX.test(email) || !password) {
    return res.status(400).json({ message: "Email ou mot de passe invalide" });
  }

  ensureCoreTables()
    .then(() => ensureUserRoleColumn((roleErr) => {
      if (roleErr) {
        return sendDbError(res, roleErr, "Impossible de preparer la table users");
      }

      ensureUserSecurityColumns((securityErr) => {
        if (securityErr) {
          return sendDbError(res, securityErr, "Impossible de preparer la verification email");
        }

      db.query(sql, [email], async (err, result) => {
        if (err) return sendDbError(res, err, "Erreur connexion");

        if (result.length === 0) {
          return res.status(404).json({ message: "Utilisateur non trouve" });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return res.status(400).json({ message: "Mot de passe incorrect" });
        }

        if (Number(user.email_verified) !== 1) {
          return res.status(403).json({
            message: "Email non verifie. Verifie ta boite mail avant de te connecter.",
          });
        }

        const role = user.role || "player";
        const token = jwt.sign(
          { id: user.id, role },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );

        res.json({
          message: "Connexion reussie",
          token,
          user: {
            id: user.id,
            name: user.name,
            role,
          },
        });
      });
      });
    }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

router.post("/verify-email", (req, res) => {
  const token = cleanText(req.body.token);

  if (!token) {
    return res.status(400).json({ message: "Lien de verification invalide" });
  }

  ensureCoreTables()
    .then(() => ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de verifier l'email");
      }

      const sql = `
        SELECT id
        FROM users
        WHERE email_verification_token = ?
          AND email_verification_expires > NOW()
        LIMIT 1
      `;

      db.query(sql, [hashToken(token)], (err, result) => {
        if (err) return sendDbError(res, err, "Impossible de verifier l'email");

        if (result.length === 0) {
          return res.status(400).json({ message: "Lien de verification invalide ou expire" });
        }

        db.query(
          `
            UPDATE users
            SET email_verified = 1,
                email_verification_token = NULL,
                email_verification_expires = NULL
            WHERE id = ?
          `,
          [result[0].id],
          (updateErr) => {
            if (updateErr) return sendDbError(res, updateErr, "Impossible de verifier l'email");
            res.json({ message: "Email verifie. Tu peux maintenant te connecter." });
          }
        );
      });
    }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

router.post("/resend-verification", (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Email invalide" });
  }

  ensureCoreTables()
    .then(() => ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de renvoyer l'email");
      }

      db.query("SELECT id, name, email, email_verified FROM users WHERE email = ? LIMIT 1", [email], (err, result) => {
        if (err) return sendDbError(res, err, "Impossible de renvoyer l'email");

        if (result.length === 0) {
          return res.json({ message: "Si ce compte existe, un email vient d'etre envoye." });
        }

        const user = result[0];
        if (Number(user.email_verified) === 1) {
          return res.json({ message: "Cet email est deja verifie." });
        }

        const verificationToken = createSecureToken();
        db.query(
          `
            UPDATE users
            SET email_verification_token = ?,
                email_verification_expires = ?
            WHERE id = ?
          `,
          [hashToken(verificationToken), addHours(24), user.id],
          (updateErr) => {
            if (updateErr) return sendDbError(res, updateErr, "Impossible de renvoyer l'email");

            sendVerificationEmail(user, verificationToken).catch((mailErr) =>
              console.log("Email verification non envoye", mailErr)
            );

            res.json({ message: "Email de verification renvoye." });
          }
        );
      });
    }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

router.post("/forgot-password", (req, res) => {
  const email = normalizeEmail(req.body.email);
  const neutralMessage =
    "Si un compte existe avec cet email, un lien de reinitialisation vient d'etre envoye.";

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Email invalide" });
  }

  ensureCoreTables()
    .then(() => ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de preparer la reinitialisation");
      }

      db.query("SELECT id, name, email FROM users WHERE email = ? LIMIT 1", [email], (err, result) => {
        if (err) return sendDbError(res, err, "Impossible de preparer la reinitialisation");
        if (result.length === 0) return res.json({ message: neutralMessage });

        const user = result[0];
        const resetToken = createSecureToken();

        db.query(
          `
            UPDATE users
            SET reset_password_token = ?,
                reset_password_expires = ?
            WHERE id = ?
          `,
          [hashToken(resetToken), addHours(1), user.id],
          (updateErr) => {
            if (updateErr) {
              return sendDbError(res, updateErr, "Impossible de preparer la reinitialisation");
            }

            sendPasswordResetEmail(user, resetToken).catch((mailErr) =>
              console.log("Email reset non envoye", mailErr)
            );

            res.json({ message: neutralMessage });
          }
        );
      });
    }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

router.post("/reset-password", (req, res) => {
  const token = cleanText(req.body.token);
  const { password } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Lien de reinitialisation invalide" });
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return res.status(400).json({
      message: "Le mot de passe doit contenir au moins 8 caracteres, avec lettres et chiffres.",
    });
  }

  ensureCoreTables()
    .then(() => ensureUserSecurityColumns((securityErr) => {
      if (securityErr) {
        return sendDbError(res, securityErr, "Impossible de reinitialiser le mot de passe");
      }

      const sql = `
        SELECT id
        FROM users
        WHERE reset_password_token = ?
          AND reset_password_expires > NOW()
        LIMIT 1
      `;

      db.query(sql, [hashToken(token)], async (err, result) => {
        if (err) return sendDbError(res, err, "Impossible de reinitialiser le mot de passe");

        if (result.length === 0) {
          return res.status(400).json({ message: "Lien de reinitialisation invalide ou expire" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        db.query(
          `
            UPDATE users
            SET password = ?,
                reset_password_token = NULL,
                reset_password_expires = NULL
            WHERE id = ?
          `,
          [hashedPassword, result[0].id],
          (updateErr) => {
            if (updateErr) {
              return sendDbError(res, updateErr, "Impossible de reinitialiser le mot de passe");
            }

            res.json({ message: "Mot de passe mis a jour. Tu peux te connecter." });
          }
        );
      });
    }))
    .catch((schemaErr) =>
      sendDbError(res, schemaErr, "Impossible de preparer la base de donnees")
    );
});

module.exports = router;
