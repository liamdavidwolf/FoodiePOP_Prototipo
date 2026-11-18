import React, { useState } from "react";
import {
  X,
  Store,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  ArrowRight
} from "lucide-react";
import { superadminApi } from "../../services/api";

const INITIAL_FORM = {
  name: "",
  slug: "",
  description: "",
  phone: "",
  address: "",
  deliveryFee: 4000,
  schedule: "Lunes a Domingo - 11:00 AM a 10:00 PM",
  assignOwner: true,
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

export default function CreateRestaurantModal({ isOpen, onClose, onSuccess, onCreated }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdSummary, setCreatedSummary] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val) => {
    const autoSlug = val
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: prev.slug === "" || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
    }));
  };

  const handleGeneratePassword = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generated = `Foodie${randomNum}!`;
    setFormData((prev) => ({ ...prev, ownerPassword: generated }));
    setShowPassword(true);
  };

  const handleClose = () => {
    setFormData(INITIAL_FORM);
    setError(null);
    setCreatedSummary(null);
    setCopied(false);
    setShowPassword(false);
    onClose();
  };

  const handleCopyCredentials = () => {
    if (!createdSummary) return;
    const { restaurant, owner } = createdSummary;
    const loginUrl = `${window.location.origin}/login`;
    const text = `¡Hola ${owner.name}! Tu cuenta de administración para "${restaurant.name}" en FoodiePOP ha sido configurada exitosamente:\n\n` +
      `• Panel de Acceso: ${loginUrl}\n` +
      `• Correo: ${owner.email}\n` +
      (owner.assignedPassword ? `• Contraseña de acceso: ${owner.assignedPassword}\n\n` : `\n`) +
      `Ya puedes iniciar sesión para gestionar tu menú, pedidos y configuración.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      setError("El nombre y el identificador URL (slug) son requeridos.");
      return;
    }

    if (formData.assignOwner && !formData.ownerEmail.trim()) {
      setError("Si activas la asignación de administrador, debes ingresar su correo electrónico.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        deliveryFee: Number(formData.deliveryFee) >= 0 ? Number(formData.deliveryFee) : 4000,
      };

      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.address.trim()) payload.address = formData.address.trim();
      if (formData.schedule.trim()) payload.schedule = formData.schedule.trim();

      if (formData.assignOwner && formData.ownerEmail.trim()) {
        payload.owner = {
          email: formData.ownerEmail.trim().toLowerCase(),
          name: formData.ownerName.trim() || `${formData.name.trim()} Admin`,
          password: formData.ownerPassword.trim() || undefined,
        };
      }

      const res = await superadminApi.createRestaurant(payload);
      const newRest = res?.data || res;

      onSuccess?.(newRest);
      onCreated?.(newRest);

      if (newRest?.primaryOwner) {
        setCreatedSummary({
          restaurant: newRest,
          owner: newRest.primaryOwner,
        });
      } else {
        handleClose();
      }
    } catch (err) {
      setError(err.message || "Error al crear restaurante.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-[#e8e8e4] relative my-8 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Pantalla de Éxito / Resumen de Credenciales */}
        {createdSummary ? (
          <div className="text-center py-2 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-neutral-900">¡Restaurante Creado con Éxito!</h3>
              <p className="text-xs text-neutral-500 mt-1">
                La sede y la cuenta de su administrador han sido activadas en la red FoodiePOP.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Sede:</span>
                <span className="font-bold text-neutral-900">
                  {createdSummary.restaurant.name}{" "}
                  <code className="text-[11px] text-neutral-500 bg-neutral-200/60 px-1 py-0.5 rounded font-mono">
                    /{createdSummary.restaurant.slug}
                  </code>
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Administrador (OWNER):</span>
                <span className="font-bold text-neutral-900">{createdSummary.owner.name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Correo de Acceso:</span>
                <span className="font-mono text-neutral-900 font-semibold">{createdSummary.owner.email}</span>
              </div>
              {createdSummary.owner.assignedPassword && (
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-neutral-500 font-medium">Contraseña Asignada:</span>
                  <span className="font-mono text-neutral-900 font-bold bg-white px-2 py-1 rounded-lg border border-neutral-200 shadow-xs">
                    {createdSummary.owner.assignedPassword}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 leading-normal">
              Copia las credenciales a continuación para compartirlas con el responsable del nuevo restaurante.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                <span>{copied ? "¡Copiado al portapapeles!" : "Copiar credenciales"}</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Finalizar</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* Formulario de Creación */
          <>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center shrink-0">
                <Store size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#171717]">Crear Nuevo Restaurante</h3>
                <p className="text-xs text-neutral-500">Configuración de sede y acceso de administrador</p>
              </div>
            </div>

            {error && (
              <div className="my-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-3">
              {/* Bloque 1: Datos de la Sede */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Tacos El Pastor"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Slug URL (Identificador) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. tacos-el-pastor"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Descripción Corta
                </label>
                <textarea
                  rows={2}
                  placeholder="Especialidad, tipo de comida o propuesta gastronómica..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Costo de Domicilio (COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formData.deliveryFee}
                    onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    placeholder="300 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Dirección Física
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Calle 10 # 43-20"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Horario de Atención
                  </label>
                  <input
                    type="text"
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                  />
                </div>
              </div>

              {/* Bloque 2: Administrador Principal (Dueño / OWNER) */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/90 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck size={17} className="text-[#e85d3f]" />
                    <span className="text-xs font-bold text-neutral-800">
                      Administrador Principal (Dueño / OWNER)
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.assignOwner}
                      onChange={(e) => setFormData({ ...formData, assignOwner: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#e85d3f]"></div>
                  </label>
                </div>

                {formData.assignOwner ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-[11px] text-neutral-500 leading-tight">
                      Crea o vincula la cuenta del dueño de este restaurante. Podrá gestionar el menú, pedidos y configuración en su panel administrativo.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Nombre del Administrador
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Carlos Pérez"
                          value={formData.ownerName}
                          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                          Correo Electrónico *
                        </label>
                        <input
                          type="email"
                          required={formData.assignOwner}
                          placeholder="dueño@restaurante.com"
                          value={formData.ownerEmail}
                          onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-neutral-700">
                          Contraseña de Acceso (Inicial)
                        </label>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="text-[11px] text-[#e85d3f] font-semibold hover:underline flex items-center gap-1"
                        >
                          <Sparkles size={12} />
                          <span>Generar Segura</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres o genera una automática"
                          value={formData.ownerPassword}
                          onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                          className="w-full px-3 py-2 pr-10 rounded-xl bg-white border border-neutral-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 focus:border-[#e85d3f]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Si el correo ya está registrado en la red, se vinculará como OWNER. Si es nuevo, se creará su cuenta con esta contraseña.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 italic">
                    El restaurante se creará sin responsable asignado. Podrás asignarlo más adelante desde el detalle de la sede.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={handleClose}
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
                  Crear Restaurante
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
