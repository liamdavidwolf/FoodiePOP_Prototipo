import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Store,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  Phone,
  MapPin,
  Clock,
  X,
  FileText,
  AlertCircle,
  Tag
} from "lucide-react";
import { superadminApi } from "../../services/api";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";

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

export default function OrdersPage() {
  const [searchParams] = useSearchParams();
  const initialRestaurant = searchParams.get("restaurant") || "";

  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [restaurantId, setRestaurantId] = useState(initialRestaurant);
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Modal order detail
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load restaurants for selector
  useEffect(() => {
    async function loadRestaurants() {
      try {
        const res = await superadminApi.getRestaurants({ limit: 100 });
        const list = res?.data || (Array.isArray(res) ? res : []);
        setRestaurants(list);
      } catch (err) {
        console.warn("No se pudo cargar la lista de restaurantes para el filtro:", err);
      }
    }
    loadRestaurants();
  }, []);

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, limit: meta.limit };
      if (restaurantId) params.restaurantId = restaurantId;
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search.trim()) params.search = search.trim();

      const res = await superadminApi.getOrders(params);
      const data = res?.data || (Array.isArray(res) ? res : []);
      const paginationMeta = res?.meta || {
        page,
        limit: meta.limit,
        total: data.length,
        totalPages: 1
      };

      setOrders(data);
      setMeta(paginationMeta);
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
      setError(err.message || "Error al obtener la lista de pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, [restaurantId, status, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const handleOpenDetail = async (orderId) => {
    try {
      setLoadingDetail(true);
      const res = await superadminApi.getOrder(orderId);
      const order = res?.data || res;
      setSelectedOrder(order);
    } catch (err) {
      alert(`No fue posible cargar el detalle del pedido: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResetFilters = () => {
    setRestaurantId("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Auditoría Global de Pedidos
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Inspecciona transacciones de todos los restaurantes de la red en tiempo real.
          </p>
        </div>

        <button
          onClick={() => fetchOrders(meta.page)}
          disabled={loading}
          className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors self-start sm:self-auto"
          title="Recargar pedidos"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por # pedido, nombre o teléfono..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </form>

          {/* Restaurant Filter */}
          <div>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">Restaurante: Todos</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (/{r.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">Estado: Todos</option>
              <option value="RECEIVED">Recibido (RECEIVED)</option>
              <option value="CONFIRMED">Confirmado (CONFIRMED)</option>
              <option value="PREPARING">En Preparación (PREPARING)</option>
              <option value="READY">Listo (READY)</option>
              <option value="ON_THE_WAY">En Camino (ON_THE_WAY)</option>
              <option value="DELIVERED">Entregado (DELIVERED)</option>
              <option value="CANCELLED">Cancelado (CANCELLED)</option>
            </select>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-600">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 rounded border border-neutral-300 bg-white text-xs text-neutral-700"
            />
          </div>

          <div className="flex items-center gap-1.5 text-neutral-600">
            <span>Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 rounded border border-neutral-300 bg-white text-xs text-neutral-700"
            />
          </div>

          {(restaurantId || status || startDate || endDate || search) && (
            <button
              onClick={handleResetFilters}
              className="text-neutral-500 hover:text-neutral-900 underline ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchOrders(1)} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Pedido #</th>
                <th className="py-3 px-4">Restaurante</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Entrega</th>
                <th className="py-3 px-4 text-right">Total (COP)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-600">No se encontraron pedidos</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      No hay transacciones registradas con los filtros seleccionados.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-neutral-50/60 transition-colors">
                    {/* Order Number */}
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      #{o.orderNumber}
                    </td>

                    {/* Restaurant */}
                    <td className="py-3 px-4">
                      {o.restaurant ? (
                        <Link
                          to={`/superadmin/restaurants/${o.restaurant.id}`}
                          className="font-semibold text-neutral-900 hover:text-orange-600 block"
                        >
                          {o.restaurant.name}
                        </Link>
                      ) : (
                        <span className="text-neutral-400">Sede general</span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-4">
                      <p className="font-medium text-neutral-900">{o.customerName || "Cliente"}</p>
                      {o.customerPhone && (
                        <p className="text-[11px] text-neutral-400">{o.customerPhone}</p>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                      {formatDate(o.createdAt)}
                    </td>

                    {/* Delivery type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-neutral-600 uppercase">
                        {o.orderType === "PICKUP" ? "Para Recoger" : "Domicilio"}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="py-3 px-4 text-right font-bold text-neutral-900 whitespace-nowrap">
                      {formatCOP(o.total)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <StatusBadge type="orderStatus" value={o.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenDetail(o.id)}
                        className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
                        title="Ver detalle del pedido"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
            <div>
              Página <span className="font-semibold">{meta.page}</span> de{" "}
              <span className="font-semibold">{meta.totalPages}</span> ({meta.total} pedidos registrados)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchOrders(meta.page - 1)}
                disabled={meta.page <= 1 || loading}
                className="p-1.5 rounded-md border border-neutral-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchOrders(meta.page + 1)}
                disabled={meta.page >= meta.totalPages || loading}
                className="p-1.5 rounded-md border border-neutral-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Read-only Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-mono font-bold text-sm">
                  #{selectedOrder.orderNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-neutral-900">
                      Pedido #{selectedOrder.orderNumber}
                    </h3>
                    <StatusBadge type="orderStatus" value={selectedOrder.status} />
                  </div>
                  <p className="text-xs text-neutral-500">{formatDate(selectedOrder.createdAt)}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* SuperAdmin Notice */}
              <div className="p-3 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-between text-neutral-600">
                <span className="font-semibold text-neutral-800">Modo Auditoría Centralizada</span>
                <span className="text-[11px] text-neutral-500">
                  Solo Lectura • Operado por {selectedOrder.restaurant?.name || "Restaurante"}
                </span>
              </div>

              {/* Restaurant & Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Restaurante Emisor
                  </span>
                  <p className="font-bold text-neutral-900 text-sm">
                    {selectedOrder.restaurant?.name || "Sin sede asignada"}
                  </p>
                  <p className="text-neutral-600">
                    Slug: <code className="bg-neutral-200/60 px-1 py-0.5 rounded font-mono">/{selectedOrder.restaurant?.slug}</code>
                  </p>
                  {selectedOrder.restaurant?.phone && (
                    <p className="text-neutral-500">Tel: {selectedOrder.restaurant.phone}</p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Información del Cliente
                  </span>
                  <p className="font-bold text-neutral-900 text-sm">{selectedOrder.customerName || "Cliente"}</p>
                  <p className="text-neutral-600">Tel: {selectedOrder.customerPhone || "–"}</p>
                  {selectedOrder.deliveryAddress && (
                    <p className="text-neutral-600 truncate">Dir: {selectedOrder.deliveryAddress}</p>
                  )}
                  {selectedOrder.deliveryRef && (
                    <p className="text-neutral-400 italic">Ref: {selectedOrder.deliveryRef}</p>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  Detalle de Productos ({selectedOrder.items?.length || 0})
                </span>
                <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between hover:bg-neutral-50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-neutral-100 text-neutral-700 font-bold flex items-center justify-center text-xs">
                            {item.quantity}x
                          </span>
                          <div>
                            <p className="font-bold text-neutral-900">{item.name}</p>
                            <p className="text-[11px] text-neutral-400">
                              Unitario: {formatCOP(item.unitPrice)}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-neutral-900">{formatCOP(item.subtotal)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-neutral-400">Sin items detallados</div>
                  )}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal productos</span>
                  <span>{formatCOP(selectedOrder.subtotal)}</span>
                </div>
                {(selectedOrder.discount > 0 || selectedOrder.couponCode) && (
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Tag size={12} />
                      Cupón {selectedOrder.couponCode ? `"${selectedOrder.couponCode}"` : ""}
                    </span>
                    <span>-{formatCOP(selectedOrder.discount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>Tarifa de domicilio</span>
                  <span>{formatCOP(selectedOrder.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                  <span>Total Pedido (COP)</span>
                  <span className="text-orange-600 font-extrabold">{formatCOP(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs">
                  <span className="font-bold text-amber-800 block mb-0.5">Notas del cliente:</span>
                  <p className="text-amber-900 italic">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

