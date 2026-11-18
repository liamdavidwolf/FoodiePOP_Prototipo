import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  LayoutDashboard, UtensilsCrossed, ShoppingBag, Users, Calculator, 
  BarChart3, Target, TicketPercent, Search, Bell, Plus, ChevronRight, 
  TrendingUp, Clock3, Star, Menu, X, MoreHorizontal, ArrowUpRight, 
  ShieldAlert, LogIn, RefreshCw, CheckCircle2, XCircle, Edit2, Layers,
  DollarSign, Sparkles, AlertCircle, ArrowRight, Award, Trophy, Calendar, 
  Clock, Flame, Zap, BarChart2, Edit3, Save, Trash2, Copy, Check,
  LogOut, Store
} from "lucide-react";
import AdminOrders from "./Orders";
import ProductFormModal from "../../components/Admin/ProductFormModal";
import CouponFormModal from "../../components/Admin/CouponFormModal";
import CategoryManagerModal from "../../components/Admin/CategoryManagerModal";
import { useAuth } from "../../context/AuthContext";
import { orderApi, menuApi, couponApi, RESTAURANT_SLUG } from "../../services/api";
import { useNavigate } from "react-router-dom";

const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const nav = [
  ["Dashboard", LayoutDashboard], 
  ["Catálogo", UtensilsCrossed], 
  ["Pedidos", ShoppingBag], 
  ["Clientes", Users], 
  ["Costos y ganancias", Calculator], 
  ["Análisis", BarChart3], 
  ["Metas", Target], 
  ["Cupones", TicketPercent]
];

