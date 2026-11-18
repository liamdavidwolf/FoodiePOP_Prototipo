import React, { useState } from "react";
import { X, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { superadminApi } from "../../services/api";

export default function StaffModal({
  isOpen,
  restaurantId,
  restaurantName,
  onClose,
  onSuccess,
  onAssigned,
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Ingresa el correo electrónico del usuario.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await superadminApi.addStaff(restaurantId, {
        email: email.trim().toLowerCase(),
        role,
        active: true,
      });
      setEmail("");
      setRole("MANAGER");
      onSuccess?.();
      onAssigned?.();
      onClose();
    } catch (err) {
      setError(err.message || "Error al asignar personal al restaurante.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#e8e8e4] relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center shrink-0">
            <UserPlus size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#171717]">Asignar Personal</h3>
            <p className="text-xs text-neutral-500 line-clamp-1">{restaurantName}</p>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mt-2 mb-4 leading-relaxed">
          Vincula a un usuario registrado para otorgarle permisos operativos en este restaurante. Esta acción no modifica su rol global.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Correo Electrónico del Usuario *
            </label>
            <input
              type="email"
              required
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Rol Operativo en el Restaurante *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "OWNER", label: "Owner", desc: "Responsable total" },
                { id: "MANAGER", label: "Manager", desc: "Gestión y pedidos" },
                { id: "KITCHEN", label: "Cocina", desc: "Solo preparación" },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setRole(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    role === opt.id
                      ? "border-[#e85d3f] bg-[#fff4f1] text-[#171717]"
                      : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] text-neutral-400 mt-0.5 leading-tight">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Asignar Miembro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

