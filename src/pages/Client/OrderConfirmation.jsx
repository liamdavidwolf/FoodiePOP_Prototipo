import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Store, Bike, Clock, Check, ChefHat, XCircle, AlertTriangle } from "lucide-react";
import { useOrders } from "../../context/OrderContext";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function OrderConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getOrderById } = useOrders();

  const searchParams = new URLSearchParams(location.search);
  const targetId =
    location.state?.orderId ||
    location.state?.orderNumber ||
    location.state?.id ||
    searchParams.get("id");

  const [order, setOrder] = useState(location.state || null);
  const [loading, setLoading] = useState(!location.state && !!targetId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!targetId) return;

    let isMounted = true;
    const fetchOrderData = async () => {
      try {
        const found = await getOrderById(targetId);
        if (isMounted) {
          if (found) {
            setOrder(found);
          } else if (!order) {
            setError("No se encontró el pedido solicitado.");
          }
        }
      } catch (err) {
        if (isMounted && !order) {
          setError(err.message || "Error al cargar el pedido.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderData();
    return () => {
      isMounted = false;
    };
  }, [targetId, getOrderById]);

  if (!targetId && !order) {
    return <Navigate to="/orders" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#e85d3f] border-t-transparent mb-3" />
        <p className="text-sm font-medium text-neutral-500">Cargando estado del pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#171717] mb-2">Pedido no encontrado</h2>
        <p className="text-sm text-neutral-500 mb-6">{error || "No pudimos obtener la información de este pedido."}</p>
        <button
          onClick={() => navigate("/orders")}
          className="px-6 py-3 bg-[#171717] text-white rounded-xl font-semibold hover:bg-[#2a2a2a] transition-colors"
        >
          Ver mis pedidos
        </button>
      </div>
    );
  }

  const isDelivery = String(order.orderType).toLowerCase() === "delivery";
  const finalTotal = order.total;

  const steps = [
    { id: 'received', label: "Recibido", icon: Clock },
    { id: 'confirmed', label: "Confirmado", icon: Check },
    { id: 'preparing', label: "Preparando", icon: ChefHat },
    { id: 'ready', label: isDelivery ? "En camino" : "Listo para recoger", icon: isDelivery ? Bike : Store }
  ];

  const currentStatus = String(order.status).toLowerCase();
  let currentStep = 0;
  if (currentStatus === 'confirmed') currentStep = 1;
  else if (currentStatus === 'preparing') currentStep = 2;
  else if (currentStatus === 'ready' || currentStatus === 'on_the_way') currentStep = 3;
  else if (currentStatus === 'delivered') currentStep = 4;

  const isCancelled = currentStatus === 'cancelled';
  const restaurantSlug = order?.restaurant?.slug || order?.restaurantSlug;
  const storeUrl = restaurantSlug ? `/${restaurantSlug}` : "/";

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-24">
      <header className="bg-white border-b border-[#e8e8e4]">
        <div className="max-w-[600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/orders", { state: { from: storeUrl } })}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="font-black tracking-tight text-xl">
              Foodie<span className="text-[#e85d3f]">POP</span>
            </div>
          </div>

          <button
            onClick={() => navigate(storeUrl)}
            className="text-xs font-semibold text-neutral-500 hover:text-[#171717] transition-colors"
          >
            Menú principal
          </button>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-4 mt-8 space-y-6">
        
        {/* Success Banner */}
        <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-[#e8e8e4]">
          {isCancelled ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <XCircle size={32} />
              </div>
              <h1 className="text-2xl font-bold text-[#171717] mb-2">Pedido cancelado</h1>
              <p className="text-neutral-500 mb-6">El restaurante ha cancelado tu pedido.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-2xl font-bold text-[#171717] mb-2">
                {currentStatus === 'delivered' ? '¡Pedido completado!' : '¡Pedido en proceso!'}
              </h1>
              <p className="text-neutral-500 mb-6">Gracias por tu preferencia, {order.customer?.name || "Cliente"}.</p>
            </>
          )}
          
          <div className="inline-block bg-neutral-100 px-4 py-2 rounded-lg font-mono font-bold text-lg text-[#171717] tracking-wider">
            {order.orderNumber || order.id}
          </div>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#e8e8e4]">
            <h2 className="font-bold text-lg mb-6">Estado del pedido</h2>
            
            <div className="relative">
              <div className="absolute left-[21px] top-4 bottom-4 w-[2px] bg-neutral-100"></div>
              
              <div 
                className="absolute left-[21px] top-4 w-[2px] bg-[#e85d3f] transition-all duration-500 ease-in-out"
                style={{ height: `${(Math.min(currentStep, steps.length - 1) / (steps.length - 1)) * 100}%` }}
              ></div>

              <div className="space-y-8 relative">
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isActive = idx <= currentStep;
                  const isCurrent = idx === currentStep;
                  
                  return (
                    <div key={idx} className="flex gap-4">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center border-[3px] shrink-0 bg-white relative z-10 transition-colors duration-300 ${
                        isActive ? 'border-[#e85d3f] text-[#e85d3f]' : 'border-neutral-200 text-neutral-300'
                      } ${isCurrent ? 'ring-4 ring-[#e85d3f]/20' : ''}`}>
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      <div className="pt-2.5">
                        <div className={`font-semibold transition-colors duration-300 ${isActive ? 'text-[#171717]' : 'text-neutral-400'}`}>
                          {step.label}
                        </div>
                        {isCurrent && (
                          <div className="text-sm text-neutral-500 mt-1 animate-in fade-in slide-in-from-left-2">
                            {idx === 0 && "El restaurante ha recibido tu orden."}
                            {idx === 1 && "Orden aceptada, empezaremos pronto."}
                            {idx === 2 && "Tus platos están siendo preparados con amor."}
                            {idx === 3 && (isDelivery ? "El repartidor va en camino." : "Puedes pasar por tu pedido.")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#e8e8e4]">
          <h2 className="font-bold text-lg mb-4">Resumen de la orden</h2>
          
          <div className="space-y-4 mb-6">
            {(order.items || []).map((item, idx) => (
              <div key={item.id || idx} className="flex justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold">{item.quantity}x</span> {item.name}
                  {((item.options && item.options.length > 0) || (item.selectedOptions && item.selectedOptions.length > 0)) && (
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {(item.options || item.selectedOptions).map(o => o.name).join(", ")}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-neutral-400 italic mt-0.5">"{item.notes}"</p>
                  )}
                </div>
                <div className="font-semibold shrink-0">
                  {money(item.subtotal || item.unitPrice * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-100 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-neutral-500">
              <span>Subtotal</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span>Descuento {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span>-{money(order.discount)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Costo de envío</span>
                <span>{money(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-100">
              <span>Total</span>
              <span className="text-[#e85d3f]">{money(finalTotal)}</span>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
