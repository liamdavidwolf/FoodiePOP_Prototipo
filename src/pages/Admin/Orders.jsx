import React, { useState, useEffect, useCallback } from "react";
import { orderApi } from "../../services/api";
import { Search, ChevronRight, CheckCircle2, ChevronLeft, ShoppingBag, RefreshCw, AlertCircle, Tag, TicketPercent } from "lucide-react";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const statusMap = {
  received: { label: "Recibido", color: "bg-orange-50 text-orange-700 border-orange-200", next: "confirmed", nextLabel: "Confirmar pedido" },
  confirmed: { label: "Confirmado", color: "bg-blue-50 text-blue-700 border-blue-200", next: "preparing", nextLabel: "Comenzar preparación" },
  preparing: { label: "En preparación", color: "bg-yellow-50 text-yellow-700 border-yellow-200", next: "ready", nextLabel: "Marcar como listo" },
  ready: { label: "Listo", color: "bg-green-50 text-green-700 border-green-200", next: "on_the_way", nextLabel: "Enviar pedido / Entregar" },
  on_the_way: { label: "En camino", color: "bg-purple-50 text-purple-700 border-purple-200", next: "delivered", nextLabel: "Marcar como entregado" },
  delivered: { label: "Entregado", color: "bg-neutral-100 text-neutral-600 border-neutral-200", next: null, nextLabel: "" },
  cancelled: { label: "Cancelado", color: "bg-red-50 text-red-700 border-red-200", next: null, nextLabel: "" }
};

