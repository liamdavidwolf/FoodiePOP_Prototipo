import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { User, Mail, Phone, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const redirectFrom = location.state?.from || "/";
  const isFromCheckout = redirectFrom === "/checkout";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validaciones visuales de la política de contraseña
  const hasMinLength = formData.password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const passwordsMatch = formData.password && formData.password === formData.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!formData.name.trim()) {
      setErrorMessage("Por favor ingresa tu nombre completo.");
      return;
    }

    if (!formData.email.trim()) {
      setErrorMessage("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres y contener letras y números.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const result = await register({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      password: formData.password,
    });
    setLoading(false);

    if (result.success) {
      setSuccessMessage("¡Cuenta creada exitosamente! Redirigiendo...");
      setTimeout(() => {
        navigate(redirectFrom, { replace: true });
      }, 1200);
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex flex-col justify-center items-center p-4 py-12">
      <div className="w-full max-w-md">
        {/* Botón Volver */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-[#171717] mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          Volver al menú
        </button>

        {/* Tarjeta de Registro */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-[#e8e8e4]">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block text-3xl font-black tracking-tight mb-2">
              Foodie<span className="text-[#e85d3f]">POP</span>
            </Link>
            <h1 className="text-2xl font-bold text-[#171717]">Crear Cuenta</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Únete a FoodiePOP y haz tus pedidos fácilmente
            </p>
          </div>

          {/* Aviso contextual si viene de Checkout */}
          {isFromCheckout && (
            <div className="mb-6 p-3.5 bg-[#fff4f1] border border-[#fbd4cb] text-[#e85d3f] text-sm font-medium rounded-xl flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>Crea tu cuenta para completar tu orden.</span>
            </div>
          )}

          {/* Mensaje de error */}
          {errorMessage && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-start gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Nombre completo *
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Ej. Juan Pérez"
                  required
                  className="w-full pl-10 pr-3.5 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Correo electrónico *
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ejemplo@correo.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3.5 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Teléfono (opcional)
              </label>
              <div className="relative">
                <Phone
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Ej. 300 123 4567"
                  className="w-full pl-10 pr-3.5 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Contraseña *
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
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

              {/* Guía interactiva de seguridad */}
              <div className="mt-2.5 p-2.5 bg-neutral-50 rounded-xl text-xs space-y-1 text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-neutral-400"}>
                    {hasMinLength ? "✓" : "○"} Mínimo 8 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={hasLetter && hasNumber ? "text-emerald-600 font-semibold" : "text-neutral-400"}>
                    {hasLetter && hasNumber ? "✓" : "○"} Al menos una letra y un número
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Confirmar contraseña *
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  required
                  className="w-full pl-10 pr-3.5 py-3 border border-neutral-200 rounded-xl focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all text-sm"
                />
              </div>
              {formData.confirmPassword && (
                <p className={`text-xs mt-1.5 font-medium ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                  {passwordsMatch ? "✓ Las contraseñas coinciden" : "✕ Las contraseñas no coinciden"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-bold transition-all shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creando cuenta...</span>
                </>
              ) : (
                <span>Crear Cuenta</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-neutral-500">
            ¿Ya tienes una cuenta?{" "}
            <Link
              to="/login"
              state={{ from: redirectFrom }}
              className="font-bold text-[#e85d3f] hover:underline"
            >
              Inicia sesión aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
