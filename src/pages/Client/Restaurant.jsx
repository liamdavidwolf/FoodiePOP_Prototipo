import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import ProductCard from "../../components/ProductCard";
import ProductModal from "../../components/ProductModal";
import Cart from "../../components/Cart";
import { menuApi, RESTAURANT_SLUG } from "../../services/api";
import { Clock, AlertTriangle, RefreshCw, Store, UtensilsCrossed, Phone, ArrowLeft } from "lucide-react";

// ─── Normalización ────────────────────────────────────────────────────────────
const normalizeProduct = (p) => ({
  ...p,
  image: p.imageUrl ?? "",
});

const normalizeMenu = (categories) =>
  (categories ?? []).map((cat) => ({
    ...cat,
    products: (cat.products ?? []).map(normalizeProduct),
  }));

const normalizeRestaurant = (r) => ({
  ...r,
  bannerImage: r.bannerUrl ?? "",
  logo:        r.logoUrl  ?? "",
  status:      (r.status ?? "").toLowerCase(),
});

// ─── Estados de UI ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f7f5] animate-pulse">
      {/* Banner */}
      <div className="h-64 bg-neutral-200 w-full" />
      <div className="max-w-[1200px] mx-auto px-4 -mt-16">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#e8e8e4]">
          <div className="flex gap-5 items-center">
            <div className="w-24 h-24 rounded-2xl bg-neutral-200 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-7 bg-neutral-200 rounded-lg w-1/3" />
              <div className="h-4 bg-neutral-100 rounded-lg w-2/3" />
              <div className="h-4 bg-neutral-100 rounded-lg w-1/4" />
            </div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="mt-8 border-b border-[#e8e8e4] bg-white">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 bg-neutral-200 rounded-full" />
          ))}
        </div>
      </div>
      {/* Grid */}
      <div className="max-w-[1200px] mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#e8e8e4]">
              <div className="h-48 bg-neutral-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-neutral-200 rounded w-3/4" />
                <div className="h-4 bg-neutral-100 rounded w-full" />
                <div className="h-4 bg-neutral-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry, slug }) {
  const navigate = useNavigate();
  const isNotFound = message && (message.toLowerCase().includes("no encontrado") || message.includes("404"));

  return (
    <div className="min-h-screen bg-[#f7f7f5] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-5">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-[#171717] mb-2">
        {isNotFound ? "Restaurante no encontrado" : "No se pudo cargar el menú"}
      </h1>
      <p className="text-neutral-500 mb-4 max-w-sm text-sm">
        {isNotFound
          ? `No existe ningún restaurante activo con el identificador "${slug}".`
          : message || "Ocurrió un error al conectar con el servidor."}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-semibold text-xs transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Volver al inicio</span>
        </button>
        {!isNotFound && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#171717] text-white rounded-xl font-semibold text-xs hover:bg-[#2a2a2a] transition-colors"
          >
            <RefreshCw size={16} />
            <span>Reintentar</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Restaurant() {
  const { slug: routeSlug } = useParams();
  const [searchParams] = useSearchParams();
  const querySlug = searchParams.get("restaurant");

  // Slug efectivo: viene por ruta (/tacos), por query (?restaurant=tacos) o fallback
  const currentSlug = routeSlug || querySlug || RESTAURANT_SLUG;

  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [menu, setMenu]                     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen]         = useState(false);
  const [retryCount, setRetryCount]         = useState(0);

  // ─── Carga de datos desde la API según el slug activo ───────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [rawRestaurant, rawMenu] = await Promise.all([
          menuApi.getRestaurant(currentSlug),
          menuApi.getMenu(currentSlug),
        ]);

        if (cancelled) return;

        const normalizedMenu = normalizeMenu(rawMenu);
        setRestaurantInfo(normalizeRestaurant(rawRestaurant));
        setMenu(normalizedMenu);
        if (normalizedMenu.length > 0) {
          setActiveCategory(normalizedMenu[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Error al cargar información del restaurante.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [currentSlug, retryCount]);

  const handleRetry = () => setRetryCount((c) => c + 1);

  // ─── Scroll suave a categoría ────────────────────────────────────────────
  const scrollToCategory = (id) => {
    setActiveCategory(id);
    const el = document.getElementById(`category-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;
  if (error || !restaurantInfo) return <ErrorState message={error} onRetry={handleRetry} slug={currentSlug} />;

  return (
    <div className="min-h-screen bg-[#f7f7f5] font-sans pb-24">
      <Header onOpenCart={() => setIsCartOpen(true)} />

      <main>
        {/* ── Banner e info del restaurante ─────────────────────────────── */}
        <div className="bg-white">
          <div className="h-48 sm:h-64 md:h-80 w-full relative bg-gradient-to-r from-orange-400 via-rose-500 to-amber-500 overflow-hidden">
            {restaurantInfo.bannerImage ? (
              <img
                src={restaurantInfo.bannerImage}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-25">
                <Store size={96} className="text-white" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          <div className="max-w-[1200px] mx-auto px-4 relative -mt-16 sm:-mt-20">
            <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-[#e8e8e4]">
              <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
                {restaurantInfo.logo ? (
                  <img
                    src={restaurantInfo.logo}
                    alt={restaurantInfo.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-sm shrink-0 object-cover bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-sm shrink-0 bg-[#fff4f1] text-[#e85d3f] flex items-center justify-center font-black text-2xl sm:text-3xl">
                    {restaurantInfo.name?.charAt(0)?.toUpperCase() || "R"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#171717]">
                      {restaurantInfo.name}
                    </h1>
                    {restaurantInfo.status === "open" && (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        Abierto
                      </span>
                    )}
                    {restaurantInfo.status === "closed" && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        Cerrado
                      </span>
                    )}
                    {restaurantInfo.status === "paused" && (
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        En Pausa
                      </span>
                    )}
                  </div>
                  {restaurantInfo.description && (
                    <p className="text-neutral-500 mt-2 text-sm sm:text-base leading-relaxed">
                      {restaurantInfo.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-medium text-neutral-500">
                    {restaurantInfo.schedule && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-neutral-400" />
                        <span>{restaurantInfo.schedule}</span>
                      </div>
                    )}
                    {restaurantInfo.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={14} className="text-neutral-400" />
                        <span>{restaurantInfo.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs de categoría (sticky) ───────────────────────────────── */}
        {menu.length > 0 && (
          <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-md border-b border-[#e8e8e4] mt-8">
            <div className="max-w-[1200px] mx-auto px-4">
              <div className="flex overflow-x-auto hide-scrollbar py-3 gap-2">
                {menu.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => scrollToCategory(category.id)}
                    className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                      activeCategory === category.id
                        ? "bg-[#171717] text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Catálogo de productos ─────────────────────────────────────── */}
        {menu.length === 0 ? (
          <div className="max-w-[1200px] mx-auto px-4 mt-16 text-center text-neutral-400 py-12 bg-white rounded-3xl border border-neutral-200 shadow-xs">
            <UtensilsCrossed size={48} className="mx-auto text-neutral-300 mb-3" />
            <p className="text-base font-bold text-neutral-700">El menú aún no tiene productos disponibles</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              Esta sede está preparando su carta gastronómica. Puedes consultar más tarde o acceder a su panel administrativo para cargar categorías y productos.
            </p>
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto px-4 mt-8 space-y-12">
            {menu.map((category) => (
              <div
                key={category.id}
                id={`category-${category.id}`}
                className="scroll-mt-36"
              >
                <h2 className="text-2xl font-bold text-[#171717] mb-6">
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {category.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClick={(p) => p.available && setSelectedProduct(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ProductModal
        product={selectedProduct}
        restaurantSlug={currentSlug}
        onClose={() => setSelectedProduct(null)}
      />

      <Cart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
