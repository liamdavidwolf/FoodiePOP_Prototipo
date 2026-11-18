import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  Search,
  Filter,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  PauseCircle,
  PlayCircle,
  PowerOff,
  Power,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Package,
  Users,
  ShieldAlert,
  CheckCircle2
} from "lucide-react";
import { superadminApi } from "../../services/api";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";
import ConfirmationModal from "../../components/SuperAdmin/ConfirmationModal";
import CreateRestaurantModal from "../../components/SuperAdmin/CreateRestaurantModal";

function formatCOP(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    variant: "warning",
    onConfirm: null
  });

  const fetchRestaurants = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: meta.limit };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (activeFilter !== "") params.active = activeFilter === "true";

      const res = await superadminApi.getRestaurants(params);
      const data = res?.data || (Array.isArray(res) ? res : []);
      const paginationMeta = res?.meta || {
        page,
        limit: meta.limit,
        total: data.length,
        totalPages: 1
      };

      setRestaurants(data);
      setMeta(paginationMeta);
    } catch (err) {
      console.error("Error cargando restaurantes:", err);
      setError(err.message || "Error al cargar los restaurantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants(1);
  }, [statusFilter, activeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRestaurants(1);
  };

  const handleToggleStatus = (restaurant) => {
    const isPaused = restaurant.status === "PAUSED";
    const nextStatus = isPaused ? "OPEN" : "PAUSED";
    const actionWord = isPaused ? "Reanudar operaciones" : "Pausar operaciones";

    setConfirmModal({
      isOpen: true,
      title: `${actionWord} de ${restaurant.name}`,
      message: isPaused
        ? `¿Deseas volver a marcar "${restaurant.name}" como ABIERTO? Podrá recibir pedidos si su horario y cuenta están activos.`
        : `¿Deseas pausar temporalmente "${restaurant.name}"? Los clientes no podrán completar nuevos pedidos mientras esté en pausa.`,
      confirmText: actionWord,
      variant: isPaused ? "primary" : "warning",
      onConfirm: async () => {
        try {
          await superadminApi.updateRestaurant(restaurant.id, { status: nextStatus });
          setConfirmModal({ isOpen: false });
          fetchRestaurants(meta.page);
        } catch (err) {
          alert(`Error al cambiar estado: ${err.message}`);
        }
      }
    });
  };

  const handleToggleActive = (restaurant) => {
    const nextActive = !restaurant.active;
    const actionWord = nextActive ? "Reactivar cuenta" : "Desactivar restaurante";

    setConfirmModal({
      isOpen: true,
      title: `${actionWord} — ${restaurant.name}`,
      message: nextActive
        ? `¿Deseas reactivar "${restaurant.name}"? El panel y la tienda pública volverán a estar habilitados.`
        : `¿Deseas desactivar la cuenta de "${restaurant.name}"? Quedará inaccesible para sus administradores y clientes de forma inmediata. No se borrará ningún dato histórico.`,
      confirmText: actionWord,
      variant: nextActive ? "primary" : "danger",
      onConfirm: async () => {
        try {
          await superadminApi.updateRestaurant(restaurant.id, { active: nextActive });
          setConfirmModal({ isOpen: false });
          fetchRestaurants(meta.page);
        } catch (err) {
          alert(`Error al actualizar activación: ${err.message}`);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Gestión de Restaurantes
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Supervisa el estado, personal, ventas y configuración de cada sede.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRestaurants(meta.page)}
            disabled={loading}
            className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors"
            title="Recargar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold shadow-sm hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Restaurante</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </form>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Estado: Todos</option>
            <option value="OPEN">Abiertos (OPEN)</option>
            <option value="CLOSED">Cerrados (CLOSED)</option>
            <option value="PAUSED">Pausados (PAUSED)</option>
          </select>

          {/* Active filter */}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Cuenta: Todas</option>
            <option value="true">Activos</option>
            <option value="false">Desactivados</option>
          </select>

          {(search || statusFilter || activeFilter !== "") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setActiveFilter("");
              }}
              className="text-xs text-neutral-500 hover:text-neutral-800 underline px-1"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
          <span>{error}</span>
          <button onClick={() => fetchRestaurants(1)} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Restaurante</th>
                <th className="py-3 px-4">Responsable (Owner)</th>
                <th className="py-3 px-4">Estado Operativo</th>
                <th className="py-3 px-4">Cuenta</th>
                <th className="py-3 px-4 text-center">Catálogo</th>
                <th className="py-3 px-4 text-center">Pedidos</th>
                <th className="py-3 px-4 text-right">Ventas Totales</th>
                <th className="py-3 px-4 text-center">Personal</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-4 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : restaurants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <Store className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-600">No se encontraron restaurantes</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Prueba ajustando los filtros de búsqueda o registra una nueva sede.
                    </p>
                  </td>
                </tr>
              ) : (
                restaurants.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Name & Slug */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/superadmin/restaurants/${r.id}`}
                          className="font-bold text-neutral-900 hover:text-orange-600 text-sm block"
                        >
                          {r.name}
                        </Link>
                        <div className="flex items-center gap-1.5 text-neutral-400 mt-0.5">
                          <code className="text-[11px] text-neutral-500 bg-neutral-100 px-1 py-0.5 rounded">
                            /{r.slug}
                          </code>
                          {r.phone && <span className="text-[11px]">• {r.phone}</span>}
                        </div>
                      </td>

                      {/* Primary Owner */}
                      <td className="py-3 px-4">
                        {r.primaryOwner ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-orange-100 text-[#e85d3f] flex items-center justify-center font-bold text-xs shrink-0">
                              {(r.primaryOwner.name || r.primaryOwner.email || "O").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/superadmin/users/${r.primaryOwner.id}`}
                                className="text-xs font-bold text-neutral-800 hover:text-orange-600 block truncate"
                              >
                                {r.primaryOwner.name || "Sin nombre"}
                              </Link>
                              <p className="text-[11px] text-neutral-400 truncate">{r.primaryOwner.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200" title="No tiene administradores o personal asignado">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            <span>Sin Responsable</span>
                          </span>
                        )}
                      </td>

                      {/* Operational Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge type="restaurantStatus" value={r.status} />
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge type="accountStatus" value={r.active} />
                      </td>

                      {/* Products */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-neutral-700 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{r.productsCount || 0}</span>
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-neutral-700 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{r.ordersCount || 0}</span>
                        </span>
                      </td>

                      {/* Total Sales */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-neutral-900">
                        {formatCOP(r.totalSales)}
                      </td>

                      {/* Staff */}
                      <td className="py-3 px-4 text-center whitespace-nowrap text-neutral-700">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Users className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{r.membersCount || 0}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/superadmin/restaurants/${r.id}`}
                            className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
                            title="Ver detalle completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {/* Pause / Resume */}
                          <button
                            onClick={() => handleToggleStatus(r)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              r.status === "PAUSED"
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700"
                            }`}
                            title={r.status === "PAUSED" ? "Reanudar restaurante" : "Pausar restaurante"}
                          >
                            {r.status === "PAUSED" ? (
                              <PlayCircle className="w-3.5 h-3.5" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Active / Inactive Toggle */}
                          <button
                            onClick={() => handleToggleActive(r)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              r.active
                                ? "border-neutral-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-neutral-500"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            title={r.active ? "Desactivar restaurante" : "Activar restaurante"}
                          >
                            {r.active ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
            <div>
              Mostrando página <span className="font-semibold">{meta.page}</span> de{" "}
              <span className="font-semibold">{meta.totalPages}</span> ({meta.total} restaurantes en total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRestaurants(meta.page - 1)}
                disabled={meta.page <= 1 || loading}
                className="p-1.5 rounded-md border border-neutral-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchRestaurants(meta.page + 1)}
                disabled={meta.page >= meta.totalPages || loading}
                className="p-1.5 rounded-md border border-neutral-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

      {/* Create Modal */}
      <CreateRestaurantModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => fetchRestaurants(1)}
      />
    </div>
  );
}

