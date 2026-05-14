import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const getDashboardPath = (role) => {
  if (role === "team") return "/team/dashboard";
  if (role === "player") return "/player/dashboard";
  return "/";
};

function PrivateRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <main className="dashboard-content">
          <p className="dashboard-message">Vérification de la session...</p>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getDashboardPath(user?.role)} replace />;
  }

  return children;
}

export default PrivateRoute;
