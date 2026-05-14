import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import API_URL from "../config/api";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState({
    type: "info",
    text: "Verification de ton adresse email...",
  });
  const token = searchParams.get("token");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setMessage({
          type: "error",
          text: "Lien de verification invalide.",
        });
        return;
      }

      try {
        const res = await axios.post(`${API_URL}/api/auth/verify-email`, {
          token,
        });

        setMessage({
          type: "success",
          text: res.data.message || "Email verifie. Tu peux te connecter.",
        });
      } catch (err) {
        setMessage({
          type: "error",
          text:
            err.response?.data?.message ||
            "Impossible de verifier cette adresse email.",
        });
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="login-page">
      <div className="login-form">
        <h2>Verification email</h2>

        <p className={`auth-notice auth-notice-${message.type}`}>
          {message.text}
        </p>

        <Link className="player-btn nav-link-btn" to="/login">
          Aller a la connexion
        </Link>
      </div>
    </div>
  );
}

export default VerifyEmail;
