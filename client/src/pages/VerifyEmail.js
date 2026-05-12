import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API_URL from "../config/api";

function VerifyEmail() {
  const [message, setMessage] = useState({ type: "success", text: "Verification en cours..." });
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );

  useEffect(() => {
    if (!token) {
      setMessage({ type: "error", text: "Lien de verification invalide." });
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await axios.post(`${API_URL}/api/auth/verify-email`, { token });
        navigate("/login", {
          replace: true,
          state: { message: res.data.message },
        });
      } catch (err) {
        setMessage({
          type: "error",
          text: err.response?.data?.message || "Impossible de verifier cet email.",
        });
      }
    };

    verifyEmail();
  }, [navigate, token]);

  return (
    <div className="login-page">
      <div className="login-form">
        <h2>Verification email</h2>
        <p className={`auth-notice auth-notice-${message.type}`}>{message.text}</p>
        <Link className="auth-text-link" to="/login">
          Retour a la connexion
        </Link>
      </div>
    </div>
  );
}

export default VerifyEmail;
