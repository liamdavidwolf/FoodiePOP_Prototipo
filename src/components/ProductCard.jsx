import React from "react";
import { Plus } from "lucide-react";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default function ProductCard({ product, onClick }) {
  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-[#e8e8e4] flex flex-col h-full"
      onClick={() => onClick(product)}
    >
      <div className="h-48 overflow-hidden relative">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
        />
        {!product.available && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <span className="bg-[#171717] text-white px-3 py-1 rounded-full text-xs font-semibold">
              Agotado
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-lg text-[#171717]">{product.name}</h3>
        <p className="text-sm text-neutral-500 mt-1 line-clamp-2 flex-1">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bold text-[#e85d3f] text-lg">{money(product.price)}</span>
          <button 
            className="w-8 h-8 rounded-full bg-[#f5f5f2] flex items-center justify-center text-[#171717] hover:bg-[#e85d3f] hover:text-white transition-colors"
            disabled={!product.available}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
