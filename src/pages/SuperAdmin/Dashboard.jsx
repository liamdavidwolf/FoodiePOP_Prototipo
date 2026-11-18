import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Store,
  Users,
  Plus,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Calendar,
  Layers,
  Award,
  Clock
} from "lucide-react";
import { superadminApi } from "../../services/api";
import StatCard from "../../components/SuperAdmin/StatCard";
import DailyChart from "../../components/SuperAdmin/DailyChart";
import StatusBadge from "../../components/SuperAdmin/StatusBadge";
import CreateRestaurantModal from "../../components/SuperAdmin/CreateRestaurantModal";

function formatCOP(amount) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export default function Dashboard() {
  const [period, setPeriod] = useState(30);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchMetrics = async (selectedPeriod = period) => {
    try {
      setLoading(true);
      setError(null);
      const res = await superadminApi.getMetrics({ period: selectedPeriod });
      // res may be { success, data } or data
      const data = res?.data || res;
      setMetrics(data);
    } catch (err) {
      console.error("Error cargando métricas:", err);
      setError(err.message || "No fue posible cargar las métricas de la plataforma.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(period);
  }, [period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Dashboard Global
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Métricas operativas y financieras consolidadas de la red FoodiePOP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-1 shadow-sm">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => handlePeriodChange(days)}
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
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold shadow-sm hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Restaurante</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Error al consultar el servicio de métricas</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={() => fetchMetrics(period)}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 flex-shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white border border-neutral-200 p-4 animate-pulse" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-white border border-neutral-200 p-6 animate-pulse" />
        </div>
      )}

      {/* Metrics Content */}
      {metrics && (
        <>
          {/* Main Financial & Operational KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={`Ventas (${period} días)`}
              value={formatCOP(metrics.periodSales)}
              subtext="Excluye pedidos cancelados"
              icon={DollarSign}
              accent="emerald"
            />
            <StatCard
              title="Ventas de Hoy"
              value={formatCOP(metrics.todaySales)}
              subtext="Zona horaria America/Bogota"
              icon={TrendingUp}
              accent="orange"
            />
            <StatCard
              title="Ticket Promedio"
              value={formatCOP(metrics.averageTicket)}
              subtext={`Basado en ventas de ${period}d`}
              icon={ShoppingBag}
              accent="blue"
            />
            <StatCard
              title="Pedidos de Hoy"
              value={metrics.todayOrders}
              subtext={`Total histórico: ${metrics.totalOrders} pedidos`}
              icon={Clock}
              accent="purple"
            />
          </div>

          {/* Platform Scale KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Restaurantes en Plataforma"
              value={metrics.totalRestaurants}
              badge={{
                text: `${metrics.activeRestaurants} activos / ${metrics.closedOrPausedRestaurants} cerrados-pausados`,
                variant: metrics.activeRestaurants > 0 ? "success" : "neutral"
              }}
              icon={Store}
            />
            <StatCard
              title="Usuarios Totales"
              value={metrics.totalUsers}
              subtext="Clientes, administradores y superadmins"
              icon={Users}
            />
            <StatCard
              title="Pedidos Totales"
              value={metrics.totalOrders}
              subtext="Histórico acumulado en la plataforma"
              icon={Layers}
            />
          </div>

          {/* Daily Evolution Chart */}
          <DailyChart data={metrics.dailyEvolution} periodDays={period} />

          {/* Top Rankings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Restaurants */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-orange-600" />
                    <h3 className="text-sm font-bold text-neutral-900">
                      Restaurantes con Mayor Volumen ({period}d)
                    </h3>
                  </div>
                  <Link
                    to="/superadmin/restaurants"
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <span>Ver todos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-neutral-100 mt-2">
                  {metrics.topRestaurants && metrics.topRestaurants.length > 0 ? (
                    metrics.topRestaurants.map((rest, index) => (
                      <div
                        key={rest.id}
                        className="py-3 flex items-center justify-between hover:bg-neutral-50/50 px-1 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`/superadmin/restaurants/${rest.id}`}
                              className="text-sm font-semibold text-neutral-900 hover:text-orange-600 truncate block"
                            >
                              {rest.name}
                            </Link>
                            <p className="text-xs text-neutral-400 truncate">
                              /{rest.slug} • {rest.orderCount} {rest.orderCount === 1 ? "pedido" : "pedidos"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-neutral-900">
                            {formatCOP(rest.totalSales)}
                          </p>
                          <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                            Facturación
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-neutral-400">
                      Sin datos de ventas para restaurantes en este período.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Products */}
            <div className="rounded-xl border border-neutral-200 bg-white shadow-xs p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-600" />
                    <h3 className="text-sm font-bold text-neutral-900">
                      Productos Más Vendidos ({period}d)
                    </h3>
                  </div>
                  <span className="text-xs text-neutral-400">Por unidades</span>
                </div>

                <div className="divide-y divide-neutral-100 mt-2">
                  {metrics.topProducts && metrics.topProducts.length > 0 ? (
                    metrics.topProducts.map((prod, index) => (
                      <div
                        key={prod.id || index}
                        className="py-3 flex items-center justify-between hover:bg-neutral-50/50 px-1 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-900 truncate">
                              {prod.name}
                            </p>
                            <p className="text-xs text-neutral-400">
                              {prod.category || "General"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-neutral-900">
                            {prod.quantity} <span className="text-xs font-normal text-neutral-500">uds</span>
                          </p>
                          <p className="text-xs text-emerald-600 font-medium">
                            {formatCOP(prod.revenue)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-neutral-400">
                      Sin datos de productos vendidos en este período.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Restaurant Modal */}
      <CreateRestaurantModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          fetchMetrics(period);
        }}
      />
    </div>
  );
}

