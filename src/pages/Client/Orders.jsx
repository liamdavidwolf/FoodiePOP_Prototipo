import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ShoppingBag, RotateCcw, Clock, CheckCircle2, AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import { useOrders } from "../../context/OrderContext";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const statusMap = {
  received: { label: "Recibido", color: "bg-orange-100 text-orange-700" },
  confirmed: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  preparing: { label: "En preparación", color: "bg-yellow-100 text-yellow-700" },
  ready: { label: "Listo para recoger", color: "bg-green-100 text-green-700" },
  on_the_way: { label: "En camino", color: "bg-purple-100 text-purple-700" },
  delivered: { label: "Entregado", color: "bg-neutral-100 text-neutral-600" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" }
};

export default function ClientOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { orders, loading, error, fetchOrders, repeatOrder } = useOrders();
  const { restaurantSlug: cartRestaurantSlug } = useCart();

  const handleBack = () => {
    // 1. Si vino con state explícito (ej. de Header o OrderConfirmation)
    if (location.state?.from && location.state.from !== "/orders") {
      navigate(location.state.from);
      return;
    }

    // 2. Si el carrito tiene un restaurantSlug activo
    if (cartRestaurantSlug) {
      navigate(`/${cartRestaurantSlug}`);
      return;
    }

    // 3. Si hay pedidos existentes, volver al restaurante del pedido más reciente
    const latestOrder = orders?.[0];
    const orderSlug = latestOrder?.restaurant?.slug || latestOrder?.restaurantSlug;
    if (orderSlug) {
      navigate(`/${orderSlug}`);
      return;
    }

    // 4. Si hay historial en la sesión del navegador
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    // 5. Fallback al inicio
    navigate("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] pb-24">
        <header className="bg-white border-b border-[#e8e8e4] sticky top-0 z-10">
          <div className="max-w-[800px] mx-auto px-4 h-16 flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="font-bold text-lg">Mis Pedidos</h1>
          </div>
        </header>

        <main className="max-w-[800px] mx-auto px-4 mt-16 text-center">
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-[#e8e8e4] max-w-md mx-auto">
            <div className="w-16 h-16 bg-[#fff4f1] text-[#e85d3f] rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn size={28} />
            </div>
            <h2 className="text-xl font-bold text-[#171717] mb-2">Inicia sesión</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Para ver el historial y seguimiento de tus pedidos, ingresa con tu cuenta.
            </p>
            <button
              onClick={() => navigate("/login", { state: { from: "/orders" } })}
              className="w-full py-3.5 bg-[#171717] hover:bg-[#2a2a2a] text-white rounded-xl font-bold transition-all shadow-lg shadow-black/10 text-sm"
            >
              Iniciar Sesión
            </button>
          </div>
        </main>
      </div>
    );
  }

  const activeOrders = (orders || []).filter(o => !['delivered', 'cancelled'].includes(String(o.status).toLowerCase()));
  const pastOrders = (orders || []).filter(o => ['delivered', 'cancelled'].includes(String(o.status).toLowerCase()));

  const OrderCard = ({ order, isActive }) => {
    const orderStatusKey = String(order.status).toLowerCase();
    const statusInfo = statusMap[orderStatusKey] || statusMap.received;

    return (
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#e8e8e4] flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg">{order.orderNumber || order.id}</h3>
            <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
              <Clock size={14} />
              {order.createdAt ? new Date(order.createdAt).toLocaleString('es-CO', { 
                month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' 
              }) : ""}
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="text-sm text-neutral-600 mb-4 line-clamp-2 flex-1">
          {(order.items || []).map(item => `${item.quantity}x ${item.name}`).join(", ")}
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-100">
          <span className="font-bold text-lg text-[#e85d3f]">{money(order.total)}</span>
          <div className="flex gap-2">
            {isActive ? (
              <button 
                onClick={() => navigate("/order-status", { state: order })}
                className="px-4 py-2 bg-[#171717] text-white rounded-xl text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
              >
                Ver estado
              </button>
            ) : (
              <button 
                onClick={() => repeatOrder(order)}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-200 flex items-center gap-2 transition-colors"
              >
                <RotateCcw size={16} />
                Repetir
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-24">
      <header className="bg-white border-b border-[#e8e8e4] sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="font-bold text-lg">Mis Pedidos</h1>
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-[#171717] transition-colors"
            title="Actualizar pedidos"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 mt-8 space-y-10">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchOrders}
              className="px-3 py-1 bg-white border border-red-300 rounded-lg font-semibold text-xs hover:bg-red-50 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-[#e8e8e4] animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-neutral-200 rounded w-24" />
                  <div className="h-5 bg-neutral-100 rounded-full w-20" />
                </div>
                <div className="h-4 bg-neutral-100 rounded w-3/4" />
                <div className="h-6 bg-neutral-200 rounded w-20 pt-2" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#e8e8e4] p-8 shadow-sm">
            <ShoppingBag size={48} className="mx-auto text-neutral-300 mb-4" />
            <h2 className="text-xl font-bold text-[#171717] mb-2">Aún no tienes pedidos</h2>
            <p className="text-neutral-500 mb-6">Explora nuestro menú y realiza tu primer pedido en FoodiePOP.</p>
            <button 
              onClick={handleBack}
              className="px-6 py-3 bg-[#171717] text-white font-semibold rounded-xl hover:bg-[#2a2a2a] transition-colors"
            >
              Ver menú
            </button>
          </div>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-[#e85d3f]" />
                  Pedidos Activos
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activeOrders.map(order => (
                    <OrderCard key={order.orderId || order.id} order={order} isActive={true} />
                  ))}
                </div>
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-[#171717] mb-4 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-neutral-400" />
                  Historial
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pastOrders.map(order => (
                    <OrderCard key={order.orderId || order.id} order={order} isActive={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
