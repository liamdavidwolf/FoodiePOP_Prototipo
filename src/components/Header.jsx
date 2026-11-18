import React, { useState, useRef, useEffect } from "react";
import { ShoppingBag, User, LogOut, ChevronDown, LogIn } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

export default function Header({ onOpenCart }) {
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate("/");
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "Cliente";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#e8e8e4] shadow-sm">
      <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="text-2xl font-black tracking-tight">
            Foodie<span className="text-[#e85d3f]">POP</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/orders", { state: { from: location.pathname } })}
            className="text-sm font-semibold text-neutral-600 hover:text-[#e85d3f] transition-colors mr-1 hidden md:block"
          >
            Mis Pedidos
          </button>

          {/* Estado de autenticación */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 py-1.5 px-3 rounded-full hover:bg-neutral-100 transition-colors border border-neutral-200 text-sm font-medium text-neutral-800"
              >
                <div className="w-6 h-6 rounded-full bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center font-bold text-xs">
                  {firstName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-semibold text-xs">
                  {firstName}
                </span>
                <ChevronDown size={14} className="text-neutral-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-neutral-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-neutral-100">
                    <p className="text-xs font-bold text-neutral-800 truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/orders", { state: { from: location.pathname } });
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                  >
                    <ShoppingBag size={14} className="text-neutral-500" />
                    Mis Pedidos
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={14} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:text-[#e85d3f] py-1.5 px-3 rounded-full hover:bg-neutral-50 transition-colors"
            >
              <LogIn size={16} />
              <span>Ingresar</span>
            </button>
          )}

          {/* Carrito */}
          <button
            onClick={onOpenCart}
            className="relative p-2 rounded-full hover:bg-neutral-100 transition-colors"
            aria-label="Abrir carrito"
          >
            <ShoppingBag className="text-[#171717]" size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#e85d3f] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
