import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
const DISPOSABLE_EMAIL_DOMAINS = [
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "yopmail.com",
];

const isDisposableEmail = (value) => {
  const domain = value.trim().toLowerCase().split("@")[1];
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
};

function Register({ accountType }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [position, setPosition] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [height, setHeight] = useState("");
  const [preferredFoot, setPreferredFoot] = useState("");
  const [playerTeamId, setPlayerTeamId] = useState("");
  const [playerTeamName, setPlayerTeamName] = useState("");
  const [noTeam, setNoTeam] = useState(false);
  const [bio, setBio] = useState("");
  const [teamName, setTeamName] = useState("");
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [formMessage, setFormMessage] = useState(null);
  const navigate = useNavigate();
  const { dashboardPath, isAuthenticated } = useAuth();

  const isTeam = accountType === "team";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(dashboardPath, { replace: true });
    }
  }, [dashboardPath, isAuthenticated, navigate]);

  useEffect(() => {
    if (isTeam) return;

    const loadClubs = async () => {
      try {
        setLoadingClubs(true);
        const res = await axios.get(`${API_URL}/api/team/list`);
        setClubs(res.data || []);
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingClubs(false);
      }
    };

    loadClubs();
  }, [isTeam]);

  const handleClubSelect = (clubId) => {
    const club = clubs.find((c) => c.id === clubId);
    setPlayerTeamId(clubId);
    setPlayerTeamName(club ? club.team_name : "");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCity = city.trim();
    const cleanTeamName = teamName.trim();
    const cleanBio = bio.trim();
    const cleanLevel = level.trim();
    const cleanCategory = category.trim();

    if (!NAME_REGEX.test(cleanName)) {
      setFormMessage({
        type: "error",
        text: "Le nom doit contenir au moins 2 lettres et aucun chiffre.",
      });
      return;
    }

    if (!EMAIL_REGEX.test(cleanEmail) || isDisposableEmail(cleanEmail)) {
      setFormMessage({
        type: "error",
        text: "Entre une adresse email valide et non temporaire.",
      });
      return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setFormMessage({
        type: "error",
        text: "Le mot de passe doit contenir au moins 8 caracteres, avec lettres et chiffres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFormMessage({
        type: "error",
        text: "Les mots de passe ne correspondent pas.",
      });
      return;
    }

    if (!cleanCity || /\d/.test(cleanCity)) {
      setFormMessage({
        type: "error",
        text: "La ville est obligatoire et ne doit pas contenir de chiffre.",
      });
      return;
    }

    if (!isTeam) {
      const numericAge = Number(age);
      const numericHeight = height ? Number(height) : null;

      if (!position || !preferredFoot) {
        setFormMessage({
          type: "error",
          text: "Selectionne ton poste et ton pied fort.",
        });
        return;
      }

      if (!Number.isInteger(numericAge) || numericAge < 5 || numericAge > 60) {
        setFormMessage({
          type: "error",
          text: "L'age doit etre compris entre 5 et 60 ans.",
        });
        return;
      }

      if (numericHeight && (numericHeight < 100 || numericHeight > 230)) {
        setFormMessage({
          type: "error",
          text: "La taille doit etre comprise entre 100 et 230 cm.",
        });
        return;
      }
    }

    if (isTeam && (!cleanTeamName || !cleanLevel || !cleanCategory)) {
      setFormMessage({
        type: "error",
        text: "Nom d'equipe, niveau et categorie sont obligatoires.",
      });
      return;
    }

    const endpoint = isTeam
      ? `${API_URL}/api/auth/register/team`
      : `${API_URL}/api/auth/register/player`;

    const payload = isTeam
      ? {
          name: cleanName,
          email: cleanEmail,
          password,
          team_name: cleanTeamName,
          city: cleanCity,
          level: cleanLevel,
          category: cleanCategory,
          bio: cleanBio,
        }
      : {
          name: cleanName,
          email: cleanEmail,
          password,
          position,
          age,
          city: cleanCity,
          height,
          preferred_foot: preferredFoot,
          team_name: playerTeamName,
          no_team: noTeam,
          bio: cleanBio,
        };

    try {
      setLoading(true);

      await axios.post(endpoint, payload);

      navigate("/login", {
        replace: true,
        state: {
          message: "Compte cree avec succes. Tu peux maintenant te connecter.",
        },
      });
    } catch (err) {
      console.log(err);
      const message = err.response?.data?.error
        ? `${err.response.data.message}: ${err.response.data.error}`
        : err.response?.data?.message || "Erreur lors de l'inscription";

      setFormMessage({ type: "error", text: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form register-form" onSubmit={handleRegister}>
        <button className="back-btn" type="button" onClick={() => navigate("/")}>
          Retour
        </button>

        <h2>{isTeam ? "Inscription Equipe" : "Inscription Joueur"}</h2>

        {formMessage && (
          <p className={`auth-notice auth-notice-${formMessage.type}`}>
            {formMessage.text}
          </p>
        )}

        <input
          type="text"
          placeholder={isTeam ? "Nom du responsable" : "Nom complet"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength="2"
          pattern="[A-Za-zÀ-ÖØ-öø-ÿ' -]+"
          title="Le nom ne doit pas contenir de chiffre."
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength="8"
          title="Au moins 8 caracteres, avec lettres et chiffres."
          required
        />

        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength="8"
          required
        />

        {isTeam ? (
          <>
            <input
              type="text"
              placeholder="Nom de l'equipe"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              pattern="[A-Za-zÀ-ÖØ-öø-ÿ' -]+"
              title="La ville ne doit pas contenir de chiffre."
              required
            />

            <input
              type="text"
              placeholder="Niveau"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Categorie"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              required
            >
              <option value="">Poste</option>
              <option value="Gardien">Gardien</option>
              <option value="Defenseur">Defenseur</option>
              <option value="Milieu">Milieu</option>
              <option value="Attaquant">Attaquant</option>
            </select>

            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min="5"
              max="60"
              required
            />

            <input
              type="text"
              placeholder="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              pattern="[A-Za-zÀ-ÖØ-öø-ÿ' -]+"
              title="La ville ne doit pas contenir de chiffre."
              required
            />

            <input
              type="number"
              placeholder="Taille en cm"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              min="100"
              max="230"
            />

            <select
              value={preferredFoot}
              onChange={(e) => setPreferredFoot(e.target.value)}
              required
            >
              <option value="">Pied fort</option>
              <option value="Droit">Droit</option>
              <option value="Gauche">Gauche</option>
              <option value="Deux pieds">Deux pieds</option>
            </select>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={noTeam}
                onChange={(e) => setNoTeam(e.target.checked)}
              />
              Je n'ai pas d'equipe
            </label>

            {!noTeam && (
              <>
                {loadingClubs ? (
                  <p>Chargement des clubs...</p>
                ) : clubs.length > 0 ? (
                  <select
                    value={playerTeamId}
                    onChange={(e) => handleClubSelect(Number(e.target.value))}
                    required
                  >
                    <option value="">-- Selectionne ton club --</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.team_name} ({club.city})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="info-text">Aucun club enregistre pour le moment.</p>
                )}
              </>
            )}
          </>
        )}

        <textarea
          placeholder={isTeam ? "Description de l'equipe" : "Bio courte"}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows="4"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Creation..." : "Creer mon compte"}
        </button>
      </form>
    </div>
  );
}

export default Register;