export default function AdminDashboard({ initialPage = "Dashboard" }) {
  const [page, setPage] = useState(initialPage); 
  const [mobile, setMobile] = useState(false);
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Restaurante activo asignado al usuario
  const userRestaurant = user?.memberships?.[0]?.restaurant;
  const activeSlug = userRestaurant?.slug || RESTAURANT_SLUG;
  const activeRestaurantName = userRestaurant?.name || (activeSlug !== "la-esquina-food" ? activeSlug : "La Esquina Food");

  // Cerrar menú de usuario al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Diagnóstico: imprime en consola el slug activo y membresías disponibles
  useEffect(() => {
    if (user) {
      console.log("[AdminDashboard] user.role:", user.role);
      console.log("[AdminDashboard] user.memberships:", user.memberships);
      console.log("[AdminDashboard] activeSlug:", activeSlug);
    }
  }, [user, activeSlug]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  const go = p => { setPage(p); setMobile(false); };

  // 1. Estado de verificación de autenticación
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#e85d3f] border-t-transparent mb-3" />
        <p className="text-sm font-medium text-neutral-500">Verificando credenciales de administrador...</p>
      </div>
    );
  }

  // 2. No autenticado -> Redirigir a inicio de sesión
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm border border-[#e8e8e4]">
          <div className="w-16 h-16 bg-[#fff4f1] text-[#e85d3f] rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={28} />
          </div>
          <h2 className="text-xl font-bold text-[#171717] mb-2">Acceso Administrativo</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Inicia sesión con tu cuenta de Administrador para gestionar el restaurante.
          </p>
          <button 
            onClick={() => navigate("/login", { state: { from: "/admin" } })}
            className="w-full py-3.5 bg-[#171717] hover:bg-[#2a2a2a] text-white rounded-xl font-bold transition-colors text-sm"
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    );
  }

  // 3. Usuario autenticado pero con rol CLIENT -> Denegar acceso
  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm border border-[#e8e8e4]">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#171717] mb-2">Acceso Restringido</h2>
          <p className="text-sm text-neutral-500 mb-6">
            Esta sección está reservada exclusivamente para administradores. Tu cuenta ({user.email}) tiene rol de Cliente.
          </p>
          <button 
            onClick={() => navigate("/")}
            className="w-full py-3.5 bg-[#171717] hover:bg-[#2a2a2a] text-white rounded-xl font-bold transition-colors text-sm"
          >
            Volver al menú de clientes
          </button>
        </div>
      </div>
    );
  }

  const userInitials = (user.name || "AD").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#f7f7f5]">
      <aside className={`${mobile ? "fixed inset-y-0 left-0 z-30" : "hidden"} lg:flex w-[250px] bg-[#171717] text-white flex-col shrink-0`}>
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-black tracking-tight cursor-pointer" onClick={() => navigate("/")}>
              Foodie<span className="text-[#ff7559]">POP</span>
            </div>
            <div className="text-xs text-white/40 mt-1">Gestión de Restaurante</div>
          </div>
          <button className="lg:hidden" onClick={() => setMobile(false)}><X size={20} /></button>
        </div>
        <div className="px-3 space-y-1 flex-1">
          {nav.map(([label, Icon]) => (
            <button 
              key={label} 
              onClick={() => go(label)} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition ${page === label ? "bg-white text-[#171717] font-semibold" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </div>
        <div className="p-4">
          <div className="bg-white/7 rounded-2xl p-4">
            <div className="text-xs text-white/40">RESTAURANTE ACTIVO</div>
            <div className="font-semibold mt-1 truncate" title={activeRestaurantName}>{activeRestaurantName}</div>
            <div className="text-xs text-neutral-400 mt-0.5 font-mono">/{activeSlug}</div>
            <div className="text-xs text-emerald-400 mt-1 font-medium">● Conectado a Neon</div>
          </div>
        </div>
      </aside>
      {mobile && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setMobile(false)} />}
      <main className="flex-1 min-w-0">
        <header className="h-[76px] bg-white border-b border-[#e8e8e4] flex items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2" onClick={() => setMobile(true)}><Menu /></button>
            <div><div className="text-sm text-neutral-400">{activeRestaurantName} /</div><div className="font-semibold">{page}</div></div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/${activeSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex text-xs font-semibold text-neutral-500 hover:text-[#e85d3f] border border-neutral-200 px-3 py-1.5 rounded-full transition-colors"
            >
              Ver tienda pública ↗
            </a>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-[#f5c7ba] hover:ring-2 hover:ring-[#e85d3f]/50 text-neutral-800 grid place-items-center font-bold text-sm transition-all cursor-pointer shadow-sm overflow-hidden"
                title={`${activeRestaurantName} · ${user.name}`}
              >
                {userRestaurant?.logoUrl ? (
                  <img 
                    src={userRestaurant.logoUrl} 
                    alt={activeRestaurantName} 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  userInitials
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-neutral-100">
                    <p className="text-xs font-bold text-neutral-800 truncate">{activeRestaurantName}</p>
                    <p className="text-[11px] text-neutral-400 font-mono">/{activeSlug}</p>
                    <div className="mt-2 pt-2 border-t border-neutral-100">
                      <p className="text-xs font-semibold text-neutral-700 truncate">{user.name}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                        {user.role}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <a
                      href={`/${activeSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors sm:hidden"
                    >
                      <Store size={14} className="text-neutral-500" />
                      <span>Ver tienda pública ↗</span>
                    </a>

                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                        navigate("/login");
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="p-5 md:p-8 max-w-[1500px] mx-auto">
          {page === "Dashboard" ? <Dashboard go={go} restaurantSlug={activeSlug} /> : 
           page === "Catálogo" ? <Catalog restaurantSlug={activeSlug} /> : 
           page === "Pedidos" ? <AdminOrders restaurantSlug={activeSlug} restaurantName={activeRestaurantName} /> : 
           page === "Clientes" ? <Customers restaurantSlug={activeSlug} restaurantName={activeRestaurantName} /> : 
           page === "Costos y ganancias" ? <Costs restaurantSlug={activeSlug} /> : 
           page === "Análisis" ? <Analytics restaurantSlug={activeSlug} /> : 
           page === "Metas" ? <Goals restaurantSlug={activeSlug} /> : 
           <Coupons restaurantSlug={activeSlug} />}
        </div>
      </main>
    </div>
  );
}

function PageHead({ title, desc, button, onClick, actions }) { 
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-neutral-500 mt-2">{desc}</p>
      </div>
      <div className="flex items-center gap-2 self-start flex-wrap">
        {actions}
        {button && <button onClick={onClick} className="bg-[#171717] hover:bg-[#2a2a2a] text-white px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"><Plus size={18} />{button}</button>}
      </div>
    </div>
  );
}

function Dashboard({ go, restaurantSlug = RESTAURANT_SLUG }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orderApi.getRestaurantMetrics(restaurantSlug);
      setMetrics(data);
    } catch (err) {
      console.error("Error al obtener métricas del restaurante:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const todaySales = metrics.todaySales || 0;
  const todayOrders = metrics.todayOrdersCount || 0;
  const todayProfit = metrics.todayProfit || 0;
  const monthlyGoal = 5000000;
  const goalPercent = Math.min(100, Math.round((todaySales / 500000) * 100));

  const maxWeeklySale = Math.max(...(metrics.weeklyDays || []).map(d => d.totalSales), 1);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <PageHead title="Resumen Operativo 👋" desc="Métricas calculadas en tiempo real a partir de PostgreSQL en Neon." />
        <button 
          onClick={fetchMetrics} 
          className="p-2.5 bg-white border border-[#e8e8e4] rounded-xl text-neutral-500 hover:text-[#171717] transition-colors"
          title="Actualizar métricas"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Stat title="Ventas de hoy" value={money(todaySales)} delta="Directo de Neon" icon={TrendingUp} />
        <Stat title="Pedidos de hoy" value={todayOrders} delta="Actualizado" icon={ShoppingBag} />
        <Stat title="Ganancia estimada" value={money(todayProfit)} delta="Margen real" icon={ArrowUpRight} />
        <Stat title="Meta diaria ($500K)" value={`${goalPercent}%`} delta={`Faltan ${money(Math.max(0, 500000 - todaySales))}`} icon={Target} />
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-5">
        <section className="card p-5 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="font-bold text-lg">Ventas de los últimos 7 días</h2><p className="text-neutral-500 text-sm">Ingresos por día calculados desde órdenes reales</p></div>
          </div>
          <div className="h-56 flex items-end gap-3 md:gap-5 border-b border-neutral-100 pb-0">
            {(metrics.weeklyDays || []).map((day, i) => {
              const heightPct = Math.max(10, Math.round((day.totalSales / maxWeeklySale) * 100));
              return (
                <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative">
                  <div className="absolute -top-7 bg-neutral-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10 pointer-events-none">
                    {money(day.totalSales)} ({day.ordersCount} pedidos)
                  </div>
                  <div className="w-full max-w-[48px] rounded-t-xl bg-[#f7b5a5] hover:bg-[#e85d3f] transition" style={{ height: `${heightPct}%` }}></div>
                  <span className="text-xs text-neutral-500">{day.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5 md:p-6">
          <div className="flex justify-between">
            <div><h2 className="font-bold text-lg">Producto estrella</h2><p className="text-neutral-500 text-sm">Mayor volumen en Neon</p></div>
            <Star className="text-[#e85d3f]" fill="currentColor" />
          </div>
          {metrics.topProduct ? (
            <div className="mt-5 p-4 rounded-2xl bg-[#fff4f1]">
              <div className="text-4xl">⭐</div>
              <div className="font-bold text-xl mt-3">{metrics.topProduct.name}</div>
              <div className="text-sm text-neutral-500 mt-1">{metrics.topProduct.sold} unidades vendidas</div>
              <div className="flex justify-between mt-5 text-sm">
                <span>Ingresos generados</span>
                <strong>{money(metrics.topProduct.revenue)}</strong>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center text-neutral-400 py-6">
              <p className="text-sm">Sin ventas registradas aún</p>
            </div>
          )}
          <button onClick={() => go("Catálogo")} className="mt-4 w-full py-2.5 rounded-xl border font-semibold text-sm hover:bg-neutral-50 transition-colors">
            Ver catálogo completo <ChevronRight size={16} className="inline" />
          </button>
        </section>
      </div>

      <div className="grid xl:grid-cols-[1.4fr_1fr] gap-5 mt-5">
        <section className="card overflow-hidden">
          <div className="p-5 flex justify-between items-center">
            <div><h2 className="font-bold text-lg">Pedidos recientes</h2><p className="text-neutral-500 text-sm">Últimos pedidos registrados</p></div>
            <button onClick={() => go("Pedidos")} className="text-sm font-semibold text-[#e85d3f] hover:underline">Ver todos</button>
          </div>
          <div className="divide-y">
            {(metrics.recentOrders || []).slice(0, 4).map(o => <OrderRow key={o.orderId || o.id} o={o} />)}
            {(metrics.recentOrders || []).length === 0 && <div className="p-8 text-neutral-400 text-sm text-center">No hay pedidos registrados en Neon todavía.</div>}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex justify-between">
            <div><h2 className="font-bold text-lg">Métricas de Clientes</h2><p className="text-neutral-500 text-sm">Resumen de compradores</p></div>
            <Users className="text-[#e85d3f]" />
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <span className="text-sm text-neutral-500">Clientes únicos</span>
              <strong className="text-lg">{metrics.customersSummary?.totalCustomers || 0}</strong>
            </div>
            <div className="flex justify-between items-center border-b pb-3">
              <span className="text-sm text-neutral-500">Clientes recurrentes (2+ pedidos)</span>
              <strong className="text-lg">{metrics.customersSummary?.frequentCustomers || 0}</strong>
            </div>
            <div className="flex justify-between items-center border-b pb-3">
              <span className="text-sm text-neutral-500">Tasa de recompra</span>
              <strong className="text-lg text-[#e85d3f]">{metrics.customersSummary?.repeatRate || 0}%</strong>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm text-neutral-500">Ticket promedio</span>
              <strong className="text-lg">{money(metrics.customersSummary?.averageTicket || 0)}</strong>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ title, value, delta, icon: Icon }) { 
  return (
    <div className="card p-4 md:p-5">
      <div className="flex justify-between items-start">
        <span className="text-neutral-500 text-sm">{title}</span>
        <div className="p-2 bg-[#fff4f1] rounded-lg"><Icon size={17} className="text-[#e85d3f]" /></div>
      </div>
      <div className="text-2xl md:text-3xl font-bold mt-4">{value}</div>
      <div className="text-xs mt-2 text-[#e85d3f] font-semibold">{delta}</div>
    </div>
  );
}

function OrderRow({ o }) { 
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 grid place-items-center"><ShoppingBag size={17} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{o.orderNumber || o.id} · {o.customer?.name}</div>
        <div className="text-xs text-neutral-500 truncate">{o.items.length} producto(s) · {o.orderType === 'delivery' ? 'Domicilio' : 'Recoger'}</div>
      </div>
      <div className="hidden sm:block text-right">
        <div className="font-semibold text-sm">{money(o.total)}</div>
        <Status text={o.status} />
      </div>
      <MoreHorizontal size={18} className="text-neutral-400" />
    </div>
  );
}

function Status({ text }) { 
  const statusMap = {
    received: { label: "Recibido", color: "bg-orange-50 text-orange-700" },
    confirmed: { label: "Confirmado", color: "bg-blue-50 text-blue-700" },
    preparing: { label: "En preparación", color: "bg-yellow-50 text-yellow-700" },
    ready: { label: "Listo", color: "bg-green-50 text-green-700" },
    on_the_way: { label: "En camino", color: "bg-purple-50 text-purple-700" },
    delivered: { label: "Entregado", color: "bg-neutral-100 text-neutral-600" },
    cancelled: { label: "Cancelado", color: "bg-red-50 text-red-700" }
  };
  const mapped = statusMap[text] || statusMap.received;
  return <span className={`inline-block mt-1 px-2 py-1 rounded-full text-[11px] font-semibold ${mapped.color}`}>{mapped.label}</span>;
}

function Table({ children, heads }) { 
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr>{heads.map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide text-neutral-400 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

function Catalog({ restaurantSlug = RESTAURANT_SLUG }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal de Producto (Crear / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Modal de Categorías (Crear / Editar / Disponibilidad / Eliminar)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!restaurantSlug) return; // No cargar si no tenemos slug aún
    console.log("[Catalog] loadData → restaurantSlug:", restaurantSlug);
    setLoading(true);
    setLoadError(null);
    try {
      const [prodsData, catsData] = await Promise.all([
        menuApi.getAdminProducts(restaurantSlug),
        // Endpoint admin: incluye categorías inactivas y funciona aunque el restaurante esté pausado
        menuApi.getAdminCategories(restaurantSlug).catch(() => []),
      ]);
      setProducts(prodsData || []);
      setCategories(catsData || []);
    } catch (err) {
      console.error("Error al cargar catálogo:", err);
      setLoadError(err.message || "Error al cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (productId, currentStatus) => {
    setTogglingId(productId);
    try {
      const updated = await menuApi.toggleProductAvailability(productId, !currentStatus);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, available: updated.available } : p));
    } catch (err) {
      alert(`Error al actualizar disponibilidad: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenCreate = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchCat = selectedCategory === "all" || p.categoryId === selectedCategory || p.category?.id === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <PageHead 
        title="Catálogo" 
        desc="Gestión completa de productos, categorías, precios, costos de producción y adicionales." 
        button="Nuevo producto"
        onClick={handleOpenCreate}
        actions={
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 px-4 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-2xs text-sm"
          >
            <Layers size={18} className="text-[#e85d3f]" />
            Gestionar categorías
          </button>
        }
      />

      {/* Barra de Filtros y Búsqueda */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-50 rounded-xl text-xs border border-neutral-200 focus:outline-none focus:border-[#e85d3f]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            title="Administrar categorías del menú"
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap bg-[#fff4f1] hover:bg-[#ffece7] text-[#e85d3f] border border-[#e85d3f]/20 flex items-center gap-1 transition-colors"
          >
            <Plus size={13} /> Categoría
          </button>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === "all"
                ? "bg-[#171717] text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Todas ({products.length})
          </button>
          {categories.map(c => {
            const count = products.filter(p => p.categoryId === c.id || p.category?.id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? "bg-[#171717] text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="p-8 bg-white rounded-3xl animate-pulse space-y-3">
          <div className="h-6 bg-neutral-200 rounded w-1/4" />
          <div className="h-4 bg-neutral-100 rounded w-full" />
          <div className="h-4 bg-neutral-100 rounded w-full" />
        </div>
      ) : loadError ? (
        <div className="card p-10 text-center space-y-3">
          <AlertCircle size={36} className="mx-auto text-red-400" />
          <p className="font-semibold text-neutral-800">No se pudo cargar el catálogo</p>
          <p className="text-xs text-red-500">{loadError}</p>
          <button
            onClick={loadData}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] text-white text-xs font-bold rounded-xl"
          >
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card p-12 text-center text-neutral-400 space-y-3">
          <UtensilsCrossed size={40} className="mx-auto text-neutral-300" />
          <p className="font-semibold text-neutral-700">No se encontraron productos</p>
          <p className="text-xs text-neutral-500">Prueba ajustando los filtros o crea un nuevo producto para tu menú.</p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#171717] text-white text-xs font-bold rounded-xl"
          >
            <Plus size={14} /> Crear primer producto
          </button>
        </div>
      ) : (
        <Table heads={["Producto", "Categoría", "Precio", "Costo", "Ganancia Unit.", "Adicionales", "Disponibilidad", "Acciones"]}>
          {filteredProducts.map(p => {
            const cost = p.cost || 0;
            const profit = p.price - cost;
            const margin = p.price > 0 ? Math.round((profit / p.price) * 100) : 0;
            const optionsCount = (p.options || []).length;
            const activeOptionsCount = (p.options || []).filter(o => o.active).length;

            return (
              <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        className="w-10 h-10 rounded-xl object-cover border border-neutral-100 shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#e85d3f] grid place-items-center font-bold text-xs shrink-0">
                        🍔
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[#171717] text-sm">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-neutral-400 truncate max-w-[220px]">{p.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-lg text-xs font-medium">
                    {p.category?.name || "General"}
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold text-neutral-800">{money(p.price)}</td>
                <td className="px-5 py-4 text-neutral-500">{money(cost)}</td>
                <td className="px-5 py-4">
                  <div className="font-bold text-[#e85d3f]">{money(profit)}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">{margin}% margen</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    optionsCount > 0 ? "bg-orange-50 text-orange-700" : "bg-neutral-100 text-neutral-400"
                  }`}>
                    <Layers size={12} />
                    {optionsCount > 0 ? `${activeOptionsCount}/${optionsCount} activos` : "Sin opciones"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button
                    disabled={togglingId === p.id}
                    onClick={() => handleToggle(p.id, p.available)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                      p.available 
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" 
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    }`}
                    title="Clic para cambiar disponibilidad"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${p.available ? "bg-emerald-500" : "bg-neutral-400"}`} />
                    {togglingId === p.id ? "Cambiando..." : p.available ? "Disponible" : "Agotado"}
                  </button>
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-[#171717] transition-colors shadow-2xs"
                  >
                    <Edit2 size={13} className="text-neutral-500" />
                    <span>Editar</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Modal de Creación y Edición de Producto */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        product={selectedProduct}
        categories={categories}
        restaurantSlug={restaurantSlug}
        onSaved={loadData}
      />

      {/* Modal de Gestión Administrativa de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        restaurantSlug={restaurantSlug}
        onCategoriesChanged={loadData}
      />
    </>
  );
}

function Customers({ restaurantSlug = RESTAURANT_SLUG, restaurantName = "tu restaurante" }) {
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!restaurantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const [m, o] = await Promise.all([
        orderApi.getRestaurantMetrics(restaurantSlug).catch(err => {
          console.warn("[Customers] Error al obtener métricas:", err);
          return null;
        }),
        orderApi.getRestaurantOrders(restaurantSlug).catch(err => {
          console.warn("[Customers] Error al obtener pedidos:", err);
          return [];
        }),
      ]);
      setMetrics(m);
      setOrders(Array.isArray(o) ? o : []);
    } catch (err) {
      console.error("[Customers] Error:", err);
      setError(err.message || "Error al cargar la información de clientes.");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Consolidar lista de clientes únicos a partir de los pedidos del restaurante
  const customerMap = new Map();
  orders.forEach(o => {
    const phone = o.customer?.phone || o.customerPhone || "";
    const name = o.customer?.name || o.customerName || "Cliente";
    const key = phone || name;
    
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name,
        phone: phone || "Sin teléfono",
        ordersCount: 1,
        totalSpent: o.total || 0,
        lastOrderId: o.orderNumber || o.id,
        lastOrderDate: o.createdAt,
      });
    } else {
      const existing = customerMap.get(key);
      existing.ordersCount += 1;
      existing.totalSpent += (o.total || 0);
      if (new Date(o.createdAt) > new Date(existing.lastOrderDate)) {
        existing.lastOrderId = o.orderNumber || o.id;
        existing.lastOrderDate = o.createdAt;
      }
    }
  });

  const customerList = Array.from(customerMap.values()).sort(
    (a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate)
  );

  const totalCustomers = metrics?.customersSummary?.totalCustomers ?? customerList.length;
  const frequentCustomers = metrics?.customersSummary?.frequentCustomers ?? customerList.filter(c => c.ordersCount >= 2).length;
  const repeatRate = totalCustomers > 0 ? Math.round((frequentCustomers / totalCustomers) * 100) : 0;
  const averageTicket = metrics?.customersSummary?.averageTicket ?? (orders.length > 0 ? Math.round(orders.reduce((sum, o) => sum + o.total, 0) / orders.length) : 0);

  return (
    <>
      <PageHead 
        title="Clientes" 
        desc={`Clientes que han realizado pedidos en ${restaurantName}.`} 
        actions={
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e8e8e4] rounded-xl text-xs font-semibold hover:bg-neutral-50 transition-colors shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-white border border-red-300 rounded-lg font-semibold text-xs hover:bg-red-50 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          ["Clientes únicos", totalCustomers],
          ["Clientes recurrentes", frequentCustomers],
          ["Tasa de recompra", `${repeatRate}%`],
          ["Ticket promedio", money(averageTicket)]
        ].map(x => (
          <div className="card p-4" key={x[0]}>
            <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">{x[0]}</div>
            <div className="text-2xl font-bold mt-2 text-neutral-900">{x[1]}</div>
          </div>
        ))}
      </div>

      {loading && customerList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 shadow-2xs">
          <div className="w-8 h-8 border-3 border-[#e85d3f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-neutral-500">Consultando clientes del restaurante...</p>
        </div>
      ) : customerList.length === 0 ? (
        <div className="card p-12 text-center text-neutral-400 space-y-3">
          <Users size={44} className="mx-auto text-neutral-300" />
          <p className="font-semibold text-neutral-700">Aún no hay clientes registrados</p>
          <p className="text-xs text-neutral-500">
            Los clientes que realicen pedidos en {restaurantName} aparecerán listados aquí automáticamente con sus datos de contacto y frecuencia de compra.
          </p>
        </div>
      ) : (
        <Table heads={["Cliente", "Teléfono", "Pedidos Realizados", "Total Facturado", "Último Pedido", "Fecha"]}>
          {customerList.map((c, i) => (
            <tr key={i} className="hover:bg-neutral-50/70 transition-colors">
              <td className="px-5 py-4 font-semibold text-neutral-800">{c.name}</td>
              <td className="px-5 py-4 text-neutral-500">{c.phone}</td>
              <td className="px-5 py-4">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  c.ordersCount >= 2 ? "bg-orange-100 text-orange-800" : "bg-neutral-100 text-neutral-600"
                }`}>
                  {c.ordersCount} {c.ordersCount === 1 ? "pedido" : "pedidos"}
                </span>
              </td>
              <td className="px-5 py-4 font-semibold text-[#e85d3f]">{money(c.totalSpent)}</td>
              <td className="px-5 py-4 font-mono font-medium text-xs text-neutral-600">{c.lastOrderId}</td>
              <td className="px-5 py-4 text-neutral-500 text-xs">{new Date(c.lastOrderDate).toLocaleDateString('es-CO')}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function Costs({ restaurantSlug = RESTAURANT_SLUG }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de la Calculadora Interactiva de Simulación
  const [simName, setSimName] = useState("Simulación Personalizada");
  const [simPrice, setSimPrice] = useState(25000);
  const [simCost, setSimCost] = useState(11000);
  const [simUnits, setSimUnits] = useState(100);
  const [selectedProductId, setSelectedProductId] = useState("");

  const loadData = useCallback(async () => {
    if (!restaurantSlug) return;
    setLoading(true);
    try {
      const data = await menuApi.getAdminProducts(restaurantSlug);
      setProducts(data || []);
      if (data && data.length > 0) {
        const first = data[0];
        setSimName(first.name);
        setSimPrice(first.price);
        setSimCost(first.cost || 0);
        setSelectedProductId(first.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selección de producto en el dropdown de simulación
  const handleSelectProduct = (e) => {
    const prodId = e.target.value;
    setSelectedProductId(prodId);
    if (!prodId) {
      setSimName("Simulación Personalizada");
      return;
    }
    const found = products.find(p => p.id === prodId);
    if (found) {
      setSimName(found.name);
      setSimPrice(found.price);
      setSimCost(found.cost || 0);
    }
  };

  // Cargar producto desde la tabla a la calculadora
  const handleLoadToCalc = (p) => {
    setSelectedProductId(p.id);
    setSimName(p.name);
    setSimPrice(p.price);
    setSimCost(p.cost || 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fórmulas requeridas por el Sprint:
  // Ganancia = Precio de venta - Costo de producción
  // Margen (%) = (Ganancia / Precio de venta) × 100
  const priceVal = Number(simPrice) || 0;
  const costVal = Number(simCost) || 0;
  const unitProfit = priceVal - costVal;
  const marginPct = priceVal > 0 ? ((unitProfit / priceVal) * 100).toFixed(1) : "0.0";
  const numMarginPct = Number(marginPct);

  // Proyección de volumen mensual
  const unitsVal = Number(simUnits) || 0;
  const projectedRevenue = priceVal * unitsVal;
  const projectedCosts = costVal * unitsVal;
  const projectedProfit = unitProfit * unitsVal;

  // Métricas generales del catálogo guardado
  const catalogWithMargins = products.map(p => {
    const c = p.cost || 0;
    const prof = p.price - c;
    const m = p.price > 0 ? (prof / p.price) * 100 : 0;
    return { ...p, profit: prof, margin: m };
  });

  const avgMargin = catalogWithMargins.length > 0 
    ? Math.round(catalogWithMargins.reduce((sum, p) => sum + p.margin, 0) / catalogWithMargins.length)
    : 0;

  const bestProduct = catalogWithMargins.length > 0 
    ? [...catalogWithMargins].sort((a, b) => b.margin - a.margin)[0] 
    : null;

  return (
    <>
      <PageHead 
        title="Costos y ganancias" 
        desc="Calculadora interactiva de rentabilidad, análisis de márgenes y simulación de escenarios de costos." 
      />

      {/* ─── CALCULADORA INTERACTIVA Y KPIS ─── */}
      <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6 mb-8">
        {/* Panel de Calculadora Interactiva */}
        <div className="card p-6 bg-white border border-[#e8e8e4] relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center font-bold">
                <Calculator size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#171717]">Calculadora Interactiva de Rentabilidad</h2>
                <p className="text-xs text-neutral-500">Simula diferentes valores sin modificar automáticamente los datos guardados.</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              <Sparkles size={12} /> Modo Simulación
            </span>
          </div>

          {/* Selector de Producto */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Cargar datos desde un producto del catálogo (opcional):
            </label>
            <select
              value={selectedProductId}
              onChange={handleSelectProduct}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs bg-neutral-50 focus:outline-none focus:border-[#e85d3f]"
            >
              <option value="">-- Simulación personalizada (ingreso manual) --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Precio: {money(p.price)} · Costo: {money(p.cost || 0)})
                </option>
              ))}
            </select>
          </div>

          {/* Entradas del simulador */}
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Precio de venta (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">$</span>
                <input 
                  type="number" 
                  min="0"
                  value={simPrice}
                  onChange={e => setSimPrice(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-[#171717] focus:outline-none focus:border-[#e85d3f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Costo de producción (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">$</span>
                <input 
                  type="number" 
                  min="0"
                  value={simCost}
                  onChange={e => setSimCost(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-[#171717] focus:outline-none focus:border-[#e85d3f]"
                />
              </div>
            </div>
          </div>

          {/* Resultados de la fórmula */}
          <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#f7f7f5] border border-neutral-200/80 mb-5">
            <div>
              <span className="text-xs text-neutral-500 font-medium">Ganancia por unidad</span>
              <div className="text-2xl font-black mt-1 text-[#e85d3f]">
                {money(unitProfit)}
              </div>
              <span className="text-[10px] text-neutral-400">
                Fórmula: Precio ({money(priceVal)}) - Costo ({money(costVal)})
              </span>
            </div>

            <div>
              <span className="text-xs text-neutral-500 font-medium">Margen de rentabilidad (%)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-neutral-900">
                  {marginPct}%
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  numMarginPct >= 45 ? "bg-emerald-100 text-emerald-800" :
                  numMarginPct >= 25 ? "bg-blue-100 text-blue-800" :
                  numMarginPct >= 10 ? "bg-amber-100 text-amber-800" :
                  "bg-red-100 text-red-800"
                }`}>
                  {numMarginPct >= 45 ? "Excelente margen" :
                   numMarginPct >= 25 ? "Margen saludable" :
                   numMarginPct >= 10 ? "Margen ajustado" :
                   "Crítico o negativo"}
                </span>
              </div>
              <span className="text-[10px] text-neutral-400">
                Fórmula: (Ganancia / Precio) × 100
              </span>
            </div>
          </div>

          {/* Simulación por volumen */}
          <div className="p-4 rounded-2xl bg-white border border-neutral-200 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-800">Proyección por volumen de ventas mensual</span>
              <span className="text-xs font-semibold text-[#e85d3f]">{unitsVal} unidades/mes</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="1000" 
              step="10"
              value={simUnits} 
              onChange={e => setSimUnits(Number(e.target.value))}
              className="w-full accent-[#e85d3f] cursor-pointer"
            />
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-100 text-center text-xs">
              <div>
                <span className="text-neutral-400 text-[11px]">Ingresos est.</span>
                <p className="font-bold text-neutral-800 mt-0.5">{money(projectedRevenue)}</p>
              </div>
              <div>
                <span className="text-neutral-400 text-[11px]">Costos est.</span>
                <p className="font-bold text-neutral-800 mt-0.5">{money(projectedCosts)}</p>
              </div>
              <div>
                <span className="text-neutral-400 text-[11px]">Ganancia neta</span>
                <p className="font-bold text-emerald-600 mt-0.5">{money(projectedProfit)}</p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 italic">
            * Los cambios realizados en esta calculadora son exclusivamente de simulación interactiva y no modifican los registros de la base de datos Neon.
          </div>
        </div>

        {/* Resumen de Métricas del Catálogo */}
        <div className="space-y-4">
          <div className="card p-5 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-neutral-500 font-medium">Margen promedio del catálogo</span>
                <div className="text-3xl font-extrabold text-[#171717] mt-1">{avgMargin}%</div>
                <p className="text-xs text-neutral-400 mt-1">Calculado sobre {products.length} productos registrados</p>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          {bestProduct && (
            <div className="card p-5 bg-white border border-neutral-200">
              <span className="text-xs text-neutral-500 font-medium">Producto más rentable</span>
              <div className="font-bold text-lg text-[#171717] mt-1">{bestProduct.name}</div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-100 text-xs">
                <span className="text-neutral-500">Margen porcentual:</span>
                <span className="font-bold text-emerald-600 text-sm">{Math.round(bestProduct.margin)}%</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-xs">
                <span className="text-neutral-500">Ganancia por unidad:</span>
                <span className="font-bold text-[#e85d3f]">{money(bestProduct.profit)}</span>
              </div>
              <button
                onClick={() => handleLoadToCalc(bestProduct)}
                className="mt-3 w-full py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors"
              >
                Cargar en simulador ↑
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── TABLA COMPLETA DE RENTABILIDAD DEL CATÁLOGO ─── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-lg text-[#171717]">Rentabilidad por producto del catálogo</h2>
            <p className="text-xs text-neutral-500">Datos reales almacenados en Neon. Usa el botón para simular variaciones de precio.</p>
          </div>
          <span className="text-xs font-semibold text-neutral-400">{products.length} productos</span>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-neutral-100 rounded-xl" />
            <div className="h-10 bg-neutral-100 rounded-xl" />
          </div>
        ) : (
          <Table heads={["Producto", "Categoría", "Precio Venta", "Costo Producción", "Ganancia Unit.", "Margen (%)", "Acción"]}>
            {catalogWithMargins.map(p => (
              <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                <td className="px-5 py-4 font-semibold text-sm">{p.name}</td>
                <td className="px-5 py-4 text-xs text-neutral-500">{p.category?.name || "General"}</td>
                <td className="px-5 py-4 font-semibold text-sm">{money(p.price)}</td>
                <td className="px-5 py-4 text-xs text-neutral-500">{money(p.cost || 0)}</td>
                <td className="px-5 py-4 font-bold text-sm text-[#e85d3f]">{money(p.profit)}</td>
                <td className="px-5 py-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    p.margin >= 40 ? "bg-emerald-50 text-emerald-700" :
                    p.margin >= 20 ? "bg-blue-50 text-blue-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {Math.round(p.margin)}%
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => handleLoadToCalc(p)}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors flex items-center gap-1"
                  >
                    <span>Simular</span>
                    <ArrowRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </>
  );
}

function Analytics({ restaurantSlug = RESTAURANT_SLUG }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'stars', 'profit', 'demand'

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderApi.getRestaurantAnalytics(restaurantSlug);
      setData(res);
    } catch (err) {
      console.error("Error al cargar analítica de ventas:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHead title="Análisis de Ventas" desc="Rendimiento del catálogo, rentabilidad y demanda temporal." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-white rounded-3xl animate-pulse" />
      </div>
    );
  }

  const topSelling = data?.topSellingProducts || [];
  const mostProfitable = data?.mostProfitableProducts || [];
  const demandDays = data?.demandByDay || [];
  const demandHours = data?.demandByHour || [];
  const maxDaySales = Math.max(...demandDays.map(d => d.totalSales), 1);
  const maxHourOrders = Math.max(...demandHours.map(h => h.ordersCount), 1);

  const starProduct = topSelling[0];
  const mostProfitProduct = mostProfitable[0];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Análisis de Ventas</h1>
          <p className="text-neutral-500 mt-2">
            Métricas comerciales calculadas desde pedidos reales en Neon (excluyendo pedidos cancelados).
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="p-2.5 bg-white border border-[#e8e8e4] rounded-xl text-neutral-500 hover:text-[#171717] transition-colors self-start sm:self-auto"
          title="Actualizar análisis"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPI Cards Superiores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat 
          title="Ingresos analizados" 
          value={money(data?.totalAnalyzedRevenue || 0)} 
          delta={`${data?.totalAnalyzedOrders || 0} pedidos válidos`} 
          icon={TrendingUp} 
        />
        <Stat 
          title="Producto Estrella" 
          value={starProduct?.name || "Sin ventas"} 
          delta={starProduct?.unitsSold ? `${starProduct.unitsSold} unid. vendidas` : "0 vendidas"} 
          icon={Star} 
        />
        <Stat 
          title="Mayor Ganancia Neta" 
          value={mostProfitProduct?.profit > 0 ? money(mostProfitProduct.profit) : "$0"} 
          delta={mostProfitProduct?.name || "Sin datos"} 
          icon={Award} 
        />
        <Stat 
          title="Pico de Demanda" 
          value={data?.peakDay?.dayName || "N/A"} 
          delta={data?.peakHour?.hourLabel ? `Horario: ${data.peakHour.hourLabel}` : "Sin datos"} 
          icon={Clock} 
        />
      </div>

      {/* Selector de sub-sección */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {[
          ["all", "Visión Consolidada"],
          ["stars", "Productos Estrella (Volumen)"],
          ["profit", "Más Rentables (Ganancia Neta)"],
          ["demand", "Demanda por Día y Hora"]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              activeTab === key
                ? "bg-[#171717] text-white shadow-xs"
                : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── SECCIÓN A: PRODUCTOS ESTRELLA (VOLUMEN DE VENTAS) ─── */}
      {(activeTab === "all" || activeTab === "stars") && (
        <section className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Star size={18} fill="currentColor" />
                </span>
                <h2 className="font-bold text-lg text-[#171717]">Productos Estrella del Catálogo</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Ranking de productos con mayor volumen de unidades vendidas e ingresos brutos generados.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-neutral-100 rounded-full text-neutral-600 self-start">
              {topSelling.length} productos analizados
            </span>
          </div>

          <Table heads={["Ranking", "Producto", "Categoría", "Precio Venta", "Unidades Vendidas", "Ingresos Generados", "Insignia"]}>
            {topSelling.map((p) => {
              const isFirst = p.rank === 1 && p.unitsSold > 0;
              const isSecond = p.rank === 2 && p.unitsSold > 0;
              const isThird = p.rank === 3 && p.unitsSold > 0;

              return (
                <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-5 py-4 font-bold text-sm">
                    <span className={`w-7 h-7 rounded-full inline-grid place-items-center text-xs font-extrabold ${
                      isFirst ? "bg-amber-100 text-amber-800 border border-amber-300" :
                      isSecond ? "bg-slate-200 text-slate-800" :
                      isThird ? "bg-orange-100 text-orange-800" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>
                      {p.rank}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm text-[#171717]">{p.name}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-neutral-500">{p.categoryName}</td>
                  <td className="px-5 py-4 text-sm font-medium">{money(p.price)}</td>
                  <td className="px-5 py-4">
                    <strong className="text-sm font-bold text-neutral-900">{p.unitsSold}</strong>
                    <span className="text-xs text-neutral-400 ml-1">unid.</span>
                  </td>
                  <td className="px-5 py-4 font-bold text-sm text-[#e85d3f]">
                    {money(p.revenue)}
                  </td>
                  <td className="px-5 py-4">
                    {isFirst ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Star size={12} fill="currentColor" /> Producto Estrella
                      </span>
                    ) : isSecond ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        🥈 2do Más Vendido
                      </span>
                    ) : isThird ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700">
                        🥉 3er Lugar
                      </span>
                    ) : p.unitsSold >= 10 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-600">
                        <Flame size={12} /> Alta Demanda
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">Regular</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      {/* ─── SECCIÓN B: PRODUCTOS MÁS RENTABLES (MARGEN Y GANANCIA NETA) ─── */}
      {(activeTab === "all" || activeTab === "profit") && (
        <section className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Award size={18} />
                </span>
                <h2 className="font-bold text-lg text-[#171717]">Productos Más Rentables (Ganancia Real)</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Calculado a partir de ingresos generados menos costos acumulados de producción registrados en Neon.
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[11px] font-medium max-w-md">
              💡 <strong>Regla de negocio:</strong> No confundir volumen con rentabilidad. Un producto con menos ventas puede generar mayor ganancia neta si su margen unitario es superior.
            </div>
          </div>

          <Table heads={["Ranking Rentabilidad", "Producto", "Unidades", "Ingresos", "Costos Acumulados", "Ganancia Neta", "Margen (%)"]}>
            {mostProfitable.map((p) => {
              const isTop = p.profitRank === 1 && p.profit > 0;
              return (
                <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-5 py-4 font-bold text-sm">
                    <span className={`w-7 h-7 rounded-full inline-grid place-items-center text-xs font-extrabold ${
                      isTop ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-neutral-100 text-neutral-600"
                    }`}>
                      {p.profitRank}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm text-[#171717]">{p.name}</div>
                    <div className="text-[11px] text-neutral-400">
                      Precio: {money(p.price)} · Costo unit.: {money(p.cost)}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold">{p.unitsSold}</td>
                  <td className="px-5 py-4 text-sm text-neutral-700">{money(p.revenue)}</td>
                  <td className="px-5 py-4 text-sm text-neutral-500">{money(p.totalCost)}</td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-emerald-600">{money(p.profit)}</div>
                    {isTop && (
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
                        ★ Mayor Rentabilidad
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      p.margin >= 45 ? "bg-emerald-100 text-emerald-800" :
                      p.margin >= 25 ? "bg-blue-50 text-blue-700" :
                      p.margin >= 10 ? "bg-amber-50 text-amber-700" :
                      "bg-neutral-100 text-neutral-500"
                    }`}>
                      {p.margin}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      {/* ─── SECCIÓN C: ANÁLISIS DE DEMANDA TEMPORAL (DÍA Y HORA) ─── */}
      {(activeTab === "all" || activeTab === "demand") && (
        <div className="grid xl:grid-cols-2 gap-6 mb-6">
          {/* Demanda por Día de la Semana */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-[#171717] flex items-center gap-2">
                  <Calendar size={18} className="text-[#e85d3f]" />
                  Demanda por Día de la Semana
                </h3>
                <p className="text-xs text-neutral-500 mt-1">Distribución de pedidos e ingresos de Lunes a Domingo.</p>
              </div>
              {data?.peakDay && (
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                  <Trophy size={13} /> Pico: {data.peakDay.dayName}
                </span>
              )}
            </div>

            <div className="h-60 flex items-end gap-2 sm:gap-4 border-b border-neutral-100 pb-2 pt-6">
              {demandDays.map((d) => {
                const heightPct = Math.max(12, Math.round((d.totalSales / maxDaySales) * 100));
                return (
                  <div key={d.dayIndex} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-neutral-900 text-white text-[11px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 pointer-events-none shadow-md">
                      <strong>{d.dayName}</strong>: {money(d.totalSales)} ({d.ordersCount} pedidos)
                    </div>
                    <div
                      className={`w-full max-w-[42px] rounded-t-xl transition-all ${
                        d.isPeak
                          ? "bg-[#e85d3f] shadow-sm"
                          : "bg-neutral-200 hover:bg-[#f5a796]"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className={`text-[11px] font-semibold ${d.isPeak ? "text-[#e85d3f]" : "text-neutral-500"}`}>
                      {d.dayName.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-2 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 text-[11px]">Día con más pedidos:</span>
                <p className="font-bold text-neutral-800 mt-0.5">
                  {data?.peakDay ? `${data.peakDay.dayName} (${data.peakDay.ordersCount} pedidos)` : "Sin datos suficientes"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 text-[11px]">Ventas del día pico:</span>
                <p className="font-bold text-[#e85d3f] mt-0.5">
                  {data?.peakDay ? money(data.peakDay.totalSales) : "$0"}
                </p>
              </div>
            </div>
          </section>

          {/* Demanda por Hora del Día */}
          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-[#171717] flex items-center gap-2">
                  <Clock size={18} className="text-[#e85d3f]" />
                  Demanda por Hora del Día
                </h3>
                <p className="text-xs text-neutral-500 mt-1">Horarios con mayor concentración de órdenes (Bogotá UTC-5).</p>
              </div>
              {data?.peakHour && (
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                  <Zap size={13} /> Pico: {data.peakHour.hourLabel}
                </span>
              )}
            </div>

            {/* Gráfico de Horas (Horas activas o franja completa) */}
            <div className="h-60 flex items-end gap-1 sm:gap-1.5 border-b border-neutral-100 pb-2 pt-6 overflow-x-auto">
              {demandHours.map((h) => {
                const heightPct = Math.max(10, Math.round((h.ordersCount / maxHourOrders) * 100));
                return (
                  <div key={h.hour} className="flex-1 min-w-[14px] h-full flex flex-col justify-end items-center gap-1.5 group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-neutral-900 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 pointer-events-none shadow-md">
                      <strong>{h.hourLabel}</strong>: {h.ordersCount} pedidos ({money(h.totalSales)})
                    </div>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        h.isPeak
                          ? "bg-[#e85d3f] shadow-sm"
                          : h.ordersCount > 0
                          ? "bg-[#f5a796] hover:bg-[#e85d3f]"
                          : "bg-neutral-100"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-neutral-400 rotate-45 sm:rotate-0 mt-0.5">
                      {h.hour % 3 === 0 ? `${h.hour}h` : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-2 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 text-[11px]">Horario de mayor demanda:</span>
                <p className="font-bold text-neutral-800 mt-0.5">
                  {data?.peakHour ? `${data.peakHour.hourLabel} (${data.peakHour.ordersCount} pedidos)` : "Sin datos suficientes"}
                </p>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 text-[11px]">Ventas del horario pico:</span>
                <p className="font-bold text-[#e85d3f] mt-0.5">
                  {data?.peakHour ? money(data.peakHour.totalSales) : "$0"}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Goals({ restaurantSlug = RESTAURANT_SLUG }) {
  const [goalData, setGoalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [inputGoal, setInputGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchGoal = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderApi.getRestaurantGoal(restaurantSlug);
      setGoalData(res);
      setInputGoal(res?.monthlyGoal ? String(res.monthlyGoal) : "5000000");
    } catch (err) {
      console.error("Error al consultar meta de ventas:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const num = Number(inputGoal);
    if (!Number.isInteger(num) || num <= 0) {
      setError("La meta debe ser un número entero mayor a 0 en pesos colombianos (COP).");
      return;
    }

    setSaving(true);
    try {
      const res = await orderApi.updateRestaurantGoal(restaurantSlug, num);
      setGoalData(res);
      setIsEditing(false);
      setSuccessMsg("¡Meta mensual de ventas actualizada exitosamente en Neon!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.message || "Error al actualizar la meta.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHead title="Metas de ventas" desc="Define objetivos y sigue el progreso de tu restaurante." />
        <div className="h-64 bg-white rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const currentSales = goalData?.currentMonthSales || 0;
  const targetGoal = goalData?.monthlyGoal || 5000000;
  const progressPct = goalData?.progressPct || 0;
  const remaining = goalData?.remaining || 0;
  const isReached = goalData?.isGoalReached || false;
  const daysRemaining = goalData?.daysRemaining ?? 0;
  const dailyRequired = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : remaining;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Metas Comerciales</h1>
          <p className="text-neutral-500 mt-2">
            Objetivo mensual de ventas para <strong>{goalData?.monthName} {goalData?.year}</strong> conectado a PostgreSQL en Neon.
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-[#171717] hover:bg-[#2a2a2a] text-white px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors shadow-sm"
            >
              <Edit3 size={15} />
              Configurar meta mensual
            </button>
          )}
          <button
            onClick={fetchGoal}
            className="p-2.5 bg-white border border-[#e8e8e4] rounded-xl text-neutral-500 hover:text-[#171717] transition-colors"
            title="Actualizar datos de meta"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-xs">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formulario de Modificación de Meta */}
      {isEditing && (
        <div className="card p-6 mb-6 bg-white border-2 border-[#e85d3f]/30 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-[#171717] flex items-center gap-2">
              <Target size={18} className="text-[#e85d3f]" />
              Establecer Meta Mensual de Ventas ({goalData?.monthName} {goalData?.year})
            </h3>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setError(null); }}
              className="text-neutral-400 hover:text-neutral-700"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveGoal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Monto objetivo mensual en Pesos Colombianos (COP) *
              </label>
              <div className="relative max-w-md">
                <span className="absolute left-3.5 top-2.5 text-neutral-400 font-bold">$</span>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ej. 10000000"
                  value={inputGoal}
                  onChange={(e) => setInputGoal(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold focus:outline-none focus:border-[#e85d3f] focus:ring-1 focus:ring-[#e85d3f]"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                La meta se almacena en el campo <code>Restaurant.monthlyGoal</code> de Neon para el restaurante actual.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#e85d3f] hover:bg-[#d04e32] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : <><Save size={15} /> Guardar meta</>}
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setError(null); }}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── TARJETA PRINCIPAL: BARRA DE PROGRESO Y CUMPLIMIENTO ─── */}
      <div className="card p-6 md:p-8 mb-6 bg-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Progreso del Mes</span>
            <div className="text-3xl md:text-4xl font-black text-[#171717] mt-1">
              {money(currentSales)}
              <span className="text-lg md:text-xl font-normal text-neutral-400 ml-2">/ {money(targetGoal)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-3xl md:text-4xl font-black text-[#e85d3f]">
                {progressPct}%
              </div>
              <span className="text-xs text-neutral-500 font-medium">Cumplimiento</span>
            </div>

            <div className={`p-3 rounded-2xl ${
              isReached ? "bg-emerald-100 text-emerald-700" : "bg-[#fff4f1] text-[#e85d3f]"
            }`}>
              {isReached ? <Trophy size={28} /> : <Target size={28} />}
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-neutral-100 rounded-full h-5 p-1 relative overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isReached
                ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                : "bg-gradient-to-r from-[#e85d3f] to-[#ff8c73]"
            }`}
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>

        {/* Hitos de la barra */}
        <div className="flex justify-between text-[11px] text-neutral-400 font-medium mb-4">
          <span>$0 (0%)</span>
          <span>{money(targetGoal * 0.25)} (25%)</span>
          <span>{money(targetGoal * 0.5)} (50%)</span>
          <span>{money(targetGoal * 0.75)} (75%)</span>
          <span className="font-bold text-neutral-700">{money(targetGoal)} (100%)</span>
        </div>

        {/* Mensaje de estado / cumplimiento */}
        <div className={`p-4 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs font-semibold ${
          isReached 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-[#fff4f1] text-[#e85d3f] border border-[#fbd6cc]"
        }`}>
          <div className="flex items-center gap-2">
            {isReached ? <CheckCircle2 size={18} /> : <Zap size={18} />}
            <span>
              {isReached
                ? `¡Objetivo superado! El restaurante ha alcanzado el ${progressPct}% de la meta mensual con ${money(currentSales - targetGoal)} adicionales.`
                : `Faltan ${money(remaining)} para alcanzar la meta comercial de este mes.`}
            </span>
          </div>
          {!isReached && daysRemaining > 0 && (
            <span className="text-[11px] bg-white/80 px-2.5 py-1 rounded-lg text-neutral-700 border border-neutral-200">
              Ritmo diario necesario: {money(dailyRequired)}/día ({daysRemaining} días restantes)
            </span>
          )}
        </div>
      </div>

      {/* Grid de Métricas Secundarias */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white">
          <span className="text-xs text-neutral-500 font-medium">Meta configurada</span>
          <div className="text-2xl font-bold mt-2 text-neutral-900">{money(targetGoal)}</div>
          <span className="text-xs text-neutral-400 mt-1 block">Almacenada en Neon</span>
        </div>

        <div className="card p-5 bg-white">
          <span className="text-xs text-neutral-500 font-medium">Ventas de {goalData?.monthName}</span>
          <div className="text-2xl font-bold mt-2 text-[#e85d3f]">{money(currentSales)}</div>
          <span className="text-xs text-emerald-600 font-medium mt-1 block">Pedidos no cancelados</span>
        </div>

        <div className="card p-5 bg-white">
          <span className="text-xs text-neutral-500 font-medium">Pedidos procesados</span>
          <div className="text-2xl font-bold mt-2 text-neutral-900">{goalData?.currentMonthOrdersCount || 0}</div>
          <span className="text-xs text-neutral-400 mt-1 block">En el mes en curso</span>
        </div>

        <div className="card p-5 bg-white">
          <span className="text-xs text-neutral-500 font-medium">Estado del mes</span>
          <div className={`text-xl font-bold mt-2 ${isReached ? "text-emerald-600" : "text-amber-600"}`}>
            {isReached ? "Cumplida 🎉" : "En progreso ⏳"}
          </div>
          <span className="text-xs text-neutral-400 mt-1 block">
            {daysRemaining} días restantes
          </span>
        </div>
      </div>
    </>
  );
}

function Coupons({ restaurantSlug = RESTAURANT_SLUG }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await couponApi.getRestaurantCoupons(restaurantSlug);
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar la lista de cupones.");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleOpenCreate = () => {
    setSelectedCoupon(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (coupon) => {
    setSelectedCoupon(coupon);
    setModalOpen(true);
  };

  const handleSaveCoupon = async (payload, couponId) => {
    if (couponId) {
      await couponApi.updateCoupon(couponId, payload);
      setFeedback({ type: "success", message: `Cupón ${payload.code} actualizado exitosamente.` });
    } else {
      await couponApi.createCoupon(restaurantSlug, payload);
      setFeedback({ type: "success", message: `Cupón ${payload.code} creado exitosamente.` });
    }
    await fetchCoupons();
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleActive = async (coupon) => {
    try {
      const nextActive = !coupon.active;
      await couponApi.toggleCouponActive(coupon.id, nextActive);
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, active: nextActive } : c))
      );
      setFeedback({
        type: "success",
        message: `Cupón ${coupon.code} ${nextActive ? "activado" : "desactivado"}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Error al cambiar estado." });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDeleteCoupon = async (coupon) => {
    const hasUsage = (coupon.usageCount || 0) > 0 || (coupon.ordersCount || 0) > 0;
    const confirmText = hasUsage
      ? `El cupón ${coupon.code} tiene ${coupon.usageCount} pedido(s) registrado(s).\n\nPara proteger los registros históricos de ventas, no se borrará de la base de datos sino que se desactivará.\n\n¿Deseas desactivarlo ahora?`
      : `¿Estás seguro de eliminar permanentemente el cupón ${coupon.code}? Esta acción no se puede deshacer.`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await couponApi.deleteCoupon(coupon.id);
      setFeedback({
        type: "success",
        message: res.message || (res.action === "deactivated" ? "Cupón desactivado por historial." : "Cupón eliminado."),
      });
      await fetchCoupons();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Error al procesar el cupón." });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Métricas
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.active).length;
  const totalUses = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

  // Filtrado
  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === "all" ? true : statusFilter === "active" ? c.active : !c.active;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PageHead
        title="Cupones"
        desc="Administra códigos de descuento, porcentajes, montos fijos y límites de uso."
        button="Nuevo cupón"
        onClick={handleOpenCreate}
      />

      {feedback && (
        <div
          className={`p-4 rounded-2xl mb-6 text-sm font-semibold flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline opacity-70 hover:opacity-100">
            Cerrar
          </button>
        </div>
      )}

      {/* KPI resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Cupones</span>
            <TicketPercent size={18} className="text-neutral-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#171717]">{totalCoupons}</div>
          <div className="text-xs text-neutral-400 mt-1">Configurados en el restaurante</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cupones Activos</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-600">{activeCoupons}</div>
          <div className="text-xs text-neutral-400 mt-1">Disponibles para checkout</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Usos Totales</span>
            <TrendingUp size={18} className="text-[#e85d3f]" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-[#e85d3f]">{totalUses}</div>
          <div className="text-xs text-neutral-400 mt-1">Pedidos con cupón aplicados</div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e85d3f]/20 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 self-stretch sm:self-auto bg-neutral-100 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "all" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Todos ({coupons.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "active" ? "bg-white text-emerald-600 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Activos ({activeCoupons})
          </button>
          <button
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "inactive" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Inactivos ({coupons.length - activeCoupons})
          </button>
        </div>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="card p-12 text-center">
          <div className="w-10 h-10 border-4 border-[#e85d3f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-600">Cargando cupones de descuento...</p>
        </div>
      )}

      {/* Estado de error */}
      {!loading && error && (
        <div className="card p-8 text-center bg-red-50/50 border border-red-200">
          <AlertCircle size={36} className="text-red-500 mx-auto mb-2" />
          <h4 className="font-bold text-red-900 mb-1">Error al consultar cupones</h4>
          <p className="text-sm text-red-700 max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={fetchCoupons}
            className="px-4 py-2 bg-white border border-red-300 rounded-xl text-xs font-bold text-red-800 hover:bg-red-50"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Lista vacía */}
      {!loading && !error && filteredCoupons.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center mx-auto mb-4">
            <TicketPercent size={32} />
          </div>
          <h3 className="font-bold text-lg text-neutral-800 mb-1">
            {coupons.length === 0 ? "Aún no tienes cupones configurados" : "No hay cupones con ese criterio"}
          </h3>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
            {coupons.length === 0
              ? "Crea promociones con porcentajes de descuento o montos fijos para fidelizar a tus clientes en el checkout."
              : "Intenta cambiar el término de búsqueda o el filtro de estado para ver otros cupones."}
          </p>
          {coupons.length === 0 && (
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 bg-[#e85d3f] hover:bg-[#d44d30] text-white font-bold text-sm rounded-xl inline-flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Crear primer cupón
            </button>
          )}
        </div>
      )}

      {/* Tabla / Grid de Cupones */}
      {!loading && !error && filteredCoupons.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoupons.map((coupon) => {
              const now = new Date();
              const isExpired = coupon.endDate && new Date(coupon.endDate) < now;
              const notStarted = coupon.startDate && new Date(coupon.startDate) > now;
              const limitReached = coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit;

              return (
                <div
                  key={coupon.id}
                  className={`card p-5 flex flex-col justify-between transition-all border ${
                    !coupon.active || isExpired || limitReached
                      ? "bg-neutral-50/70 border-neutral-200 opacity-80"
                      : "border-neutral-200/80 hover:border-neutral-300 hover:shadow-sm"
                  }`}
                >
                  {/* Encabezado del cupón */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-base tracking-wider bg-neutral-900 text-white px-2.5 py-1 rounded-lg">
                          {coupon.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(coupon.code)}
                          title="Copiar código"
                          className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
                        >
                          {copiedCode === coupon.code ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>

                      {/* Switch activo rápido */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={coupon.active}
                          onChange={() => handleToggleActive(coupon)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Badge de descuento y tipo */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl font-black text-[#e85d3f]">
                        {coupon.discountType === "PERCENTAGE"
                          ? `${coupon.discountValue}% OFF`
                          : money(coupon.discountValue)}
                      </span>
                      {coupon.discountType === "PERCENTAGE" && coupon.maximumDiscount ? (
                        <span className="text-xs text-neutral-500 font-medium">
                          (Hasta {money(coupon.maximumDiscount)})
                        </span>
                      ) : null}
                    </div>

                    {coupon.description && (
                      <p className="text-xs text-neutral-600 mb-3 line-clamp-2">
                        {coupon.description}
                      </p>
                    )}

                    {/* Condiciones */}
                    <div className="space-y-1.5 py-2.5 border-t border-b border-neutral-100 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span className="text-neutral-400">Compra mínima:</span>
                        <span className="font-semibold text-neutral-700">
                          {coupon.minimumOrderAmount > 0 ? money(coupon.minimumOrderAmount) : "Sin mínimo"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">Usos:</span>
                        <span className="font-semibold text-neutral-700">
                          {coupon.usageCount} {coupon.usageLimit !== null ? `/ ${coupon.usageLimit}` : "(ilimitado)"}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-neutral-400">Vigencia:</span>
                        <span className="font-semibold text-neutral-700">
                          {isExpired ? (
                            <span className="text-red-600 font-bold">Vencido</span>
                          ) : notStarted ? (
                            <span className="text-amber-600 font-bold">Inicia próx.</span>
                          ) : coupon.endDate ? (
                            `Hasta ${new Date(coupon.endDate).toLocaleDateString("es-CO")}`
                          ) : (
                            "Permanente"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones al pie */}
                  <div className="pt-3 mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {!coupon.active ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-200 text-neutral-700">
                          Inactivo
                        </span>
                      ) : isExpired ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700">
                          Expirado
                        </span>
                      ) : limitReached ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                          Límite agotado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Disponible
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(coupon)}
                        title="Editar cupón"
                        className="p-2 rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon)}
                        title={
                          (coupon.usageCount || 0) > 0 ? "Desactivar por historial" : "Eliminar cupón"
                        }
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Formulario Cupón */}
      <CouponFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCoupon}
        coupon={selectedCoupon}
      />
    </>
  );
}
