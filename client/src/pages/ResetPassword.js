import { useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API_URL from "../config/api";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setMessage({
        type: "error",
        text: "Le mot de passe doit contenir au moins 8 caractères, avec lettres et chiffres.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Les mots de passe ne correspondent pas." });
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        password,
      });

      navigate("/login", {
        replace: true,
        state: { message: res.data.message },
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Impossible de changer le mot de passe.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <button className="back-btn" type="button" onClick={() => navigate("/login")}>
          Retour
        </button>

        <h2>Nouveau mot de passe</h2>

        {!token && (
          <p className="auth-notice auth-notice-error">
            Lien de réinitialisation invalide.
          </p>
        )}

        {message && (
          <p className={`auth-notice auth-notice-${message.type}`}>
            {message.text}
          </p>
        )}

        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength="8"
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

        <button type="submit" disabled={loading || !token}>
          {loading ? "Mise à jour..." : "Changer le mot de passe"}
        </button>

        <Link className="auth-text-link" to="/forgot-password">
          Demander un nouveau lien
        </Link>
      </form>
    </div>
  );
}

export default ResetPassword;
