import React, { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Users,
  ShoppingBag,
  BarChart3,
  ExternalLink,
  UtensilsCrossed,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Server
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    path: "/superadmin",
    icon: LayoutDashboard,
    end: true
  },
  {
    name: "Restaurantes",
    path: "/superadmin/restaurants",
    icon: Store
  },
  {
    name: "Usuarios",
    path: "/superadmin/users",
    icon: Users
  },
  {
    name: "Pedidos Globales",
    path: "/superadmin/orders",
    icon: ShoppingBag
  },
  {
    name: "Analítica",
    path: "/superadmin/analytics",
    icon: BarChart3
  }
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  const getBreadcrumbTitle = () => {
    const path = location.pathname;
    if (path === "/superadmin") return "Dashboard Global";
    if (path.startsWith("/superadmin/restaurants/")) return "Detalle de Restaurante";
    if (path === "/superadmin/restaurants") return "Gestión de Restaurantes";
    if (path.startsWith("/superadmin/users/")) return "Detalle de Usuario";
    if (path === "/superadmin/users") return "Gestión de Usuarios";
    if (path === "/superadmin/orders") return "Auditoría de Pedidos";
    if (path === "/superadmin/analytics") return "Métricas y Analítica";
    return "SuperAdmin";
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-neutral-900 text-neutral-200">
      {/* Brand Header */}
      <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
        <Link to="/superadmin" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">FoodiePOP</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Core
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-medium">SuperAdmin Panel</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase mb-2">
            Plataforma
          </p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Quick Links */}
        <div>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase mb-2">
            Accesos Rápidos
          </p>
          <nav className="space-y-1">
            <Link
              to="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                <span>Tienda Pública</span>
              </span>
              <span className="text-[10px] text-neutral-500">cliente</span>
            </Link>
            <Link
              to="/admin"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <UtensilsCrossed className="w-3.5 h-3.5 text-neutral-500" />
                <span>Panel Restaurante</span>
              </span>
              <span className="text-[10px] text-neutral-500">local</span>
            </Link>
          </nav>
        </div>

        {/* Platform Status Card */}
        <div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sistema Operativo</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Multi-Tenant PostgreSQL • Neon AWS • Zona horaria America/Bogota (UTC-5)
          </p>
        </div>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-neutral-800 bg-neutral-900/90">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || "Super Administrador"}
              </p>
            </div>
            <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 min-h-screen sticky top-0 z-30 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-full h-full shadow-2xl z-10">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 focus:outline-none"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="font-semibold text-neutral-800">SuperAdmin</span>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
              <span className="text-neutral-900 font-medium">{getBreadcrumbTitle()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Multi-Restaurante Activo</span>
            </div>
            <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {user?.name ? user.name[0] : "S"}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-neutral-900 leading-tight">
                  {user?.name || "Super Admin"}
                </p>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  Superadmin
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

