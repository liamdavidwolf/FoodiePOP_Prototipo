import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, Loader2, AlertCircle, TicketPercent, Check, X, Tag } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { useOrders } from "../../context/OrderContext";
import { useAuth } from "../../context/AuthContext";
import { RESTAURANT_SLUG, couponApi } from "../../services/api";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { cartItems, cartTotal, clearCart, restaurantSlug: cartRestaurantSlug } = useCart();
  const effectiveSlug = cartRestaurantSlug || RESTAURANT_SLUG;
  const storeUrl = cartRestaurantSlug ? `/${cartRestaurantSlug}` : (effectiveSlug ? `/${effectiveSlug}` : "/");
  const { createOrder } = useOrders();
  
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    orderType: "pickup",
    address: "",
    reference: "",
    notes: "",
    paymentMethod: "cash"
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Estado del cupón de descuento
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Manejador para aplicar cupón
  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Ingresa un código de cupón.");
      return;
    }

    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const result = await couponApi.validateCoupon({
        restaurantSlug: effectiveSlug,
        code,
        subtotal: cartTotal,
      });
      setAppliedCoupon(result);
      setCouponCodeInput("");
      setCouponError(null);
    } catch (err) {
      setCouponError(err.message || "El cupón no es válido para este pedido.");
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Manejador para remover cupón
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponCodeInput("");
  };

  // Cálculos de descuento y totales
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const deliveryFee = formData.orderType === "delivery" ? 4000 : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount) + deliveryFee;

  // Si no está autenticado, redirigir a /login guardando la ruta de retorno
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { state: { from: "/checkout" } });
    }
  }, [user, authLoading, navigate]);

  // Pre-completar datos si el usuario termina de cargar
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || "",
        phone: prev.phone || user.phone || "",
      }));
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#e85d3f] border-t-transparent mb-3" />
        <p className="text-sm font-medium text-neutral-500">Verificando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4 text-center">
        <ShoppingBag size={48} className="text-neutral-300 mb-4" />
        <h2 className="text-xl font-bold mb-2">Tu carrito está vacío</h2>
        <p className="text-neutral-500 mb-6">Parece que aún no has agregado nada a tu pedido.</p>
        <button 
          onClick={() => navigate(storeUrl)}
          className="px-6 py-3 bg-[#171717] text-white rounded-xl font-semibold hover:bg-[#2a2a2a] transition-colors"
        >
          Volver al menú
        </button>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Previene doble envío por clic repetido
    setSubmitError(null);
    
    if (!formData.name.trim() || !formData.phone.trim()) {
      setSubmitError("Por favor completa tu nombre y teléfono.");
      return;
    }
    
    if (formData.orderType === "delivery" && !formData.address.trim()) {
      setSubmitError("Por favor ingresa tu dirección de entrega.");
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        restaurantSlug: effectiveSlug,
        orderType: formData.orderType,
        delivery: formData.orderType === "delivery" ? {
          address: formData.address.trim(),
          reference: formData.reference?.trim() || "",
        } : null,
        customer: {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
        },
        items: cartItems.map(item => ({
          productId: item.id || item.productId,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions || [],
          note: item.note || "",
        })),
        paymentMethod: formData.paymentMethod,
        notes: formData.notes?.trim() || "",
        couponCode: appliedCoupon ? appliedCoupon.coupon.code : undefined,
      };

      const newOrder = await createOrder(orderPayload);
      
      // Vacía el carrito ÚNICAMENTE tras confirmar la creación exitosa en el backend
      clearCart();
      navigate("/order-status", { state: newOrder });
    } catch (err) {
      // Conserva el carrito si la creación falla y muestra error al usuario
      setSubmitError(err.message || "Error al procesar el pedido. Tu carrito se conserva.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-24">
      <header className="bg-white border-b border-[#e8e8e4] sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate(storeUrl)}
            className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-lg">Finalizar Pedido</h1>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 mt-6 grid md:grid-cols-[1fr_350px] gap-6">
        <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Alerta de error si falla la creación del pedido */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-start gap-3 animate-in fade-in">
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">No se pudo procesar tu pedido</p>
                <p className="mt-0.5 text-xs text-red-600">{submitError}</p>
              </div>
            </div>
          )}

          {/* Datos Personales */}
          <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-[#e8e8e4]">
            <h2 className="font-bold text-lg mb-4">Datos personales</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre completo *</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-neutral-200 rounded-xl p-3 focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all"
                  placeholder="Ej. David Sánchez"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono *</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border border-neutral-200 rounded-xl p-3 focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all"
                  placeholder="Ej. 300 123 4567"
                  required
                />
              </div>
            </div>
          </section>

          {/* Tipo de Pedido */}
          <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-[#e8e8e4]">
            <h2 className="font-bold text-lg mb-4">Tipo de pedido</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setFormData({...formData, orderType: "pickup"})}
                className={`py-3 px-4 rounded-xl border font-semibold transition-colors ${
                  formData.orderType === "pickup" 
                    ? "border-[#e85d3f] bg-[#fff4f1] text-[#e85d3f]" 
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Para recoger
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, orderType: "delivery"})}
                className={`py-3 px-4 rounded-xl border font-semibold transition-colors ${
                  formData.orderType === "delivery" 
                    ? "border-[#e85d3f] bg-[#fff4f1] text-[#e85d3f]" 
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                Domicilio
              </button>
            </div>

            {formData.orderType === "delivery" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Dirección de entrega *</label>
                  <input 
                    type="text" 
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full border border-neutral-200 rounded-xl p-3 focus:outline-none focus:border-[#e85d3f]"
                    placeholder="Ej. Calle 123 #45-67"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Punto de referencia</label>
                  <input 
                    type="text" 
                    name="reference"
                    value={formData.reference}
                    onChange={handleChange}
                    className="w-full border border-neutral-200 rounded-xl p-3 focus:outline-none focus:border-[#e85d3f]"
                    placeholder="Ej. Casa blanca con rejas negras"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Pago */}
          <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-[#e8e8e4]">
            <h2 className="font-bold text-lg mb-4">Método de pago (Prototipo)</h2>
            <div className="space-y-3">
              {[
                { id: "cash", label: "Efectivo al recibir" },
                { id: "transfer", label: "Transferencia bancaria" },
                { id: "online", label: "Pago en línea (Mock)" }
              ].map(method => (
                <label key={method.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                  formData.paymentMethod === method.id ? 'border-[#e85d3f] bg-[#fff4f1]' : 'border-neutral-200 hover:bg-neutral-50'
                }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.paymentMethod === method.id ? 'border-[#e85d3f]' : 'border-neutral-300'
                  }`}>
                    {formData.paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-[#e85d3f]"></div>}
                  </div>
                  <span className="font-medium text-neutral-700">{method.label}</span>
                </label>
              ))}
            </div>
          </section>
        </form>

        {/* Resumen del pedido (Sidebar on Desktop) */}
        <div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#e8e8e4] sticky top-24">
            <h2 className="font-bold text-lg mb-4">Resumen</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {cartItems.map(item => (
                <div key={item.cartItemId} className="flex justify-between gap-3 text-sm">
                  <div className="font-medium">
                    <span className="text-neutral-500 mr-2">{item.quantity}x</span>
                    {item.name}
                  </div>
                  <div className="font-semibold whitespace-nowrap">
                    {money((item.price + item.selectedOptions.reduce((a,b)=>a+b.price,0)) * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Sección de Cupón de Descuento */}
            <div className="border-t border-neutral-100 pt-4 mb-4">
              <label className="block text-xs font-bold text-neutral-600 uppercase mb-2 flex items-center gap-1.5">
                <TicketPercent size={14} className="text-[#e85d3f]" />
                ¿Tienes un cupón?
              </label>

              {appliedCoupon ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold text-xs">
                      <Check size={14} />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-xs text-emerald-800 tracking-wider">
                        {appliedCoupon.coupon.code}
                      </span>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        {appliedCoupon.coupon.discountType === "PERCENTAGE"
                          ? `${appliedCoupon.coupon.discountValue}% OFF aplicado`
                          : `${money(appliedCoupon.discount)} descontados`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    title="Quitar cupón"
                    className="p-1 text-neutral-400 hover:text-red-600 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="CÓDIGO"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCodeInput.trim()}
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[75px]"
                    >
                      {validatingCoupon ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Aplicar"
                      )}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                      <AlertCircle size={13} className="shrink-0" />
                      {couponError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 pt-4 space-y-2 mb-6">
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Subtotal</span>
                <span>{money(cartTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600 font-semibold">
                  <span>Descuento ({appliedCoupon?.coupon?.code})</span>
                  <span>-{money(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Costo de envío</span>
                <span>{formData.orderType === "delivery" ? money(4000) : "Gratis"}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-100">
                <span>Total</span>
                <span className="text-[#e85d3f]">
                  {money(finalTotal)}
                </span>
              </div>
            </div>

            <button 
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-bold transition-all shadow-lg shadow-black/10 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Procesando pedido...</span>
                </>
              ) : (
                <span>Confirmar Pedido</span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
