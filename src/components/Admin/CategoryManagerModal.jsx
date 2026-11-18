import React, { useState, useEffect } from "react";
import { X, Layers, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, AlertTriangle, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { menuApi, RESTAURANT_SLUG } from "../../services/api";

export default function CategoryManagerModal({ isOpen, onClose, onCategoriesChanged, restaurantSlug = RESTAURANT_SLUG }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Modo edición / creación
  const [editingCategory, setEditingCategory] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await menuApi.getAdminCategories(restaurantSlug);
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar categorías.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      resetForm();
      setFeedback(null);
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setPosition("");
    setActive(true);
    setError(null);
  };

  const handleStartEdit = (category) => {
    setEditingCategory(category);
    setName(category.name || "");
    setDescription(category.description || "");
    setPosition(category.position !== undefined ? String(category.position) : "");
    setActive(category.active ?? true);
    setError(null);
  };

  const handleToggleActive = async (category) => {
    try {
      const nextActive = !category.active;
      const updated = await menuApi.toggleCategoryAvailability(category.id, nextActive);
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, active: updated.active } : c))
      );
      setFeedback({
        type: "success",
        message: `Categoría '${category.name}' ${nextActive ? "activada" : "desactivada"}.`,
      });
      if (onCategoriesChanged) onCategoriesChanged();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Error al cambiar estado." });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDelete = async (category) => {
    if (category.productsCount > 0) {
      alert(
        `No es posible eliminar la categoría '${category.name}' porque tiene ${category.productsCount} producto(s) asociado(s).\n\nPara eliminarla, primero reasigna o elimina sus productos, o desactiva la categoría para ocultarla del menú.`
      );
      return;
    }

    if (!window.confirm(`¿Estás seguro de eliminar permanentemente la categoría '${category.name}'?`)) {
      return;
    }

    setDeletingId(category.id);
    try {
      await menuApi.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setFeedback({ type: "success", message: `Categoría '${category.name}' eliminada exitosamente.` });
      if (editingCategory?.id === category.id) {
        resetForm();
      }
      if (onCategoriesChanged) onCategoriesChanged();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Error al eliminar categoría." });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    const payload = {
      name: cleanName,
      description: description.trim() || null,
      position: position !== "" ? Number(position) : undefined,
      active,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingCategory) {
        const updated = await menuApi.updateCategory(editingCategory.id, payload);
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, ...updated } : c))
        );
        setFeedback({ type: "success", message: `Categoría '${updated.name}' actualizada exitosamente.` });
      } else {
        const created = await menuApi.createCategory(restaurantSlug, payload);
        setCategories((prev) => [...prev, created]);
        setFeedback({ type: "success", message: `Categoría '${created.name}' creada exitosamente.` });
      }
      resetForm();
      if (onCategoriesChanged) onCategoriesChanged();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(err.message || "Error al guardar categoría.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-800">Gestión de Categorías</h3>
              <p className="text-xs text-neutral-500">
                Organiza las secciones del menú, disponibilidad y orden de visualización
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

        {/* Notificaciones */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="underline opacity-70 hover:opacity-100">
              Cerrar
            </button>
          </div>
        )}

        {/* Contenido dividido: Formulario arriba + Lista abajo */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Formulario de Crear / Editar */}
          <form onSubmit={handleSubmit} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                {editingCategory ? <Edit2 size={14} className="text-[#e85d3f]" /> : <Plus size={14} className="text-[#e85d3f]" />}
                {editingCategory ? `Editar Categoría: ${editingCategory.name}` : "Nueva Categoría"}
              </span>
              {editingCategory && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-neutral-600 uppercase mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tacos, Postres, Bebidas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm font-semibold focus:outline-none focus:border-[#e85d3f]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-neutral-600 uppercase mb-1">
                  Posición
                </label>
                <input
                  type="number"
                  placeholder="Auto"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  min={0}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-sm font-semibold focus:outline-none focus:border-[#e85d3f]"
                />
              </div>

              <div className="sm:col-span-3 flex flex-col justify-end">
                <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-neutral-200">
                  <span className="text-xs font-bold text-neutral-700">Activa</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 uppercase mb-1">
                Descripción <span className="font-normal text-neutral-400">opcional</span>
              </label>
              <input
                type="text"
                placeholder="Breve detalle de la categoría..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:border-[#e85d3f]"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-5 py-2 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : editingCategory ? (
                  "Actualizar Categoría"
                ) : (
                  "Agregar Categoría"
                )}
              </button>
            </div>
          </form>

          {/* Listado de Categorías Existentes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Categorías configuradas ({categories.length})
              </h4>
              <span className="text-[11px] text-neutral-400">
                Las categorías con productos no pueden ser eliminadas
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center bg-neutral-50 rounded-2xl">
                <div className="w-8 h-8 border-3 border-[#e85d3f] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-neutral-500">Cargando categorías...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center bg-neutral-50 rounded-2xl text-neutral-400">
                <Layers size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-neutral-600">No hay categorías configuradas</p>
                <p className="text-[11px] text-neutral-400 mt-1">Usa el formulario superior para crear la primera.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white">
                {categories.map((cat) => {
                  const hasProducts = (cat.productsCount || 0) > 0;
                  const isBeingEdited = editingCategory?.id === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isBeingEdited ? "bg-[#fff4f1]/50" : "hover:bg-neutral-50/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-neutral-100 text-neutral-600 font-mono text-xs flex items-center justify-center shrink-0 font-bold">
                          {cat.position}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-neutral-800 truncate">{cat.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                cat.active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-neutral-100 text-neutral-500"
                              }`}
                            >
                              {cat.active ? "Activa" : "Inactiva"}
                            </span>
                            <span className="text-[11px] text-neutral-400 font-medium">
                              ({cat.productsCount || 0} {cat.productsCount === 1 ? "producto" : "productos"})
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-xs text-neutral-500 truncate mt-0.5">{cat.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Toggle activo */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(cat)}
                          title={cat.active ? "Desactivar categoría" : "Activar categoría"}
                          className={`p-2 rounded-xl text-xs font-semibold transition-colors ${
                            cat.active
                              ? "text-emerald-700 hover:bg-emerald-50"
                              : "text-neutral-400 hover:bg-neutral-100"
                          }`}
                        >
                          {cat.active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>

                        {/* Botón editar */}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          title="Editar categoría"
                          className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Botón eliminar */}
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingId === cat.id}
                          title={
                            hasProducts
                              ? `No se puede eliminar: tiene ${cat.productsCount} producto(s) asociado(s)`
                              : "Eliminar categoría"
                          }
                          className={`p-2 rounded-xl transition-colors ${
                            hasProducts
                              ? "text-neutral-300 cursor-not-allowed"
                              : "text-neutral-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <span className="text-xs text-neutral-500">
            Los cambios se reflejan inmediatamente en el menú público y el selector de productos.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-neutral-900 text-white font-bold text-xs hover:bg-neutral-800 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

