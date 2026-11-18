import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Store,
  RefreshCw,
  AlertCircle,
  Award,
  Layers,
  Info,
  Calendar,
  CheckCircle2,
  Clock
} from "lucide-react";
import { superadminApi } from "../../services/api";
import DailyChart from "../../components/SuperAdmin/DailyChart";
import StatCard from "../../components/SuperAdmin/StatCard";

function formatCOP(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async (p = period) => {
    try {
      setLoading(true);
      setError(null);
      const res = await superadminApi.getMetrics({ period: p });
      const data = res?.data || res;
      setMetrics(data);
    } catch (err) {
      console.error("Error al cargar analítica:", err);
      setError(err.message || "No fue posible cargar las analíticas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(period);
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Analítica y Tendencias Globales
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Análisis consolidado del rendimiento comercial de todos los restaurantes asociados.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-1 shadow-sm">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                disabled={loading}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  period === days
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                {days} días
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchMetrics(period)}
            disabled={loading}
            className="p-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors"
            title="Recargar analítica"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchMetrics(period)} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Skeletons */}
      {loading && !metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white border border-neutral-200 p-4 animate-pulse" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-white border border-neutral-200 p-6 animate-pulse" />
        </div>
      )}

      {metrics && (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title={`Facturación Acumulada (${period}d)`}
              value={formatCOP(metrics.periodSales)}
              subtext="Pedidos confirmados y completados"
              icon={DollarSign}
              accent="emerald"
            />
            <StatCard
              title={`Pedidos Válidos (${period}d)`}
              value={metrics.periodValidOrders || 0}
              subtext={`Promedio: ~${Math.round((metrics.periodValidOrders || 0) / period)} pedidos/día`}
              icon={ShoppingBag}
              accent="orange"
            />
            <StatCard
              title="Ticket Promedio Global"
              value={formatCOP(metrics.averageTicket)}
              subtext="Monto promedio por transacción válida"
              icon={TrendingUp}
              accent="blue"
            />
          </div>

          {/* Daily Evolution Chart */}
          <DailyChart data={metrics.dailyEvolution} periodDays={period} />

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Restaurants By Volume */}
            <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-neutral-900">
                    Sedes Líderes en Ventas ({period}d)
                  </h3>
                </div>
                <Link
                  to="/superadmin/restaurants"
                  className="text-xs text-orange-600 font-semibold hover:underline"
                >
                  Ver todas
                </Link>
              </div>

              <div className="divide-y divide-neutral-100">
                {metrics.topRestaurants && metrics.topRestaurants.length > 0 ? (
                  metrics.topRestaurants.map((tr, index) => {
                    const share = metrics.periodSales > 0 ? Math.round((tr.revenue / metrics.periodSales) * 100) : 0;
                    return (
                      <div key={tr.restaurant?.id || index} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-900 text-xs truncate">
                              {tr.restaurant?.name || "Restaurante"}
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              {tr.orderCount} {tr.orderCount === 1 ? "pedido" : "pedidos"} ({share}% del total)
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-neutral-900 text-xs">{formatCOP(tr.revenue)}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Sin ventas registradas en el período.
                  </div>
                )}
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-neutral-900">
                    Productos Más Vendidos ({period}d)
                  </h3>
                </div>
                <span className="text-xs text-neutral-400">Top unidades</span>
              </div>

              <div className="divide-y divide-neutral-100">
                {metrics.topProducts && metrics.topProducts.length > 0 ? (
                  metrics.topProducts.map((p, index) => (
                    <div key={p.id || index} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 text-xs truncate">{p.name}</p>
                          <p className="text-[11px] text-neutral-400">
                            {p.restaurant?.name ? `${p.restaurant.name} • ` : ""}
                            {p.soldUnits || p.quantity || 0} unidades vendidas
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-neutral-900 text-xs">{formatCOP(p.revenue)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    Sin datos de productos en el período.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accounting & Governance Notice */}
          <div className="p-4 rounded-xl bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 flex items-start gap-3">
            <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-neutral-800">
                Lineamientos de Presentación Financiera SuperAdmin
              </p>
              <p className="leading-relaxed">
                Todas las métricas de ingresos representan ventas brutas de los restaurantes calculadas en tiempo real sin deducción de márgenes operativos ni costos variables, dado que el catálogo no cuenta con historial inmutable de costos de insumos para pedidos pasados. Los cálculos diarios y cierres están sincronizados estrictamente con la zona horaria <code>America/Bogota (UTC-5)</code>.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

