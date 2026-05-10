import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";

const AuthContext = createContext();
const TOKEN_KEY = "token";
const USER_KEY = "user";

const getDashboardPath = (role) => {
  if (role === "team") return "/team/dashboard";
  if (role === "player") return "/player/dashboard";
  return "/";
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.log("Erreur lors du chargement du user:", err);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.authorization = token;
    } else {
      delete axios.defaults.headers.common.authorization;
    }
  }, [token]);

  const login = useCallback((userData, authToken) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));

    setToken(authToken);
    setUser(userData);
    setSessionMessage("");
  }, []);

  const logout = useCallback((message = "") => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);
    setSessionMessage(message);
  }, []);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;

        if (token && (status === 401 || status === 403)) {
          logout("Ta session a expire. Reconnecte-toi pour continuer.");
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [logout, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      sessionMessage,
      isAuthenticated: Boolean(token && user),
      dashboardPath: getDashboardPath(user?.role),
      login,
      logout,
    }),
    [user, token, isLoading, sessionMessage, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit etre utilise dans AuthProvider");
  }
  return context;
}
