import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import API_URL from "../config/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, dashboardPath, login, sessionMessage } = useAuth();
  const from = location.state?.from?.pathname;
  const successMessage = location.state?.message;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(dashboardPath, { replace: true });
    }
  }, [isAuthenticated, dashboardPath, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      login(res.data.user, res.data.token);

      const nextPath =
        from ||
        (res.data.user.role === "team" ? "/team/dashboard" : "/player/dashboard");

      navigate(nextPath, { replace: true });
    } catch (err) {
      console.log(err);
      setErrorMessage(err.response?.data?.message || "Erreur connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <button className="back-btn" type="button" onClick={() => navigate("/")}>
          Retour
        </button>

        <h2>Connexion FootLink</h2>

        {sessionMessage && <p className="auth-notice">{sessionMessage}</p>}
        {successMessage && (
          <p className="auth-notice auth-notice-success">{successMessage}</p>
        )}
        {errorMessage && (
          <p className="auth-notice auth-notice-error">{errorMessage}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <Link className="auth-text-link" to="/forgot-password">
          Mot de passe oublié ?
        </Link>
      </form>
    </div>
  );
}

export default Login;

