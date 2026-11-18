/**
 * FoodiePOP — Servicio de API del frontend.
 *
 * Lee las variables de entorno de Vite (VITE_*).
 * Si el backend no está disponible, las funciones lanzan un Error
 * que las páginas deben capturar y mostrar como estado de error.
 */

const BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";

export const RESTAURANT_SLUG =
  import.meta.env.VITE_RESTAURANT_SLUG ?? "la-esquina-food";

// ─── Helper interno ──────────────────────────────────────────────────────────

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Error HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) message = json.error;
    } catch {
      // cuerpo no es JSON — usamos el mensaje genérico
    }
    throw new Error(message);
  }
  const json = await res.json();
  if (json?.meta !== undefined) {
    return json; // Preserva { data, meta } para respuestas paginadas
  }
  return json.data !== undefined ? json.data : json;
}

// ─── API del menú ────────────────────────────────────────────────────────────

export const menuApi = {
  /**
   * Retorna los datos públicos del restaurante.
   * Shape: { id, slug, name, description, logoUrl, bannerUrl, status,
   *          schedule, phone, deliveryFee }
   */
  getRestaurant: async (slug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}`);
    return handleResponse(res);
  },

  /**
   * Retorna el menú completo: categorías con productos y opciones.
   * Shape: [{ id, name, position, products: [{ id, name, description,
   *           price, imageUrl, available, options: [{ id, name, price }] }] }]
   */
  getMenu: async (slug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/products`);
    return handleResponse(res);
  },

  /**
   * Retorna los productos del catálogo con costos y ventas (Panel Admin).
   */
  getAdminProducts: async (slug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/admin-products`, {
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Alterna la disponibilidad de un producto en tiempo real.
   */
  toggleProductAvailability: async (productId, available) => {
    const res = await fetch(`${BASE_URL}/menu/products/${productId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ available }),
    });
    return handleResponse(res);
  },

  /**
   * Retorna las categorías del restaurante.
   */
  getCategories: async (slug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/categories`);
    return handleResponse(res);
  },

  /**
   * Retorna todas las categorías para administración (activas e inactivas) con conteo de productos.
   */
  getAdminCategories: async (slug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/admin-categories`, {
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Crea una nueva categoría en el menú del restaurante.
   */
  createCategory: async (slug = RESTAURANT_SLUG, categoryData) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(categoryData),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza los datos de una categoría existente.
   */
  updateCategory: async (categoryId, categoryData) => {
    const res = await fetch(`${BASE_URL}/menu/categories/${categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(categoryData),
    });
    return handleResponse(res);
  },

  /**
   * Alterna la disponibilidad (activa/inactiva) de una categoría.
   */
  toggleCategoryAvailability: async (categoryId, active) => {
    const res = await fetch(`${BASE_URL}/menu/categories/${categoryId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active }),
    });
    return handleResponse(res);
  },

  /**
   * Elimina una categoría (falla si tiene productos asociados).
   */
  deleteCategory: async (categoryId) => {
    const res = await fetch(`${BASE_URL}/menu/categories/${categoryId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Crea un nuevo producto en el catálogo.
   */
  createProduct: async (slug = RESTAURANT_SLUG, productData) => {
    const res = await fetch(`${BASE_URL}/menu/restaurant/${slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(productData),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza los datos de un producto existente.
   */
  updateProduct: async (productId, productData) => {
    const res = await fetch(`${BASE_URL}/menu/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(productData),
    });
    return handleResponse(res);
  },

  /**
   * Agrega un nuevo adicional / opción a un producto.
   */
  createProductOption: async (productId, optionData) => {
    const res = await fetch(`${BASE_URL}/menu/products/${productId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(optionData),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza un adicional / opción existente.
   */
  updateProductOption: async (optionId, optionData) => {
    const res = await fetch(`${BASE_URL}/menu/options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(optionData),
    });
    return handleResponse(res);
  },

  /**
   * Elimina un adicional.
   */
  deleteProductOption: async (optionId) => {
    const res = await fetch(`${BASE_URL}/menu/options/${optionId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse(res);
  },
};

// ─── API de autenticación ────────────────────────────────────────────────────

export const authApi = {
  /**
   * Registra un nuevo cliente.
   * La sesión se persiste mediante cookie HttpOnly configurada por el servidor.
   */
  register: async ({ name, email, password, phone }) => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password, phone }),
    });
    return handleResponse(res);
  },

  /**
   * Inicia sesión con correo y contraseña.
   */
  login: async ({ email, password }) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  /**
   * Obtiene la sesión actual verificando la cookie HttpOnly en el servidor.
   */
  getMe: async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Cierra la sesión activa en el servidor y limpia la cookie HttpOnly.
   */
  logout: async () => {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    return handleResponse(res);
  },
};

// ─── API de pedidos ──────────────────────────────────────────────────────────

export const orderApi = {
  /**
   * Crea un nuevo pedido para el cliente autenticado.
   */
  createOrder: async (orderData) => {
    const payload = {
      restaurantSlug: RESTAURANT_SLUG,
      ...orderData,
    };
    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await handleResponse(res);
    return data.order;
  },

  /**
   * Consulta los pedidos del cliente autenticado desde Neon.
   */
  getMyOrders: async () => {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Consulta un pedido por ID o código legible.
   */
  getOrderById: async (id) => {
    const res = await fetch(`${BASE_URL}/orders/${id}`, {
      method: "GET",
      credentials: "include",
    });
    const data = await handleResponse(res);
    return data.order;
  },

  /**
   * Consulta los pedidos de un restaurante (panel administrativo).
   */
  getRestaurantOrders: async (restaurantId = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/orders/admin/restaurant/${restaurantId}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Consulta métricas en tiempo real del restaurante calculadas desde PostgreSQL.
   */
  getRestaurantMetrics: async (restaurantId = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/orders/admin/restaurant/${restaurantId}/metrics`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Consulta el análisis comercial completo: productos estrella, rentabilidad y demanda por día/hora.
   */
  getRestaurantAnalytics: async (restaurantId = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/orders/admin/restaurant/${restaurantId}/analytics`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Consulta la meta comercial mensual del restaurante y su estado de cumplimiento.
   */
  getRestaurantGoal: async (restaurantId = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/orders/admin/restaurant/${restaurantId}/goal`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Actualiza la meta comercial mensual del restaurante en Neon.
   */
  updateRestaurantGoal: async (restaurantId = RESTAURANT_SLUG, monthlyGoal) => {
    const res = await fetch(`${BASE_URL}/orders/admin/restaurant/${restaurantId}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ monthlyGoal }),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza el estado de un pedido (panel administrativo).
   */
  updateOrderStatus: async (id, status) => {
    const res = await fetch(`${BASE_URL}/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    const data = await handleResponse(res);
    return data.order;
  },
};

// ─── API del SuperAdmin (Etapa 5C / 5D) ───────────────────────────────────────

export const superadminApi = {
  /**
   * Métricas y estadísticas globales de la plataforma.
   * Soporta period (7, 30, 90 días).
   */
  getMetrics: async ({ period = 30 } = {}) => {
    const res = await fetch(`${BASE_URL}/superadmin/metrics?period=${period}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Resumen de red (compatibilidad).
   */
  getStats: async () => {
    const res = await fetch(`${BASE_URL}/superadmin/stats`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Lista restaurantes con paginación, filtros y conteo de ventas.
   */
  getRestaurants: async ({ page = 1, limit = 20, search = "", active, status } = {}) => {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);
    if (search) params.set("search", search);
    if (typeof active === "boolean") params.set("active", active);
    if (status) params.set("status", status);

    const res = await fetch(`${BASE_URL}/superadmin/restaurants?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Detalle completo de un restaurante por ID o Slug.
   */
  getRestaurant: async (id) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants/${id}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Crea un nuevo restaurante.
   */
  createRestaurant: async (data) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza los datos o estado de un restaurante.
   */
  updateRestaurant: async (id, data) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  /**
   * Consulta el personal asignado a un restaurante.
   */
  getStaff: async (restaurantId) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants/${restaurantId}/staff`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Asigna un usuario existente como personal de un restaurante.
   */
  addStaff: async (restaurantId, { userId, email, role, active }) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants/${restaurantId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, email, role, active }),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza el rol local o estado activo de una membresía.
   */
  updateStaffMembership: async (restaurantId, membershipId, { role, active }) => {
    const res = await fetch(`${BASE_URL}/superadmin/restaurants/${restaurantId}/staff/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role, active }),
    });
    return handleResponse(res);
  },

  /**
   * Lista usuarios globales con filtros y paginación.
   */
  getUsers: async ({ page = 1, limit = 20, search = "", role, active } = {}) => {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    if (typeof active === "boolean") params.set("active", active);

    const res = await fetch(`${BASE_URL}/superadmin/users?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Detalle completo de un usuario por ID o Email.
   */
  getUser: async (userId) => {
    const res = await fetch(`${BASE_URL}/superadmin/users/${userId}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Activa o suspende una cuenta de usuario.
   */
  setUserActive: async (userId, active) => {
    const res = await fetch(`${BASE_URL}/superadmin/users/${userId}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active }),
    });
    return handleResponse(res);
  },

  /**
   * Consulta global de pedidos con filtros y paginación.
   */
  getOrders: async ({ page = 1, limit = 20, restaurantId, status, startDate, endDate, search } = {}) => {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);
    if (restaurantId) params.set("restaurantId", restaurantId);
    if (status) params.set("status", status);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);

    const res = await fetch(`${BASE_URL}/superadmin/orders?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Detalle completo de un pedido por ID o OrderNumber.
   */
  getOrder: async (orderId) => {
    const res = await fetch(`${BASE_URL}/superadmin/orders/${orderId}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },
};

// ─── API de cupones y descuentos ─────────────────────────────────────────────

export const couponApi = {
  /**
   * Consulta los cupones configurados para el restaurante (Panel Admin).
   */
  getRestaurantCoupons: async (restaurantIdOrSlug = RESTAURANT_SLUG) => {
    const res = await fetch(`${BASE_URL}/coupons/admin/restaurant/${restaurantIdOrSlug}`, {
      method: "GET",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Crea un nuevo cupón en el restaurante.
   */
  createCoupon: async (restaurantIdOrSlug = RESTAURANT_SLUG, couponData) => {
    const res = await fetch(`${BASE_URL}/coupons/admin/restaurant/${restaurantIdOrSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(couponData),
    });
    return handleResponse(res);
  },

  /**
   * Actualiza los datos de un cupón existente.
   */
  updateCoupon: async (couponId, couponData) => {
    const res = await fetch(`${BASE_URL}/coupons/admin/${couponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(couponData),
    });
    return handleResponse(res);
  },

  /**
   * Activa o desactiva rápidamente un cupón.
   */
  toggleCouponActive: async (couponId, active) => {
    const res = await fetch(`${BASE_URL}/coupons/admin/${couponId}/active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ active }),
    });
    return handleResponse(res);
  },

  /**
   * Elimina un cupón (o lo desactiva si tiene pedidos históricos).
   */
  deleteCoupon: async (couponId) => {
    const res = await fetch(`${BASE_URL}/coupons/admin/${couponId}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * Valida un cupón y calcula el descuento en checkout.
   */
  validateCoupon: async ({ restaurantSlug = RESTAURANT_SLUG, restaurantId, code, subtotal }) => {
    const res = await fetch(`${BASE_URL}/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ restaurantSlug, restaurantId, code, subtotal }),
    });
    return handleResponse(res);
  },
};
