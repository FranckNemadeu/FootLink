const express = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const playerController = require("../controllers/playerController");
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
    cb(null, `player-${req.user.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Le fichier doit etre une image"));
    }

    cb(null, true);
  },
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const uploadPhoto = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.message || "Erreur lors du televersement de la photo",
      });
    }

    next();
  });
};

// créer profil joueur
router.post("/", verifyToken, playerController.createPlayer);

router.get("/public/featured", playerController.getPublicPlayers);

router.get("/public/:playerId", playerController.getPublicPlayer);

// rechercher joueurs
router.get("/search", verifyToken, playerController.searchPlayers);

// récupérer profil joueur
router.get("/stats", verifyToken, playerController.getPlayerStats);

router.post(
  "/photo",
  verifyToken,
  uploadPhoto,
  playerController.uploadPlayerPhoto
);

router.put("/team", verifyToken, playerController.changePlayerTeam);

router.put("/", verifyToken, playerController.updatePlayer);

router.post("/leave-team", verifyToken, playerController.leaveTeam);

router.get("/invitations", verifyToken, playerController.getTeamInvitations);

router.delete("/account", verifyToken, (req, res) => {
  const { password } = req.body;

  if (req.user.role !== "player") {
    return res.status(403).json({ message: "Action reservee aux joueurs" });
  }

  if (!password) {
    return res.status(400).json({ message: "Mot de passe requis" });
  }

  const userSql = "SELECT id, password FROM users WHERE id = ? LIMIT 1";
  db.query(userSql, [req.user.id], async (userErr, users) => {
    if (userErr) {
      return res.status(500).json({ message: "Impossible de verifier le compte" });
    }

    if (users.length === 0) {
      return res.status(404).json({ message: "Compte introuvable" });
    }

    const passwordMatches = await bcrypt.compare(password, users[0].password);
    if (!passwordMatches) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    const playerSql = "SELECT id, profile_photo FROM players WHERE user_id = ? LIMIT 1";
    db.query(playerSql, [req.user.id], (playerErr, players) => {
      if (playerErr) {
        return res.status(500).json({ message: "Impossible de charger le profil joueur" });
      }

      if (players.length === 0) {
        return res.status(404).json({ message: "Profil joueur introuvable" });
      }

      const player = players[0];

      db.beginTransaction((transactionErr) => {
        if (transactionErr) {
          return res.status(500).json({ message: "Impossible de demarrer la suppression" });
        }

        const rollback = (message) => {
          db.rollback(() => res.status(500).json({ message }));
        };

        db.query(
          "DELETE FROM team_invitations WHERE player_id = ?",
          [player.id],
          (inviteErr) => {
            if (inviteErr) return rollback("Impossible de supprimer les invitations");

            db.query(
              "DELETE FROM match_stats WHERE player_id = ?",
              [player.id],
              (statsErr) => {
                if (statsErr) return rollback("Impossible de supprimer les stats");

                db.query(
                  "DELETE FROM players WHERE id = ? AND user_id = ?",
                  [player.id, req.user.id],
                  (deletePlayerErr) => {
                    if (deletePlayerErr) return rollback("Impossible de supprimer le profil joueur");

                    db.query(
                      "DELETE FROM users WHERE id = ?",
                      [req.user.id],
                      (deleteUserErr) => {
                        if (deleteUserErr) return rollback("Impossible de supprimer le compte");

                        db.commit((commitErr) => {
                          if (commitErr) return rollback("Impossible de finaliser la suppression");

                          if (player.profile_photo) {
                            const photoPath = path.join(
                              __dirname,
                              "..",
                              player.profile_photo.replace(/^[/\\]+/, "")
                            );
                            fs.unlink(photoPath, () => {});
                          }

                          res.json({ message: "Compte joueur supprime" });
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    });
  });
});

router.post(
  "/invitations/:invitationId/accept",
  verifyToken,
  playerController.acceptTeamInvitation
);

router.post(
  "/invitations/:invitationId/decline",
  verifyToken,
  playerController.declineTeamInvitation
);

router.get("/", verifyToken, playerController.getPlayer);

module.exports = router;

/*
1. express → créer des routes
2. playerController → contient les fonctions pour créer et récupérer le profil de joueur
3. verifyToken → middleware pour vérifier le token JWT et protéger les routes
4. router.post("/") → route pour créer un profil de joueur (POST /api/player)
5. router.get("/") → route pour récupérer le profil de joueur (GET /api/player)
6. Les deux routes utilisent le middleware verifyToken pour s’assurer que l’utilisateur est connecté avant de pouvoir créer ou récupérer son profil de joueur
7. Les fonctions createPlayer et getPlayer dans playerController vont interagir avec la base de données pour insérer ou récupérer les données du joueur
8. module.exports = router → exporte les routes pour les utiliser dans index.js
*/ 
