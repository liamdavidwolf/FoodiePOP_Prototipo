import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Users,
  ChevronLeft,
  Mail,
  Phone,
  Calendar,
  Store,
  ShoppingBag,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertCircle,
  RefreshCw,
  Lock
} from "lucide-react";
import { superadminApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";
import ConfirmationModal from "../../components/SuperAdmin/ConfirmationModal";

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
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function UserDetail() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    variant: "warning",
    onConfirm: null
  });

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await superadminApi.getUser(id);
      const data = res?.data || res;
      setTargetUser(data);
    } catch (err) {
      console.error("Error cargando detalle de usuario:", err);
      setError(err.message || "Usuario no encontrado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

  const handleToggleActive = () => {
    if (!targetUser) return;
    if (targetUser.id === currentUser?.id) {
      alert("No puedes suspender tu propia cuenta de SuperAdmin.");
      return;
    }

    const nextActive = !targetUser.active;
    const actionText = nextActive ? "Reactivar cuenta" : "Suspender usuario";

    setConfirmModal({
      isOpen: true,
      title: `${actionText} — ${targetUser.name}`,
      message: nextActive
        ? `¿Deseas reactivar a este usuario? Podrá iniciar sesión y acceder a los restaurantes donde tenga membresía.`
        : `¿Deseas suspender a ${targetUser.name}? Se revocarán todas sus sesiones activas y no podrá acceder al sistema.`,
      confirmText: actionText,
      variant: nextActive ? "primary" : "danger",
      onConfirm: async () => {
        try {
          await superadminApi.setUserActive(targetUser.id, nextActive);
          setConfirmModal({ isOpen: false });
          fetchUser();
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      }
    });
  };

  if (loading && !targetUser) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white border border-neutral-200 rounded-xl p-6 animate-pulse" />
        <div className="h-64 bg-white border border-neutral-200 rounded-xl p-6 animate-pulse" />
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-neutral-200 shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-neutral-900">Usuario no disponible</h2>
        <p className="text-xs text-neutral-500 mt-1">{error || "No se pudo recuperar la información del usuario."}</p>
        <Link
          to="/superadmin/users"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver a Usuarios</span>
        </Link>
      </div>
    );
  }

  const isSelf = targetUser.id === currentUser?.id;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/superadmin/users"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Usuarios</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {targetUser.name}
            </h1>
            <StatusBadge type="globalRole" value={targetUser.role} />
            <StatusBadge type="accountStatus" value={targetUser.active} />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 font-mono">ID: {targetUser.id}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUser}
            disabled={loading}
            className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors"
            title="Recargar usuario"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>

          {!isSelf && (
            <button
              onClick={handleToggleActive}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                targetUser.active
                  ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {targetUser.active ? (
                <>
                  <UserX className="w-4 h-4" />
                  <span>Suspender Cuenta</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Reactivar Cuenta</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">
            Información Institucional
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-neutral-400 block mb-0.5">Correo Electrónico</span>
              <span className="font-semibold text-neutral-800 break-all">{targetUser.email}</span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Teléfono</span>
              <span className="font-medium text-neutral-800">{targetUser.phone || "No registrado"}</span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Rol de Autorización Global</span>
              <span className="font-bold text-neutral-900">{targetUser.role}</span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Fecha de Registro</span>
              <span className="text-neutral-600">{formatDate(targetUser.createdAt)}</span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-0.5">Última Modificación</span>
              <span className="text-neutral-600">{formatDate(targetUser.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Security & Credentials Card */}
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-neutral-900 font-bold text-sm border-b border-neutral-100 pb-2">
            <Lock className="w-4 h-4 text-orange-600" />
            <span>Gobernanza y Privacidad de Credenciales</span>
          </div>
          <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-neutral-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Contraseñas Seguras y Aislamiento Criptográfico</span>
            </p>
            <p className="leading-relaxed">
              FoodiePOP almacena las contraseñas procesadas mediante hash saltado irreversible (bcrypt). La interfaz visual del SuperAdmin y sus APIs nunca devuelven ni exponen hashes de contraseñas, tokens de refresco ni claves de sesión en ninguna consulta.
            </p>
            <p className="leading-relaxed text-neutral-500">
              Cualquier cambio en roles globales requiere estrictos controles administrativos y no está expuesto directamente en el selector de personal de restaurante para prevenir escalamiento indebido de privilegios.
            </p>
          </div>
        </div>
      </div>

      {/* Restaurant Memberships */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Membresías y Sedes Asignadas</h2>
            <p className="text-xs text-neutral-500">
              Restaurantes a los que este usuario tiene acceso con su rol local específico.
            </p>
          </div>
          <span className="text-xs text-neutral-500 font-medium">
            {targetUser.memberships?.length || 0} sedes
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Restaurante</th>
                  <th className="py-3 px-4">Rol Local</th>
                  <th className="py-3 px-4">Estado Membresía</th>
                  <th className="py-3 px-4">Asignado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {!targetUser.memberships || targetUser.memberships.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">
                      <Store className="w-6 h-6 mx-auto mb-1 text-neutral-300" />
                      Este usuario no tiene membresías asignadas a ningún restaurante.
                    </td>
                  </tr>
                ) : (
                  targetUser.memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/superadmin/restaurants/${m.restaurant?.id}`}
                          className="font-bold text-neutral-900 hover:text-orange-600"
                        >
                          {m.restaurant?.name}
                        </Link>
                        <span className="text-[11px] text-neutral-400 block font-mono">
                          /{m.restaurant?.slug}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="localRole" value={m.role} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="accountStatus" value={m.active} />
                      </td>
                      <td className="py-3 px-4 text-neutral-500">{formatDate(m.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/superadmin/restaurants/${m.restaurant?.id}`}
                          className="text-xs text-orange-600 font-semibold hover:underline"
                        >
                          Ver Sede →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Orders as Customer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Historial de Pedidos Realizados</h2>
            <p className="text-xs text-neutral-500">
              Últimos pedidos completados por el usuario como cliente.
            </p>
          </div>
          <span className="text-xs text-neutral-500 font-medium">
            Total histórico: {targetUser.ordersCount || 0} pedidos
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pedido #</th>
                  <th className="py-3 px-4">Restaurante</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {!targetUser.orders || targetUser.orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400">
                      <ShoppingBag className="w-6 h-6 mx-auto mb-1 text-neutral-300" />
                      No registra pedidos realizados como cliente.
                    </td>
                  </tr>
                ) : (
                  targetUser.orders.map((o) => (
                    <tr key={o.id} className="hover:bg-neutral-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                        #{o.orderNumber}
                      </td>
                      <td className="py-3 px-4 text-neutral-800">
                        {o.restaurant?.name || "Restaurante"}
                      </td>
                      <td className="py-3 px-4 text-neutral-500">{formatDate(o.createdAt)}</td>
                      <td className="py-3 px-4 text-right font-bold text-neutral-900">
                        {formatCOP(o.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge type="orderStatus" value={o.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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

