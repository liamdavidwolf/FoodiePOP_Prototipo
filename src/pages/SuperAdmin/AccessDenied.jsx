import React from "react";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AccessDenied() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xs border border-[#e8e8e4]">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full uppercase tracking-wider mb-2">
          Error 403 · Acceso Denegado
        </span>
        <h1 className="text-xl font-bold text-[#171717] mb-2">
          Área Restringida a SuperAdmin
        </h1>
        <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
          Esta consola está reservada exclusivamente para la administración global de FoodiePOP.
          {user ? (
            <>
              {" "}Tu cuenta (<strong className="text-neutral-700">{user.email}</strong>) tiene asignado el rol global{" "}
              <span className="font-bold text-[#e85d3f] uppercase">{user.role}</span>.
            </>
          ) : null}
        </p>

        <div className="flex flex-col gap-2">
          {user?.role === "ADMIN" && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full py-3 bg-[#171717] hover:bg-[#2a2a2a] text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Ir al Panel de Mi Restaurante
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-semibold text-sm transition-colors"
          >
            Volver a la App de Clientes
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="w-full py-2.5 text-neutral-500 hover:text-neutral-800 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut size={14} /> Cerrar Sesión e Iniciar con Otra Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

