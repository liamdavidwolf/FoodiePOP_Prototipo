import React, { useEffect } from "react";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function Cart({ isOpen, onClose }) {
  const { cartItems, updateQuantity, removeItem, cartTotal } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckout = () => {
    onClose();
    navigate("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-16 border-b border-[#e8e8e4] flex items-center justify-between px-6 shrink-0">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingBag size={20} />
            Mi Pedido
          </h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-neutral-500 hover:text-black rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-4">
              <ShoppingBag size={48} className="opacity-20" />
              <div>
                <p className="font-medium text-neutral-600 mb-1">Tu carrito está vacío</p>
                <p className="text-sm">Agrega productos del menú para comenzar tu pedido.</p>
              </div>
              <button 
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-neutral-100 text-neutral-800 rounded-full text-sm font-semibold hover:bg-neutral-200 transition-colors"
              >
                Ver menú
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {cartItems.map((item) => (
                <div key={item.cartItemId} className="flex gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-neutral-100">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-sm text-[#171717] leading-tight">{item.name}</h4>
                        <button 
                          onClick={() => removeItem(item.cartItemId)}
                          className="text-neutral-400 hover:text-red-500 transition-colors p-1 -mr-1 -mt-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {item.selectedOptions.length > 0 && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                          {item.selectedOptions.map(o => o.name).join(", ")}
                        </p>
                      )}
                      
                      {item.note && (
                        <p className="text-xs text-[#e85d3f] mt-1 line-clamp-1 italic">
                          "{item.note}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center bg-neutral-100 rounded-full h-8">
                        <button 
                          className="w-8 h-full flex items-center justify-center text-neutral-600 hover:text-black rounded-l-full"
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button 
                          className="w-8 h-full flex items-center justify-center text-neutral-600 hover:text-black rounded-r-full"
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="font-bold text-sm">
                        {money((item.price + item.selectedOptions.reduce((acc, o) => acc + o.price, 0)) * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 bg-white border-t border-neutral-100 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-neutral-500 font-medium">Subtotal</span>
              <span className="font-bold text-xl">{money(cartTotal)}</span>
            </div>
            <button 
              onClick={handleCheckout}
              className="w-full py-4 rounded-2xl bg-[#171717] hover:bg-[#2a2a2a] text-white font-bold transition-all shadow-lg shadow-black/10"
            >
              Continuar al pago
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
