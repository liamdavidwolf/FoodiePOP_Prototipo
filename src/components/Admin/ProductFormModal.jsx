import React, { useState, useEffect } from "react";
import { 
  X, Plus, Trash2, Edit2, Check, AlertCircle, Save, 
  Package, DollarSign, Layers, Image as ImageIcon, ToggleLeft, ToggleRight, Sparkles
} from "lucide-react";
import { menuApi } from "../../services/api";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function ProductFormModal({
  isOpen,
  onClose,
  product = null,
  categories = [],
  restaurantSlug,
  onSaved
}) {
  const isEdit = Boolean(product?.id);

  // Formulario principal de producto
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [available, setAvailable] = useState(true);

  // Lista de opciones del producto (en modo edición)
  const [options, setOptions] = useState([]);

  // Formulario para nuevo adicional
  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptName, setNewOptName] = useState("");
  const [newOptPrice, setNewOptPrice] = useState("");
  const [newOptCost, setNewOptCost] = useState("");
  const [newOptActive, setNewOptActive] = useState(true);

  // Edición inline de adicional
  const [editingOptId, setEditingOptId] = useState(null);
  const [editOptName, setEditOptName] = useState("");
  const [editOptPrice, setEditOptPrice] = useState("");
  const [editOptCost, setEditOptCost] = useState("");
  const [editOptActive, setEditOptActive] = useState(true);

  // Estados de carga y feedback
  const [loading, setLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Cargar datos al abrir modal o cambiar de producto
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setShowAddOption(false);
      setEditingOptId(null);

      if (product) {
        setName(product.name || "");
        setDescription(product.description || "");
        setPrice(product.price ? String(product.price) : "");
        setCost(product.cost !== null && product.cost !== undefined ? String(product.cost) : "");
        setCategoryId(product.categoryId || product.category?.id || (categories[0]?.id || ""));
        setImageUrl(product.imageUrl || "");
        setAvailable(product.available ?? true);
        setOptions(product.options || []);
      } else {
        setName("");
        setDescription("");
        setPrice("");
        setCost("");
        setCategoryId(categories[0]?.id || "");
        setImageUrl("");
        setAvailable(true);
        setOptions([]);
      }
    }
  }, [isOpen, product, categories]);

  if (!isOpen) return null;

  // Cálculos en vivo de margen para el producto
  const numPrice = Number(price) || 0;
  const numCost = Number(cost) || 0;
  const unitProfit = numPrice - numCost;
  const marginPct = numPrice > 0 ? Math.round((unitProfit / numPrice) * 100) : 0;

  // Guardar producto (Crear o Actualizar)
  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validaciones básicas de cliente
    if (!name.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }
    if (!price || isNaN(price) || Number(price) <= 0) {
      setError("El precio de venta debe ser un número entero mayor a 0.");
      return;
    }
    if (cost !== "" && (isNaN(cost) || Number(cost) < 0)) {
      setError("El costo de producción debe ser un número mayor o igual a 0.");
      return;
    }
    if (!categoryId) {
      setError("Debes seleccionar una categoría.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Math.round(Number(price)),
        cost: cost !== "" ? Math.round(Number(cost)) : null,
        categoryId,
        imageUrl: imageUrl.trim() || null,
        available: Boolean(available),
      };

      let result;
      if (isEdit) {
        result = await menuApi.updateProduct(product.id, payload);
        setSuccessMsg("¡Producto actualizado exitosamente!");
      } else {
        result = await menuApi.createProduct(restaurantSlug, payload);
        setSuccessMsg("¡Producto creado exitosamente!");
      }

      if (onSaved) {
        onSaved(result);
      }

      // Si fue creación, cerrar con breve retraso para mostrar éxito
      if (!isEdit) {
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      setError(err.message || "Ocurrió un error al guardar el producto.");
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo adicional
  const handleCreateOption = async (e) => {
    e.preventDefault();
    if (!isEdit || !product?.id) return;
    setError(null);

    if (!newOptName.trim()) {
      setError("El nombre del adicional es obligatorio.");
      return;
    }
    if (newOptPrice === "" || isNaN(newOptPrice) || Number(newOptPrice) < 0) {
      setError("El precio adicional debe ser mayor o igual a 0.");
      return;
    }
    if (newOptCost !== "" && (isNaN(newOptCost) || Number(newOptCost) < 0)) {
      setError("El costo del adicional debe ser mayor o igual a 0.");
      return;
    }

    setOptionLoading(true);
    try {
      const optData = {
        name: newOptName.trim(),
        price: Math.round(Number(newOptPrice)),
        cost: newOptCost !== "" ? Math.round(Number(newOptCost)) : null,
        active: Boolean(newOptActive),
      };

      const created = await menuApi.createProductOption(product.id, optData);
      setOptions(prev => [...prev, created]);
      setNewOptName("");
      setNewOptPrice("");
      setNewOptCost("");
      setNewOptActive(true);
      setShowAddOption(false);
      setSuccessMsg("Adicional agregado correctamente.");
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || "Error al crear el adicional.");
    } finally {
      setOptionLoading(false);
    }
  };

  // Guardar edición de adicional existente
  const handleSaveEditOption = async (optionId) => {
    setError(null);
    if (!editOptName.trim()) {
      setError("El nombre del adicional es obligatorio.");
      return;
    }
    if (editOptPrice === "" || isNaN(editOptPrice) || Number(editOptPrice) < 0) {
      setError("El precio adicional debe ser mayor o igual a 0.");
      return;
    }

    setOptionLoading(true);
    try {
      const optData = {
        name: editOptName.trim(),
        price: Math.round(Number(editOptPrice)),
        cost: editOptCost !== "" ? Math.round(Number(editOptCost)) : null,
        active: Boolean(editOptActive),
      };

      const updated = await menuApi.updateProductOption(optionId, optData);
      setOptions(prev => prev.map(o => o.id === optionId ? updated : o));
      setEditingOptId(null);
      setSuccessMsg("Adicional modificado correctamente.");
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || "Error al actualizar el adicional.");
    } finally {
      setOptionLoading(false);
    }
  };

  // Toggle rápido de estado activo para adicional
  const handleToggleOptionActive = async (opt) => {
    setError(null);
    setOptionLoading(true);
    try {
      const updated = await menuApi.updateProductOption(opt.id, {
        active: !opt.active
      });
      setOptions(prev => prev.map(o => o.id === opt.id ? updated : o));
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.message || "Error al cambiar estado del adicional.");
    } finally {
      setOptionLoading(false);
    }
  };

  // Iniciar edición inline de adicional
  const startEditOption = (opt) => {
    setEditingOptId(opt.id);
    setEditOptName(opt.name);
    setEditOptPrice(String(opt.price));
    setEditOptCost(opt.cost !== null && opt.cost !== undefined ? String(opt.cost) : "");
    setEditOptActive(opt.active);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center font-bold">
                <Package size={18} />
              </span>
              <h2 className="text-xl font-bold text-[#171717]">
                {isEdit ? "Editar Producto" : "Nuevo Producto"}
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {isEdit ? "Modifica los datos del catálogo y administra sus adicionales asociados." : "Ingresa la información básica para publicar un nuevo producto."}
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notificaciones de error o éxito */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs font-medium">
            <Check size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Contenido deslizable */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <form id="product-form" onSubmit={handleSubmitProduct} className="space-y-4">
            {/* Nombre y Categoría */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nombre del producto *
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Hamburguesa Clásica" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Categoría *
                </label>
                <select 
                  required
                  value={categoryId} 
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Precios y Costos */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Precio de venta (COP) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">$</span>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="25000" 
                    value={price} 
                    onChange={e => setPrice(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Costo de producción (COP)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">$</span>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="12000" 
                    value={cost} 
                    onChange={e => setCost(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                  />
                </div>
              </div>
            </div>

            {/* Resumen en vivo de Rentabilidad */}
            {numPrice > 0 && (
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-neutral-500">Ganancia por unidad: </span>
                  <strong className={unitProfit >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                    {money(unitProfit)}
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Margen:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    marginPct >= 40 ? "bg-emerald-100 text-emerald-800" :
                    marginPct >= 20 ? "bg-amber-100 text-amber-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {marginPct}%
                  </span>
                </div>
              </div>
            )}

            {/* Disponibilidad y URL de imagen */}
            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  URL de Imagen (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="url" 
                    placeholder="https://images.unsplash.com/..." 
                    value={imageUrl} 
                    onChange={e => setImageUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                  />
                  {imageUrl && (
                    <img 
                      src={imageUrl} 
                      alt="Vista previa" 
                      className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-4 sm:pt-4">
                <span className="text-xs font-semibold text-neutral-700">Disponibilidad:</span>
                <button
                  type="button"
                  onClick={() => setAvailable(!available)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    available 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                      : "bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200"
                  }`}
                >
                  {available ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} className="text-neutral-400" />}
                  <span>{available ? "Disponible para venta" : "Agotado temporalmente"}</span>
                </button>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Descripción
              </label>
              <textarea 
                rows="2" 
                placeholder="Ingredientes, preparación, detalles del platillo..." 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] resize-none"
              />
            </div>
          </form>

          {/* Sección de Gestión de Adicionales (Solo visible en modo edición) */}
          {isEdit && (
            <div className="pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#171717] flex items-center gap-1.5">
                    <Layers size={16} className="text-[#e85d3f]" />
                    Opciones y Adicionales
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Configura complementos (queso extra, tocineta, etc.) con sus precios y costos.
                  </p>
                </div>
                {!showAddOption && (
                  <button
                    type="button"
                    onClick={() => setShowAddOption(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 text-white px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition-colors"
                  >
                    <Plus size={14} />
                    Nuevo adicional
                  </button>
                )}
              </div>

              {/* Formulario para agregar nuevo adicional */}
              {showAddOption && (
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-200/60 mb-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#171717]">Agregar Adicional al Producto</span>
                    <button 
                      type="button" 
                      onClick={() => setShowAddOption(false)}
                      className="text-neutral-400 hover:text-neutral-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Nombre *</label>
                      <input 
                        type="text" 
                        placeholder="Ej. Tocineta Crujiente" 
                        value={newOptName} 
                        onChange={e => setNewOptName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white focus:outline-none focus:border-[#e85d3f]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Precio extra (COP) *</label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="4000" 
                        value={newOptPrice} 
                        onChange={e => setNewOptPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white focus:outline-none focus:border-[#e85d3f]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Costo producción</label>
                      <input 
                        type="number" 
                        min="0"
                        placeholder="1800" 
                        value={newOptCost} 
                        onChange={e => setNewOptCost(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-white focus:outline-none focus:border-[#e85d3f]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700">
                      <input 
                        type="checkbox" 
                        checked={newOptActive} 
                        onChange={e => setNewOptActive(e.target.checked)}
                        className="rounded text-[#e85d3f] focus:ring-[#e85d3f]"
                      />
                      <span>Habilitar en menú de clientes</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddOption(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-200/50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={optionLoading}
                        onClick={handleCreateOption}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#e85d3f] text-white hover:bg-[#d04e32] disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {optionLoading ? "Guardando..." : "Guardar adicional"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de adicionales */}
              <div className="space-y-2">
                {options.length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-2xl text-center text-xs text-neutral-400">
                    Este producto no tiene adicionales configurados todavía.
                  </div>
                ) : (
                  options.map(opt => {
                    const isEditing = editingOptId === opt.id;
                    if (isEditing) {
                      return (
                        <div key={opt.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input 
                              type="text" 
                              value={editOptName} 
                              onChange={e => setEditOptName(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border text-xs bg-white"
                              placeholder="Nombre"
                            />
                            <input 
                              type="number" 
                              min="0"
                              value={editOptPrice} 
                              onChange={e => setEditOptPrice(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border text-xs bg-white"
                              placeholder="Precio"
                            />
                            <input 
                              type="number" 
                              min="0"
                              value={editOptCost} 
                              onChange={e => setEditOptCost(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border text-xs bg-white"
                              placeholder="Costo"
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={editOptActive} 
                                onChange={e => setEditOptActive(e.target.checked)}
                              />
                              <span>Activo</span>
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingOptId(null)}
                                className="px-2.5 py-1 rounded text-xs text-neutral-500 hover:bg-neutral-200"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={optionLoading}
                                onClick={() => handleSaveEditOption(opt.id)}
                                className="px-3 py-1 rounded bg-[#171717] text-white text-xs font-semibold disabled:opacity-50"
                              >
                                {optionLoading ? "Guardando..." : "Actualizar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={opt.id} 
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/70 border border-neutral-100 hover:border-neutral-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            title={opt.active ? "Desactivar adicional" : "Activar adicional"}
                            onClick={() => handleToggleOptionActive(opt)}
                            className="text-neutral-400 hover:text-neutral-700"
                          >
                            {opt.active ? (
                              <ToggleRight size={20} className="text-emerald-600" />
                            ) : (
                              <ToggleLeft size={20} className="text-neutral-400" />
                            )}
                          </button>
                          <div>
                            <span className="text-xs font-bold text-[#171717]">{opt.name}</span>
                            <div className="text-[11px] text-neutral-500">
                              Precio: <span className="font-semibold text-neutral-700">{money(opt.price)}</span>
                              {opt.cost !== null && opt.cost !== undefined && (
                                <span> · Costo: {money(opt.cost)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            opt.active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {opt.active ? "Activo" : "Inactivo"}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEditOption(opt)}
                            className="p-1.5 text-neutral-400 hover:text-[#171717] hover:bg-neutral-200 rounded-lg transition-colors"
                            title="Editar adicional"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="p-4 px-6 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-200 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={loading}
            className="px-6 py-2.5 bg-[#171717] hover:bg-[#2a2a2a] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>{isEdit ? "Guardar cambios" : "Crear producto"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

