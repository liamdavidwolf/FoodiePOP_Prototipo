import React, { useState, useEffect } from "react";
import { X, Tag, Percent, DollarSign, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";

const formatMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export default function CouponFormModal({ isOpen, onClose, onSave, coupon = null }) {
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    minimumOrderAmount: "",
    maximumDiscount: "",
    startDate: "",
    endDate: "",
    usageLimit: "",
    active: true,
  });

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (coupon) {
      setFormData({
        code: coupon.code || "",
        description: coupon.description || "",
        discountType: coupon.discountType || "PERCENTAGE",
        discountValue: coupon.discountValue !== undefined ? String(coupon.discountValue) : "",
        minimumOrderAmount: coupon.minimumOrderAmount ? String(coupon.minimumOrderAmount) : "",
        maximumDiscount: coupon.maximumDiscount ? String(coupon.maximumDiscount) : "",
        startDate: coupon.startDate ? coupon.startDate.slice(0, 10) : "",
        endDate: coupon.endDate ? coupon.endDate.slice(0, 10) : "",
        usageLimit: coupon.usageLimit !== null && coupon.usageLimit !== undefined ? String(coupon.usageLimit) : "",
        active: coupon.active ?? true,
      });
    } else {
      setFormData({
        code: "",
        description: "",
        discountType: "PERCENTAGE",
        discountValue: "",
        minimumOrderAmount: "",
        maximumDiscount: "",
        startDate: "",
        endDate: "",
        usageLimit: "",
        active: true,
      });
    }
    setError(null);
  }, [coupon, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "code") {
      setFormData((prev) => ({ ...prev, code: value.toUpperCase().replace(/\s+/g, "") }));
    } else if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = formData.code.trim();
    if (!trimmedCode || trimmedCode.length < 3) {
      setError("El código del cupón debe tener al menos 3 caracteres alfanuméricos.");
      return;
    }

    const discVal = Number(formData.discountValue);
    if (!discVal || discVal <= 0) {
      setError("El valor del descuento debe ser mayor a 0.");
      return;
    }

    if (formData.discountType === "PERCENTAGE" && discVal > 100) {
      setError("El porcentaje de descuento no puede ser superior al 100%.");
      return;
    }

    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      setError("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
      return;
    }

    const payload = {
      code: trimmedCode,
      description: formData.description.trim() || null,
      discountType: formData.discountType,
      discountValue: Math.round(discVal),
      minimumOrderAmount: formData.minimumOrderAmount ? Math.round(Number(formData.minimumOrderAmount)) : 0,
      maximumDiscount: formData.discountType === "PERCENTAGE" && formData.maximumDiscount ? Math.round(Number(formData.maximumDiscount)) : null,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.endDate ? new Date(formData.endDate + "T23:59:59.999Z").toISOString() : null,
      usageLimit: formData.usageLimit ? Math.round(Number(formData.usageLimit)) : null,
      active: formData.active,
    };

    try {
      setSubmitting(true);
      await onSave(payload, coupon?.id);
      onClose();
    } catch (err) {
      setError(err.message || "Ocurrió un error al guardar el cupón.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-800">
                {coupon ? "Editar Cupón de Descuento" : "Nuevo Cupón de Descuento"}
              </h3>
              <p className="text-xs text-neutral-500">
                {coupon ? `Modificando código ${coupon.code}` : "Configura un nuevo código promocional para clientes"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Código */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
              Código del cupón *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="EJ: PROMO10, FOODIE50"
              maxLength={30}
              required
              className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 font-mono font-bold tracking-wider text-neutral-800 focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20 uppercase"
            />
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Letras, números y guiones. Se aplicará siempre en mayúsculas.
            </span>
          </div>

          {/* Tipo de Descuento */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase mb-1.5">
              Tipo de descuento *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, discountType: "PERCENTAGE" }))}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-semibold text-sm border transition-all ${
                  formData.discountType === "PERCENTAGE"
                    ? "bg-[#fff4f1] border-[#e85d3f] text-[#e85d3f] shadow-sm"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Percent size={16} />
                Porcentaje (%)
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, discountType: "FIXED" }))}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-semibold text-sm border transition-all ${
                  formData.discountType === "FIXED"
                    ? "bg-[#fff4f1] border-[#e85d3f] text-[#e85d3f] shadow-sm"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <DollarSign size={16} />
                Valor Fijo ($ COP)
              </button>
            </div>
          </div>

          {/* Valor de Descuento & Descuento Máximo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                {formData.discountType === "PERCENTAGE" ? "Porcentaje (%) *" : "Monto del descuento ($ COP) *"}
              </label>
              <input
                type="number"
                name="discountValue"
                value={formData.discountValue}
                onChange={handleChange}
                min={1}
                max={formData.discountType === "PERCENTAGE" ? 100 : undefined}
                placeholder={formData.discountType === "PERCENTAGE" ? "10" : "5000"}
                required
                className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 font-semibold focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                Tope máximo (COP) <span className="font-normal text-neutral-400">opcional</span>
              </label>
              <input
                type="number"
                name="maximumDiscount"
                value={formData.maximumDiscount}
                onChange={handleChange}
                min={0}
                placeholder="EJ: 15000"
                disabled={formData.discountType === "FIXED"}
                className={`w-full px-4 py-2.5 rounded-2xl border text-neutral-800 font-semibold focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20 ${
                  formData.discountType === "FIXED" ? "bg-neutral-100 border-neutral-200 cursor-not-allowed opacity-60" : "border-neutral-300"
                }`}
              />
            </div>
          </div>

          {/* Compra mínima & Límite de usos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                Compra mínima (COP)
              </label>
              <input
                type="number"
                name="minimumOrderAmount"
                value={formData.minimumOrderAmount}
                onChange={handleChange}
                min={0}
                placeholder="0 (Sin mínimo)"
                className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 font-semibold focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                Límite de usos <span className="font-normal text-neutral-400">opcional</span>
              </label>
              <input
                type="number"
                name="usageLimit"
                value={formData.usageLimit}
                onChange={handleChange}
                min={1}
                placeholder="Vacío = Ilimitado"
                className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 font-semibold focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
              />
            </div>
          </div>

          {/* Fechas de vigencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                Válido desde <span className="font-normal text-neutral-400">opcional</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
                Válido hasta <span className="font-normal text-neutral-400">opcional</span>
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-neutral-600 uppercase mb-1">
              Descripción interna o promocional <span className="font-normal text-neutral-400">opcional</span>
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="EJ: 10% de descuento en el mes de inauguración"
              maxLength={255}
              className="w-full px-4 py-2.5 rounded-2xl border border-neutral-300 text-neutral-800 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-2 focus:ring-[#e85d3f]/20"
            />
          </div>

          {/* Estado activo */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
            <div>
              <span className="text-sm font-bold text-neutral-800 block">Cupón activo</span>
              <span className="text-xs text-neutral-500">
                Los clientes podrán aplicarlo en checkout mientras esté activo y vigente.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#e85d3f]"></div>
            </label>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl border border-neutral-300 text-neutral-700 font-semibold text-sm hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-2xl bg-[#e85d3f] hover:bg-[#d44d30] text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : coupon ? (
                "Guardar Cambios"
              ) : (
                "Crear Cupón"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

