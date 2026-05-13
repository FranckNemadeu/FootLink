import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import API_URL from "../config/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/forgot-password`, {
        email: email.trim().toLowerCase(),
      }, { timeout: 20000 });

      setMessage({ type: "success", text: res.data.message });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err.code === "ECONNABORTED"
            ? "L'envoi prend trop de temps. Verifie la configuration email du serveur."
            : err.response?.data?.message || "Impossible d'envoyer le lien.",
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

        <h2>Mot de passe oublie</h2>

        {message && (
          <p className={`auth-notice auth-notice-${message.type}`}>
            {message.text}
          </p>
        )}

        <input
          type="email"
          placeholder="Email du compte"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Envoi..." : "Recevoir le lien"}
        </button>

        <Link className="auth-text-link" to="/login">
          Retour a la connexion
        </Link>
      </form>
    </div>
  );
}

export default ForgotPassword;
