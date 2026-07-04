/**
 * components/ProtectedRoute.jsx
 * -----------------------------
 * Wraps private pages. While the auth state is loading it shows a spinner;
 * once resolved it either renders the page or redirects to /login.
 */

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import Loader from "./Loader";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader label="Loading your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
