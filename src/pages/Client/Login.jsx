import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Si el usuario intentó acceder a /checkout u otra ruta protegida
  const redirectFrom = location.state?.from || "/";
  const isFromCheckout = redirectFrom === "/checkout";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage("Por favor completa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      if (location.state?.from) {
        navigate(location.state.from, { replace: true });
      } else if (result.user?.role === "SUPERADMIN") {
        navigate("/superadmin", { replace: true });
      } else if (result.user?.role === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate(redirectFrom, { replace: true });
      }
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Botón Volver */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-[#171717] mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Volver al menú
        </button>

        {/* Tarjeta de Inicio de Sesión */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-[#e8e8e4]">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block text-3xl font-black tracking-tight mb-2">
              Foodie<span className="text-[#e85d3f]">POP</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#171717]">Iniciar Sesión</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Ingresa a tu cuenta para continuar
            </p>
          </div>

          {/* Aviso contextual si viene de Checkout */}
          {isFromCheckout && (
            <div className="mb-6 p-3.5 bg-[#fff4f1] border border-[#fbd4cb] text-[#e85d3f] text-sm font-medium rounded-xl flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>Inicia sesión o regístrate para finalizar tu pedido.</span>
            </div>
          )}

          {/* Mensaje de error */}
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3.5 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-bold transition-all shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <span>Ingresar</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-neutral-500">
            ¿Aún no tienes cuenta?{" "}
            <Link
              to="/register"
              state={{ from: redirectFrom }}
              className="font-bold text-[#e85d3f] hover:underline"
            >
              Regístrate aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