export default function AdminOrders({ restaurantSlug = RESTAURANT_SLUG, restaurantName }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const displayRestaurantName = restaurantName || orders?.[0]?.restaurant?.name || "tu restaurante";

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderApi.getRestaurantOrders(restaurantSlug);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar los pedidos del restaurante.");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const updated = await orderApi.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => (o.id === orderId || o.orderId === orderId ? updated : o)));
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId || o.orderId === selectedOrderId);

  const filteredOrders = orders.filter(o => {
    const orderStatus = String(o.status).toLowerCase();
    if (filter !== "all" && orderStatus !== filter) return false;
    if (search) {
      const matchId = String(o.orderNumber || o.id).toLowerCase().includes(search.toLowerCase());
      const matchName = String(o.customer?.name || "").toLowerCase().includes(search.toLowerCase());
      if (!matchId && !matchName) return false;
    }
    return true;
  });

  const getCount = (status) => orders.filter(o => String(o.status).toLowerCase() === status).length;

  if (selectedOrder) {
    const sKey = String(selectedOrder.status).toLowerCase();
    const currentStatusConfig = statusMap[sKey] || statusMap.received;

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        <button 
          onClick={() => setSelectedOrderId(null)}
          className="flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-[#171717] mb-6 transition-colors"
        >
          <ChevronLeft size={16} /> Volver a pedidos
        </button>

        <div className="grid lg:grid-cols-[1fr_350px] gap-6">
          <div className="space-y-6">
            <div className="card p-6 border-l-4" style={{borderLeftColor: sKey === 'received' ? '#ea580c' : sKey === 'delivered' ? '#525252' : '#e85d3f'}}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedOrder.orderNumber || selectedOrder.id}</h2>
                  <p className="text-neutral-500 text-sm mt-1">
                    {new Date(selectedOrder.createdAt).toLocaleString('es-CO')} · {String(selectedOrder.orderType).toLowerCase() === 'delivery' ? 'Domicilio' : 'Para recoger'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${currentStatusConfig.color}`}>
                  {currentStatusConfig.label}
                </span>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-lg mb-4">Productos</h3>
              <div className="space-y-4">
                {(selectedOrder.items || []).map((item, i) => (
                  <div key={item.id || i} className="flex justify-between gap-4 border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-semibold text-sm">
                        <span className="text-[#e85d3f] mr-2">{item.quantity}x</span>
                        {item.name}
                      </div>
                      {item.options && item.options.length > 0 && (
                        <div className="text-xs text-neutral-500 mt-1">
                          Adicionales: {item.options.map(o => o.name).join(", ")}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-xs text-orange-600 mt-1 font-medium bg-orange-50 px-2 py-1 rounded-md inline-block">
                          Nota: "{item.notes}"
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-sm">
                      {money(item.subtotal || item.unitPrice * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-100 mt-6 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-neutral-500">
                  <span>Subtotal productos</span>
                  <span>{money(selectedOrder.subtotal)}</span>
                </div>

                {/* Descuento por cupón aplicado */}
                {(selectedOrder.discount > 0 || selectedOrder.couponCode) && (
                  <div className="flex justify-between items-center text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Tag size={14} className="text-emerald-600" />
                      <span>Cupón {selectedOrder.couponCode ? `"${selectedOrder.couponCode}"` : ""}</span>
                      {selectedOrder.couponSnapshot?.discountType === "PERCENTAGE" && (
                        <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded-full">
                          {selectedOrder.couponSnapshot.discountValue}% OFF
                        </span>
                      )}
                    </span>
                    <span className="font-bold">-{money(selectedOrder.discount || 0)}</span>
                  </div>
                )}

                {selectedOrder.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm text-neutral-500">
                    <span>Costo de envío</span>
                    <span>{money(selectedOrder.deliveryFee)}</span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-100">
                  <span>Total</span>
                  <span className="text-[#e85d3f]">{money(selectedOrder.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Tarjeta de Cupón de Descuento si fue utilizado */}
            {(selectedOrder.couponCode || selectedOrder.discount > 0) && (
              <div className="card p-6 border-l-4 border-l-emerald-500 bg-emerald-50/25">
                <div className="flex items-center gap-2 mb-3 text-emerald-800">
                  <TicketPercent size={20} className="text-emerald-600" />
                  <h3 className="font-bold text-base">Cupón de Descuento</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 text-xs">Código utilizado:</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs">
                      {selectedOrder.couponCode || "CUPÓN"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 text-xs">Descuento aplicado:</span>
                    <span className="font-extrabold text-emerald-600">
                      -{money(selectedOrder.discount || 0)}
                    </span>
                  </div>
                  {selectedOrder.couponSnapshot?.discountType && (
                    <div className="flex justify-between items-center text-xs text-neutral-500 pt-1 border-t border-emerald-100">
                      <span>Modalidad:</span>
                      <span className="font-semibold text-neutral-700">
                        {selectedOrder.couponSnapshot.discountType === "PERCENTAGE" 
                          ? `${selectedOrder.couponSnapshot.discountValue}% de descuento`
                          : `${money(selectedOrder.couponSnapshot.discountValue)} fijos`}
                      </span>
                    </div>
                  )}
                  {selectedOrder.couponSnapshot?.description && (
                    <p className="text-xs text-neutral-500 italic pt-1 border-t border-emerald-100">
                      "{selectedOrder.couponSnapshot.description}"
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="card p-6">
              <h3 className="font-bold text-lg mb-4">Cliente y Entrega</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-neutral-400 block text-xs">Nombre</span>
                  <span className="font-semibold">{selectedOrder.customer?.name || "Sin nombre"}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-xs">Teléfono</span>
                  <span className="font-semibold">{selectedOrder.customer?.phone || "Sin teléfono"}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-xs">Método de entrega</span>
                  <span className="font-semibold">{String(selectedOrder.orderType).toLowerCase() === 'delivery' ? 'Domicilio' : 'Recoger en tienda'}</span>
                </div>
                {selectedOrder.delivery?.address && (
                  <div>
                    <span className="text-neutral-400 block text-xs">Dirección</span>
                    <span className="font-semibold">{selectedOrder.delivery.address}</span>
                  </div>
                )}
                {selectedOrder.delivery?.reference && (
                  <div>
                    <span className="text-neutral-400 block text-xs">Referencia</span>
                    <span className="font-semibold">{selectedOrder.delivery.reference}</span>
                  </div>
                )}
                <div>
                  <span className="text-neutral-400 block text-xs">Método de pago</span>
                  <span className="font-semibold uppercase text-xs">{selectedOrder.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-bold text-lg mb-4">Acciones</h3>
              <div className="space-y-3">
                {currentStatusConfig.next && (
                  <button 
                    disabled={updatingId === selectedOrder.orderId}
                    onClick={() => handleUpdateStatus(selectedOrder.orderId || selectedOrder.id, currentStatusConfig.next.toUpperCase())}
                    className="w-full py-3 bg-[#e85d3f] hover:bg-[#d64e32] text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60"
                  >
                    {updatingId === selectedOrder.orderId ? "Actualizando..." : currentStatusConfig.nextLabel}
                  </button>
                )}

                {sKey !== 'cancelled' && sKey !== 'delivered' && (
                  <button 
                    disabled={updatingId === selectedOrder.orderId}
                    onClick={() => handleUpdateStatus(selectedOrder.orderId || selectedOrder.id, "CANCELLED")}
                    className="w-full py-2.5 bg-neutral-100 hover:bg-red-50 hover:text-red-600 text-neutral-600 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Pedidos</h1>
          <p className="text-neutral-500 text-sm mt-1">Supervisa y actualiza el estado de los pedidos de {displayRestaurantName}</p>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e8e8e4] rounded-xl text-sm font-semibold hover:bg-neutral-50 self-start sm:self-auto transition-colors"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs de Filtro */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 border-b border-[#e8e8e4] pb-3">
        {[
          { id: "all", label: "Todos", count: orders.length },
          { id: "received", label: "Recibidos", count: getCount("received") },
          { id: "confirmed", label: "Confirmados", count: getCount("confirmed") },
          { id: "preparing", label: "En preparación", count: getCount("preparing") },
          { id: "ready", label: "Listos", count: getCount("ready") },
          { id: "on_the_way", label: "En camino", count: getCount("on_the_way") },
          { id: "delivered", label: "Entregados", count: getCount("delivered") },
          { id: "cancelled", label: "Cancelados", count: getCount("cancelled") },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
              filter === tab.id 
                ? "bg-[#171717] text-white" 
                : "bg-white text-neutral-600 hover:bg-neutral-100 border border-[#e8e8e4]"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === tab.id ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input 
          type="text"
          placeholder="Buscar por código de orden o nombre de cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-[#e8e8e4] rounded-xl text-sm focus:outline-none focus:border-[#e85d3f] transition-all"
        />
      </div>

      {/* Lista de Pedidos */}
      <div className="card overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-neutral-600">No hay pedidos en esta sección</p>
            <p className="text-xs text-neutral-400 mt-1">Los pedidos recibidos desde el checkout aparecerán aquí en tiempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filteredOrders.map(order => {
              const sKey = String(order.status).toLowerCase();
              const sInfo = statusMap[sKey] || statusMap.received;

              return (
                <div 
                  key={order.orderId || order.id} 
                  className="p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors group cursor-pointer"
                  onClick={() => setSelectedOrderId(order.orderId || order.id)}
                >
                  <div className="flex gap-4 items-center">
                    <div className="hidden sm:flex w-12 h-12 rounded-xl bg-white border border-neutral-100 items-center justify-center text-neutral-400 shadow-sm">
                      <ShoppingBag size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{order.orderNumber || order.id}</span>
                        <span className="text-neutral-300">•</span>
                        <span className="font-medium text-sm">{order.customer?.name}</span>
                        {order.couponCode && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Tag size={10} />
                            {order.couponCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(order.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} • {order.items.length} producto(s)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div className="hidden md:block">
                      <div className="font-bold text-sm">{money(order.total)}</div>
                      {order.discount > 0 && (
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          -{money(order.discount)} cupón
                        </div>
                      )}
                      <div className="text-xs text-neutral-400 mt-0.5">
                        {String(order.orderType).toLowerCase() === 'delivery' ? 'Domicilio' : 'Para recoger'}
                      </div>
                    </div>
                    <div className="w-28 text-right hidden sm:block">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${sInfo.color}`}>
                        {sInfo.label}
                      </span>
                    </div>
                    <button className="text-[#e85d3f] opacity-0 group-hover:opacity-100 transition-opacity bg-[#fff4f1] p-2 rounded-lg">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
