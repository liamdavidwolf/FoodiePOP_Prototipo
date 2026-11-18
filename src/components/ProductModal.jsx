import React, { useState, useEffect } from "react";
import { X, Minus, Plus } from "lucide-react";
import { useCart } from "../context/CartContext";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function ProductModal({ product, restaurantSlug, onClose }) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);

  // Reiniciar estado cada vez que se abra o cambie el producto
  useEffect(() => {
    setQuantity(1);
    setSelectedOptions([]);
    setNote("");
    setAdded(false);
  }, [product?.id]);

  // Prevenir scroll de fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!product) return null;

  const handleOptionToggle = (option) => {
    setSelectedOptions(prev => {
      const exists = prev.find(o => o.id === option.id);
      if (exists) {
        return prev.filter(o => o.id !== option.id);
      } else {
        return [...prev, option];
      }
    });
  };

  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + (Number(opt.price) || 0), 0);
  const unitPrice = (Number(product.price) || 0) + optionsTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    const cleanOptions = selectedOptions.map(opt => ({
      id: opt.id,
      name: opt.name,
      price: opt.price,
    }));
    addToCart(product, quantity, cleanOptions, note, restaurantSlug);
    setAdded(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-48 sm:h-64 shrink-0">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-[#171717] hover:bg-white transition-colors"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <h2 className="text-2xl font-bold text-[#171717]">{product.name}</h2>
          <p className="text-neutral-500 mt-2 text-sm leading-relaxed">{product.description}</p>
          
          <div className="flex items-baseline gap-2 mt-3">
            <span className="font-bold text-[#e85d3f] text-xl">
              {money(unitPrice)}
            </span>
            {optionsTotal > 0 && (
              <span className="text-xs text-neutral-500 font-medium">
                (Base {money(product.price)} + Adicionales {money(optionsTotal)})
              </span>
            )}
          </div>

          {product.options && product.options.length > 0 && (
            <div className="mt-6">
              <h3 className="font-bold text-lg mb-3">Adicionales</h3>
              <div className="space-y-3">
                {product.options.map(opt => {
                  const isSelected = selectedOptions.some(o => o.id === opt.id);
                  const optionInputId = `option-${opt.id}`;
                  return (
                    <label 
                      key={opt.id} 
                      htmlFor={optionInputId}
                      className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-[#e85d3f] bg-orange-50/40 shadow-xs' 
                          : 'border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={optionInputId}
                          checked={isSelected}
                          onChange={() => handleOptionToggle(opt)}
                          className="sr-only"
                        />
                        <div 
                          aria-hidden="true"
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-[#e85d3f] border-[#e85d3f]' : 'border-neutral-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-neutral-800">{opt.name}</span>
                      </div>
                      <span className={`text-sm font-semibold ${isSelected ? 'text-[#e85d3f]' : 'text-neutral-500'}`}>
                        +{money(opt.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-bold text-lg mb-2">Notas especiales</h3>
            <textarea 
              className="w-full border border-neutral-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f] transition-all resize-none"
              rows="2"
              placeholder="Ej. Sin cebolla, salsas aparte..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="p-5 bg-white border-t border-neutral-100 mt-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-sm">Cantidad</span>
            <div className="flex items-center bg-neutral-100 rounded-full">
              <button 
                type="button"
                className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-black disabled:opacity-50"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                aria-label="Disminuir cantidad"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button 
                type="button"
                className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-black"
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Aumentar cantidad"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleAdd}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all flex justify-between items-center px-6 ${
              added ? 'bg-green-500' : 'bg-[#171717] hover:bg-[#2a2a2a]'
            }`}
          >
            <span>{added ? '¡Agregado al pedido!' : 'Agregar al carrito'}</span>
            {!added && <span>{money(total)}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
