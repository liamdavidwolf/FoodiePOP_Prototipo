import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  UserX,
  UserCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Store,
  Phone,
  Mail,
  Calendar
} from "lucide-react";
import { superadminApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";
import ConfirmationModal from "../../components/SuperAdmin/ConfirmationModal";

function formatDate(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    variant: "warning",
    onConfirm: null
  });

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: meta.limit };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (activeFilter !== "") params.active = activeFilter === "true";

      const res = await superadminApi.getUsers(params);
      const data = res?.data || (Array.isArray(res) ? res : []);
      const paginationMeta = res?.meta || {
        page,
        limit: meta.limit,
        total: data.length,
        totalPages: 1
      };

      setUsers(data);
      setMeta(paginationMeta);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setError(err.message || "Error al obtener la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [roleFilter, activeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleToggleUserActive = (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      alert("Por motivos de seguridad, no puedes suspender tu propia cuenta de SuperAdmin.");
      return;
    }

    const nextActive = !targetUser.active;
    const actionText = nextActive ? "Reactivar cuenta" : "Suspender usuario";

    setConfirmModal({
      isOpen: true,
      title: `${actionText} — ${targetUser.name}`,
      message: nextActive
        ? `¿Deseas reactivar el acceso de ${targetUser.name} (${targetUser.email})? Podrá volver a iniciar sesión.`
        : `¿Deseas suspender la cuenta de ${targetUser.name} (${targetUser.email})? No podrá iniciar sesión en la plataforma ni acceder a ningún restaurante. Sus datos y pedidos no se eliminarán.`,
      confirmText: actionText,
      variant: nextActive ? "primary" : "danger",
      onConfirm: async () => {
        try {
          await superadminApi.setUserActive(targetUser.id, nextActive);
          setConfirmModal({ isOpen: false });
          fetchUsers(meta.page);
        } catch (err) {
          alert(`Error al cambiar estado de cuenta: ${err.message}`);
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
            Gestión Global de Usuarios
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Consulta clientes, administradores y personal con sus membresías asociadas.
          </p>
        </div>

        <button
          onClick={() => fetchUsers(meta.page)}
          disabled={loading}
          className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors self-start sm:self-auto"
          title="Recargar usuarios"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo electrónico..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </form>

        <div className="flex items-center gap-2">
          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Rol Global: Todos</option>
            <option value="CLIENT">CLIENT</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>

          {/* Active filter */}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Estado: Todos</option>
            <option value="true">Activos</option>
            <option value="false">Suspendidos</option>
          </select>

          {(search || roleFilter || activeFilter !== "") && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setActiveFilter("");
              }}
              className="text-xs text-neutral-500 hover:text-neutral-800 underline px-1"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchUsers(1)} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4">Rol Global</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Membresías / Sedes</th>
                <th className="py-3 px-4 text-center">Pedidos</th>
                <th className="py-3 px-4">Registro</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-4 bg-neutral-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-600">No se encontraron usuarios</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Intenta con otros criterios de búsqueda o filtros.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Name & ID */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/superadmin/users/${u.id}`}
                          className="font-bold text-neutral-900 hover:text-orange-600 block text-sm"
                        >
                          {u.name}
                        </Link>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ID: {u.id.slice(0, 8)}...
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4">
                        <p className="text-neutral-800 font-medium">{u.email}</p>
                        {u.phone && <p className="text-neutral-400 text-[11px]">{u.phone}</p>}
                      </td>

                      {/* Global Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge type="globalRole" value={u.role} />
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge type="accountStatus" value={u.active} />
                      </td>

                      {/* Memberships */}
                      <td className="py-3 px-4">
                        {u.memberships && u.memberships.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.memberships.map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium border border-neutral-200"
                              >
                                <span className="font-semibold">{m.restaurant?.name || "Sede"}</span>
                                <span className="text-orange-600 font-bold">({m.role})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">Sin membresías</span>
                        )}
                      </td>

                      {/* Orders Count */}
                      <td className="py-3 px-4 text-center font-medium text-neutral-700">
                        {u.ordersCount ?? 0}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/superadmin/users/${u.id}`}
                            className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
                            title="Ver perfil completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {!isSelf && (
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                u.active
                                  ? "border-neutral-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-neutral-500"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              title={u.active ? "Suspender cuenta" : "Reactivar cuenta"}
                            >
                              {u.active ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
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
              Página <span className="font-semibold">{meta.page}</span> de{" "}
              <span className="font-semibold">{meta.totalPages}</span> ({meta.total} usuarios registrados)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchUsers(meta.page - 1)}
                disabled={meta.page <= 1 || loading}
                className="p-1.5 rounded-md border border-neutral-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchUsers(meta.page + 1)}
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
    </div>
  );
}

