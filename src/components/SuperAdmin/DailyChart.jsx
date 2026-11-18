import React, { useState } from "react";
import { TrendingUp, ShoppingBag, DollarSign } from "lucide-react";

const money = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

export default function DailyChart({ data = [], title = "Evolución de Ventas y Pedidos" }) {
  const [metric, setMetric] = useState("sales"); // "sales" | "orders"
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[#e8e8e4] text-center text-sm text-neutral-400">
        Sin datos disponibles para el período seleccionado.
      </div>
    );
  }

  const values = data.map((d) => (metric === "sales" ? d.sales : d.orders));
  const maxVal = Math.max(...values, 1);

  // Muestreo de etiquetas para evitar sobrecarga en períodos largos (30, 90 días)
  const step = data.length > 30 ? 7 : data.length > 14 ? 3 : 1;

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e8e8e4] shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-[#171717]">{title}</h3>
          <p className="text-xs text-neutral-500">
            Zona horaria oficial: America/Bogota (UTC-5) · Excluye cancelados
          </p>
        </div>

        <div className="flex items-center bg-neutral-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setMetric("sales")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              metric === "sales"
                ? "bg-white text-[#171717] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <DollarSign size={14} className="text-[#e85d3f]" /> Ventas (COP)
          </button>
          <button
            onClick={() => setMetric("orders")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              metric === "orders"
                ? "bg-white text-[#171717] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <ShoppingBag size={14} className="text-blue-600" /> Pedidos
          </button>
        </div>
      </div>

      {/* Gráfica de barras responsiva en SVG/HTML */}
      <div className="relative pt-6">
        <div className="h-48 flex items-end gap-1 sm:gap-1.5 w-full">
          {data.map((item, idx) => {
            const val = metric === "sales" ? item.sales : item.orders;
            const pct = Math.max(4, Math.round((val / maxVal) * 100));
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={item.date}
                className="flex-1 h-full flex flex-col justify-end items-center relative group"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip flotante */}
                {isHovered && (
                  <div className="absolute -top-12 z-20 bg-[#171717] text-white text-[11px] font-medium py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                    <span className="block text-neutral-400 text-[10px]">{item.date}</span>
                    <span className="font-bold">
                      {metric === "sales" ? money(item.sales) : `${item.orders} pedido(s)`}
                    </span>
                  </div>
                )}

                {/* Barra */}
                <div
                  style={{ height: `${pct}%` }}
                  className={`w-full rounded-t-sm transition-all duration-200 ${
                    metric === "sales"
                      ? isHovered
                        ? "bg-[#e85d3f]"
                        : "bg-[#fbdcd5] hover:bg-[#e85d3f]"
                      : isHovered
                      ? "bg-blue-600"
                      : "bg-blue-200 hover:bg-blue-600"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Eje X de fechas */}
        <div className="flex justify-between border-t border-neutral-100 mt-2 pt-2 text-[10px] text-neutral-400">
          {data.map((item, idx) => {
            if (idx % step === 0 || idx === data.length - 1) {
              const parts = item.date.split("-");
              const label = `${parts[2]}/${parts[1]}`;
              return <span key={item.date}>{label}</span>;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

