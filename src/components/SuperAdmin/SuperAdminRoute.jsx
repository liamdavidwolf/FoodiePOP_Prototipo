import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AccessDenied from "../../pages/SuperAdmin/AccessDenied";

export default function SuperAdminRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#e85d3f] border-t-transparent mb-3" />
        <p className="text-sm font-medium text-neutral-500">
          Verificando credenciales de SuperAdmin...
        </p>
      </div>
    );
  }

  // No autenticado -> redirigir a Login con retorno
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Autenticado pero no es SUPERADMIN -> 403 Forbidden
  if (user.role !== "SUPERADMIN") {
    return <AccessDenied />;
  }

  return <Outlet />;
}

