import React from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDanger = false,
  variant,
  loading = false,
  onConfirm,
  onCancel,
  onClose,
}) {
  if (!isOpen) return null;

  const handleDismiss = onCancel || onClose;
  const danger = isDanger || variant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-[#e8e8e4] relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              danger
                ? "bg-red-50 text-red-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-base font-bold text-[#171717]">{title}</h3>
        </div>

        <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#171717] hover:bg-[#2a2a2a]"
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

