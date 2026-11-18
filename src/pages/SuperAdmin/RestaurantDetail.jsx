import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Store,
  ChevronLeft,
  ExternalLink,
  Users,
  Package,
  ShoppingBag,
  DollarSign,
  Calendar,
  Phone,
  MapPin,
  Clock,
  Truck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Save,
  UserCheck,
  UserX,
  TrendingUp,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { superadminApi, menuApi } from "../../services/api";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";
import ConfirmationModal from "../../components/SuperAdmin/ConfirmationModal";
import StaffModal from "../../components/SuperAdmin/StaffModal";

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

export default function RestaurantDetail() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [staff, setStaff] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState("resumen"); // resumen | info | personal | productos | pedidos | estadisticas

  // Edit form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
    deliveryFee: 4000,
    schedule: "",
    status: "OPEN",
    active: true
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modals
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirmar",
    variant: "warning",
    onConfirm: null
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load restaurant detail
      const resRest = await superadminApi.getRestaurant(id);
      const restData = resRest?.data || resRest;
      setRestaurant(restData);

      // Populate form
      setFormData({
        name: restData.name || "",
        description: restData.description || "",
        phone: restData.phone || "",
        address: restData.address || "",
        deliveryFee: restData.deliveryFee ?? 4000,
        schedule: restData.schedule || "",
        status: restData.status || "OPEN",
        active: Boolean(restData.active)
      });

      // Load staff
      try {
        const resStaff = await superadminApi.getStaff(id);
        const staffList = resStaff?.data?.staff || resStaff?.staff || [];
        setStaff(staffList);
      } catch (err) {
        console.warn("No se pudo cargar personal:", err);
      }

      // Load recent orders
      try {
        const resOrders = await superadminApi.getOrders({ restaurantId: id, limit: 10 });
        const ordersList = resOrders?.data || (Array.isArray(resOrders) ? resOrders : []);
        setOrders(ordersList);
      } catch (err) {
        console.warn("No se pudieron cargar pedidos recientes:", err);
      }

      // Load products
      if (restData.slug) {
        try {
          const resMenu = await menuApi.getAdminProducts(restData.slug);
          const prods = Array.isArray(resMenu) ? resMenu : (resMenu?.data || []);
          setProducts(prods);
        } catch {
          // Fallback to public menu
          try {
            const pubMenu = await menuApi.getMenu(restData.slug);
            const flatProds = [];
            (pubMenu || []).forEach((cat) => {
              (cat.products || []).forEach((p) => {
                flatProds.push({ ...p, category: cat.name });
              });
            });
            setProducts(flatProds);
          } catch {
            setProducts([]);
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar detalle del restaurante:", err);
      setError(err.message || "Error al obtener información de la sede.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    try {
      setSavingInfo(true);
      setSaveSuccess(false);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        deliveryFee: Number(formData.deliveryFee) || 0,
        schedule: formData.schedule.trim() || null,
        status: formData.status,
        active: Boolean(formData.active)
      };

      await superadminApi.updateRestaurant(id, payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      fetchData();
    } catch (err) {
      alert(`Error al actualizar información: ${err.message}`);
    } finally {
      setSavingInfo(false);
    }
  };

  const handleUpdateStaffRole = (membership, newRole) => {
    setConfirmModal({
      isOpen: true,
      title: `Cambiar rol de ${membership.user?.name || "usuario"}`,
      message: `¿Deseas asignar el rol local "${newRole}" a este miembro en la sede actual? Nota: esto no afecta su rol de usuario global en la plataforma.`,
      confirmText: "Actualizar Rol",
      variant: "primary",
      onConfirm: async () => {
        try {
          await superadminApi.updateStaffMembership(id, membership.id, { role: newRole });
          setConfirmModal({ isOpen: false });
          fetchData();
        } catch (err) {
          alert(`Error al actualizar rol: ${err.message}`);
        }
      }
    });
  };

  const handleToggleStaffActive = (membership) => {
    const nextActive = !membership.active;
    const actionText = nextActive ? "Reactivar membresía" : "Desactivar membresía";

    setConfirmModal({
      isOpen: true,
      title: `${actionText} — ${membership.user?.name}`,
      message: nextActive
        ? `¿Deseas reactivar el acceso de este usuario a las operaciones locales de la sede?`
        : `¿Deseas revocar el acceso de este usuario al panel de este restaurante? La cuenta del usuario no será eliminada.`,
      confirmText: actionText,
      variant: nextActive ? "primary" : "danger",
      onConfirm: async () => {
        try {
          await superadminApi.updateStaffMembership(id, membership.id, { active: nextActive });
          setConfirmModal({ isOpen: false });
          fetchData();
        } catch (err) {
          alert(`Error al cambiar estado de membresía: ${err.message}`);
        }
      }
    });
  };

  if (loading && !restaurant) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-white border border-neutral-200 rounded-xl p-6 animate-pulse" />
        <div className="h-96 bg-white border border-neutral-200 rounded-xl p-6 animate-pulse" />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-neutral-200 shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-neutral-900">No se pudo cargar el restaurante</h2>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">{error || "Restaurante no encontrado."}</p>
        <Link
          to="/superadmin/restaurants"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver a Restaurantes</span>
        </Link>
      </div>
    );
  }

  const hasOwner = staff.some((m) => m.role === "OWNER" && m.active);
  const hasStaff = staff.length > 0;

  const TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "info", label: "Información General" },
    { id: "personal", label: `Personal (${staff.length})` },
    { id: "productos", label: `Catálogo (${products.length || restaurant.productsCount || 0})` },
    { id: "pedidos", label: `Pedidos (${orders.length || restaurant.ordersCount || 0})` },
    { id: "estadisticas", label: "Estadísticas" }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/superadmin/restaurants"
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Restaurantes</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              {restaurant.name}
            </h1>
            <StatusBadge type="restaurantStatus" value={restaurant.status} />
            <StatusBadge type="accountStatus" value={restaurant.active} />
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
            <code className="text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
              slug: {restaurant.slug}
            </code>
            <span>•</span>
            <span>ID: {restaurant.id.slice(0, 10)}...</span>
            <span>•</span>
            <span>Registrado: {formatDate(restaurant.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
          <a
            href={`/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
            <span>Ver Tienda</span>
          </a>
        </div>
      </div>

      {/* Operativity / Owner Warning Banner */}
      {!hasOwner && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Esta sede no cuenta con un OWNER asignado</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Para operar correctamente de forma descentralizada, cada restaurante debe contar con al menos un administrador con rol local <strong>OWNER</strong>. Sin él, la sede se considera sin responsable directo.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveTab("personal");
              setStaffModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex-shrink-0"
          >
            Asignar OWNER
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-6 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-xs font-semibold whitespace-nowrap transition-colors relative ${
                activeTab === tab.id
                  ? "text-orange-600 border-b-2 border-orange-600 font-bold"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: RESUMEN */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Ventas Acumuladas</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-neutral-900">{formatCOP(restaurant.totalSales)}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Excluye cancelados</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Pedidos</span>
                <ShoppingBag className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-xl font-bold text-neutral-900">{restaurant.ordersCount || 0}</p>
              <p className="text-[11px] text-neutral-400 mt-1">Histórico completo</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Productos</span>
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xl font-bold text-neutral-900">{restaurant.productsCount || 0}</p>
              <p className="text-[11px] text-neutral-400 mt-1">En catálogo</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Equipo de Personal</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-xl font-bold text-neutral-900">{staff.length}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{hasOwner ? "Con OWNER activo" : "Sin OWNER"}</p>
            </div>
          </div>

          {/* Sede Contact & Operative Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-neutral-900 border-b border-neutral-100 pb-2">
                Ficha Operativa de la Sede
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-neutral-400 block mb-0.5">Dirección física</span>
                  <span className="font-medium text-neutral-800">{restaurant.address || "No especificada"}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5">Teléfono de atención</span>
                  <span className="font-medium text-neutral-800">{restaurant.phone || "No especificado"}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5">Tarifa de domicilio</span>
                  <span className="font-medium text-neutral-800">{formatCOP(restaurant.deliveryFee)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block mb-0.5">Horario habitual</span>
                  <span className="font-medium text-neutral-800">{restaurant.schedule || "No especificado"}</span>
                </div>
              </div>
              {restaurant.description && (
                <div className="pt-2 border-t border-neutral-100 text-xs">
                  <span className="text-neutral-400 block mb-1">Descripción:</span>
                  <p className="text-neutral-600 italic">{restaurant.description}</p>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <h3 className="text-sm font-bold text-neutral-900">Personal Clave</h3>
                <button
                  onClick={() => setActiveTab("personal")}
                  className="text-xs text-orange-600 font-semibold hover:underline"
                >
                  Gestionar
                </button>
              </div>
              {staff.length === 0 ? (
                <p className="text-xs text-neutral-400 py-4 text-center">
                  Sin miembros asignados a este restaurante.
                </p>
              ) : (
                <div className="space-y-2">
                  {staff.slice(0, 3).map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
                      <div>
                        <p className="text-xs font-bold text-neutral-900">{m.user?.name || "Sin nombre"}</p>
                        <p className="text-[11px] text-neutral-500">{m.user?.email}</p>
                      </div>
                      <StatusBadge type="localRole" value={m.role} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INFORMACIÓN GENERAL (EDICIÓN) */}
      {activeTab === "info" && (
        <form onSubmit={handleUpdateInfo} className="p-6 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-5 max-w-3xl">
          <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Editar Datos del Restaurante</h2>
              <p className="text-xs text-neutral-500">Actualiza los datos institucionales y operativos.</p>
            </div>
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Guardado con éxito</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Nombre Comercial *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Slug (Identificador URL)
              </label>
              <input
                type="text"
                value={restaurant.slug}
                disabled
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-neutral-400 mt-0.5">El slug no es modificable para proteger pedidos e historial.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+57 300 000 0000"
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Tarifa de Domicilio (COP)</label>
              <input
                type="number"
                min="0"
                step="500"
                value={formData.deliveryFee}
                onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Dirección Física</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle 10 # 40-20, Medellín"
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Horario de Atención</label>
              <input
                type="text"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="Lun-Dom: 11:30 AM - 10:00 PM"
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Descripción</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve reseña del concepto y comida..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Estado de Operación</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
              >
                <option value="OPEN">Abierto (OPEN)</option>
                <option value="CLOSED">Cerrado (CLOSED)</option>
                <option value="PAUSED">Pausado Temporalmente (PAUSED)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 sm:pt-6">
              <input
                type="checkbox"
                id="activeToggle"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor="activeToggle" className="text-xs font-semibold text-neutral-700 select-none cursor-pointer">
                Cuenta de Restaurante Activa (Habilitada en la plataforma)
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 flex justify-end">
            <button
              type="submit"
              disabled={savingInfo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingInfo ? "Guardando cambios..." : "Guardar Información"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: PERSONAL / STAFF */}
      {activeTab === "personal" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Personal Asignado</h2>
              <p className="text-xs text-neutral-500">
                Gestiona roles locales (<code className="text-orange-600 font-mono">OWNER</code>,{" "}
                <code className="text-blue-600 font-mono">MANAGER</code>,{" "}
                <code className="text-purple-600 font-mono">KITCHEN</code>) sin modificar el rol global de cada usuario.
              </p>
            </div>
            <button
              onClick={() => setStaffModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Asignar Miembro</span>
            </button>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Rol Local</th>
                    <th className="py-3 px-4">Membresía</th>
                    <th className="py-3 px-4">Fecha Asignación</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-neutral-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                        <p className="text-sm font-medium text-neutral-600">No hay personal asignado</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Asigna un OWNER o MANAGER para que administre este restaurante.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    staff.map((m) => (
                      <tr key={m.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            to={`/superadmin/users/${m.user?.id || m.userId}`}
                            className="font-bold text-neutral-900 hover:text-orange-600 block"
                          >
                            {m.user?.name || "Sin nombre"}
                          </Link>
                          <span className="text-[10px] text-neutral-400">
                            Rol Global: {m.user?.role || "CLIENT"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-neutral-600">{m.user?.email || "–"}</td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <StatusBadge type="localRole" value={m.role} />
                            {/* Role selector dropdown */}
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateStaffRole(m, e.target.value)}
                              className="text-[10px] py-1 px-1.5 rounded border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 focus:outline-none"
                            >
                              <option value="OWNER">OWNER</option>
                              <option value="MANAGER">MANAGER</option>
                              <option value="KITCHEN">KITCHEN</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge type="accountStatus" value={m.active} />
                        </td>
                        <td className="py-3 px-4 text-neutral-500">{formatDate(m.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleStaffActive(m)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                              m.active
                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {m.active ? "Desactivar" : "Reactivar"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CATÁLOGO DE PRODUCTOS */}
      {activeTab === "productos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Catálogo de Productos</h2>
              <p className="text-xs text-neutral-500">
                Productos registrados para esta sede con disponibilidad y precios.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Precio Venta</th>
                    <th className="py-3 px-4 text-center">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-neutral-400">
                        <Package className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                        <p className="text-sm font-medium text-neutral-600">Sin productos disponibles</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          El catálogo de esta sede no contiene productos activos.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-50/60">
                        <td className="py-3 px-4">
                          <p className="font-bold text-neutral-900">{p.name}</p>
                          {p.description && (
                            <p className="text-[11px] text-neutral-400 truncate max-w-sm">{p.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-neutral-600">{p.category?.name || p.category || "General"}</td>
                        <td className="py-3 px-4 text-right font-bold text-neutral-900">
                          {formatCOP(p.price)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.available
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                            }`}
                          >
                            {p.available ? "Disponible" : "Agotado"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PEDIDOS DE ESTA SEDE */}
      {activeTab === "pedidos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">Pedidos Recientes de la Sede</h2>
              <p className="text-xs text-neutral-500">Últimos pedidos registrados en este restaurante.</p>
            </div>
            <Link
              to={`/superadmin/orders?restaurant=${restaurant.id}`}
              className="text-xs font-semibold text-orange-600 hover:underline"
            >
              Ver todos en Auditoría →
            </Link>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Pedido #</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-neutral-400">
                        <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                        <p className="text-sm font-medium text-neutral-600">Sin pedidos registrados</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                          #{o.orderNumber}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-neutral-800">{o.customerName || o.user?.name || "Cliente"}</p>
                          <p className="text-[11px] text-neutral-400">{o.customerPhone || o.user?.email || ""}</p>
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
      )}

      {/* TAB 6: ESTADÍSTICAS */}
      {activeTab === "estadisticas" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Facturación Total</span>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{formatCOP(restaurant.totalSales)}</p>
              <p className="text-xs text-neutral-500 mt-1">Excluye pedidos cancelados</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Volumen de Pedidos</span>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{restaurant.ordersCount || 0}</p>
              <p className="text-xs text-neutral-500 mt-1">Pedidos completados y en curso</p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ticket Promedio Estimado</span>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {restaurant.ordersCount > 0
                  ? formatCOP(Math.round(restaurant.totalSales / restaurant.ordersCount))
                  : "$ 0"}
              </p>
              <p className="text-xs text-neutral-500 mt-1">Ventas / Total de pedidos</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
            <p>
              Nota de gobernanza de datos: FoodiePOP SuperAdmin calcula métricas de ventas brutas agregadas. Los cálculos de ganancias netas requerirán módulos de costeo histórico aprobados para evitar discrepancias contables.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <StaffModal
        isOpen={staffModalOpen}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        onClose={() => setStaffModalOpen(false)}
        onAssigned={fetchData}
      />

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

