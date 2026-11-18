const prisma = require("../lib/prisma");

/**
 * Normaliza y formatea un pedido para la respuesta al frontend y clientes de API.
 */
function formatOrder(order) {
  return {
    id: order.orderNumber, // Código legible "FP-1001"
    orderId: order.id,     // CUID interno
    orderNumber: order.orderNumber,
    userId: order.userId,
    restaurantId: order.restaurantId,
    status: order.status.toLowerCase(),
    rawStatus: order.status,
    orderType: order.orderType.toLowerCase(),
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
    },
    delivery: order.orderType === "DELIVERY" ? {
      address: order.deliveryAddress,
      reference: order.deliveryRef || "",
    } : null,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      notes: item.notes || "",
      options: item.selectedOptions || [],
      selectedOptions: item.selectedOptions || [],
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount ?? 0,
    couponId: order.couponId || null,
    couponCode: order.couponCode || null,
    couponSnapshot: order.couponSnapshot || null,
    total: order.total,
    paymentMethod: order.paymentMethod,
    notes: order.notes || "",
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    restaurant: order.restaurant || null,
  };
}

/**
 * Estado en caché de la existencia de la tabla restaurant_order_counters en la base de datos.
 * Se consulta una sola vez vía information_schema y se almacena para evitar
 * ejecutar consultas dentro de transacciones interactivas antes de conocer
 * si la migración DDL fue aplicada a la base de datos activa.
 */
let isCounterTableAvailable = null;

async function checkCounterTableAvailable() {
  if (isCounterTableAvailable !== null) return isCounterTableAvailable;
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_order_counters'
      ) AS "exists";
    `;
    isCounterTableAvailable = Boolean(result[0]?.exists);
  } catch {
    isCounterTableAvailable = false;
  }
  return isCounterTableAvailable;
}

/**
 * Invalida el caché de disponibilidad de la tabla de contadores.
 * Debe llamarse solo en entornos de prueba o tras aplicar la migración
 * con el servidor en ejecución.
 */
function resetCounterTableCache() {
  isCounterTableAvailable = null;
}

/**
 * Genera el siguiente número de pedido atómico por restaurante.
 * Formato: 6 dígitos numéricos con ceros a la izquierda (ej. "000001", "000002").
 *
 * Estrategia atómica en PostgreSQL:
 * Utiliza upsert con incremento nativo sobre RestaurantOrderCounter.
 * PostgreSQL adquiere un bloqueo de tupla exclusivo a nivel de fila mediante
 * ON CONFLICT ("restaurantId") DO UPDATE, garantizando atomicidad estricta
 * y ausencia de colisiones incluso bajo solicitudes concurrentes.
 *
 * Requisito previo: la migración de Fase 7A debe estar aplicada en la base de datos.
 * Si la tabla `restaurant_order_counters` no existe, se lanza un error controlado
 * que detiene la creación del pedido sin generar datos parciales.
 */
async function generateOrderNumber(tx, restaurantId) {
  const hasCounterTable = await checkCounterTableAvailable();

  if (!hasCounterTable) {
    const err = new Error(
      "El sistema de numeración de pedidos no está configurado. " +
      "La migración de Fase 7A debe aplicarse antes de procesar pedidos."
    );
    err.statusCode = 503;
    err.isOperational = true;
    err.code = "ORDER_COUNTER_NOT_INITIALIZED";
    throw err;
  }

  const counter = await tx.restaurantOrderCounter.upsert({
    where: { restaurantId },
    create: {
      restaurantId,
      lastNumber: 1n,
    },
    update: {
      lastNumber: { increment: 1 },
    },
    select: {
      lastNumber: true,
    },
  });

  // Usar .toString() para evitar pérdida de precisión con valores BigInt
  // que superen Number.MAX_SAFE_INTEGER (9,007,199,254,740,991)
  return counter.lastNumber.toString().padStart(6, "0");
}

/**
 * Validador de transiciones de estado permitidas en el restaurante.
 */
const VALID_TRANSITIONS = {
  RECEIVED:   ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["PREPARING", "CANCELLED"],
  PREPARING:  ["READY", "CANCELLED"],
  READY:      ["ON_THE_WAY", "DELIVERED", "CANCELLED"],
  ON_THE_WAY: ["DELIVERED", "CANCELLED"],
  DELIVERED:  [], // Estado terminal
  CANCELLED:  [], // Estado terminal
};

/**
 * Crea un pedido validando todos los datos, calculando precios exclusivamente
 * en el servidor desde Neon y ejecutando todo dentro de una transacción.
 */
async function createOrder({
  userId,
  restaurantSlug,
  restaurantId,
  orderType = "pickup",
  delivery,
  customer,
  items,
  paymentMethod = "cash",
  notes,
  couponCode,
}) {
  // 1. Validar usuario activo
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    const err = new Error("Usuario no encontrado o cuenta inactiva.");
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  // 2. Validar restaurante activo y abierto
  let restaurant;
  if (restaurantId) {
    restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  } else if (restaurantSlug) {
    restaurant = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } });
  } else {
    const err = new Error("Identificador o slug de restaurante requerido para crear el pedido.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (!restaurant || !restaurant.active) {
    const err = new Error("El restaurante no existe o no está activo.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (restaurant.status === "CLOSED") {
    const err = new Error("El restaurante se encuentra cerrado en este momento.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  // 3. Validar lista de ítems
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("El pedido debe contener al menos un producto.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  // 4. Validar formato de cantidades y recolectar IDs de productos
  const productIds = [];
  for (const item of items) {
    const productId = item.productId || item.id;
    if (!productId) {
      const err = new Error("Identificador de producto requerido en cada ítem.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      const err = new Error(`Cantidad inválida (${item.quantity}) para el producto.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    productIds.push(productId);
  }

  // 5. Consultar los productos reales desde Neon con sus opciones
  const dbProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      restaurantId: restaurant.id,
    },
    include: {
      options: true,
    },
  });

  const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

  // 6. Validar productos y calcular subtotales históricos en el servidor
  let orderSubtotal = 0;
  const orderItemsData = [];

  for (const item of items) {
    const productId = item.productId || item.id;
    const dbProduct = dbProductMap.get(productId);

    if (!dbProduct) {
      const err = new Error(`El producto solicitado no existe o no pertenece a este restaurante.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (!dbProduct.active || !dbProduct.available) {
      const err = new Error(`El producto "${dbProduct.name}" no está disponible actualmente.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    const qty = Number(item.quantity);

    // Validar opciones/adicionales seleccionadas
    const rawOptions = item.selectedOptions || item.options || [];
    const dbOptionsMap = new Map(dbProduct.options.map((o) => [o.id, o]));
    const verifiedOptionsSnapshot = [];
    let optionsPriceSum = 0;

    for (const opt of rawOptions) {
      const optId = typeof opt === "string" ? opt : opt.id;
      const dbOpt = dbOptionsMap.get(optId);

      if (!dbOpt || !dbOpt.active) {
        const err = new Error(`La opción seleccionada no es válida para el producto "${dbProduct.name}".`);
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }

      optionsPriceSum += dbOpt.price;
      verifiedOptionsSnapshot.push({
        id: dbOpt.id,
        name: dbOpt.name,
        price: dbOpt.price,
      });
    }

    // Cálculo seguro e inmutable en el servidor
    const itemSubtotal = (dbProduct.price + optionsPriceSum) * qty;
    orderSubtotal += itemSubtotal;

    orderItemsData.push({
      productId: dbProduct.id,
      name: dbProduct.name,
      unitPrice: dbProduct.price,
      quantity: qty,
      subtotal: itemSubtotal,
      notes: typeof item.note === "string" ? item.note.trim() : (item.notes?.trim() || null),
      selectedOptions: verifiedOptionsSnapshot,
    });
  }

  // 7. Tipo de pedido y datos de entrega
  const isDelivery = String(orderType).toLowerCase() === "delivery";
  const normalizedOrderType = isDelivery ? "DELIVERY" : "PICKUP";

  if (isDelivery && (!delivery?.address || !delivery.address.trim())) {
    const err = new Error("La dirección de entrega es obligatoria para pedidos a domicilio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const deliveryFee = isDelivery ? restaurant.deliveryFee : 0;

  // 7.1 Validación y cálculo de cupón de descuento en servidor
  let validatedCoupon = null;
  let discountAmount = 0;

  if (couponCode) {
    const normalizedCode = String(couponCode).trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: {
        restaurantId_code: {
          restaurantId: restaurant.id,
          code: normalizedCode,
        },
      },
    });

    if (!coupon) {
      const err = new Error(`El cupón "${normalizedCode}" no existe o no pertenece a este restaurante.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (!coupon.active) {
      const err = new Error(`El cupón "${coupon.code}" está inactivo.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    const now = new Date();
    if (coupon.startDate && now < new Date(coupon.startDate)) {
      const err = new Error(`El cupón "${coupon.code}" aún no está vigente.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (coupon.endDate && now > new Date(coupon.endDate)) {
      const err = new Error(`El cupón "${coupon.code}" ha expirado.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (coupon.minimumOrderAmount && orderSubtotal < coupon.minimumOrderAmount) {
      const err = new Error(
        `El pedido no alcanza la compra mínima de $${coupon.minimumOrderAmount.toLocaleString("es-CO")} para usar este cupón.`
      );
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      const err = new Error(`El cupón "${coupon.code}" ha alcanzado su límite de usos disponibles.`);
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = Math.round((orderSubtotal * coupon.discountValue) / 100);
      if (coupon.maximumDiscount !== null && coupon.maximumDiscount !== undefined && coupon.maximumDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
      }
    } else if (coupon.discountType === "FIXED") {
      discountAmount = Math.min(coupon.discountValue, orderSubtotal);
    }

    discountAmount = Math.max(0, Math.min(discountAmount, orderSubtotal));
    validatedCoupon = coupon;
  }

  // Total final: max(0, subtotal - discount) + deliveryFee
  const orderTotal = Math.max(0, orderSubtotal - discountAmount) + deliveryFee;

  const customerName = (customer?.name?.trim() || user.name || "Cliente").slice(0, 100);
  const customerPhone = (customer?.phone?.trim() || user.phone || "").slice(0, 20);

  // 8. Creación transaccional en PostgreSQL (Neon)
  const createdOrder = await prisma.$transaction(
    async (tx) => {
    // Si se usó cupón, validar y actualizar usageCount atómicamente en la transacción
    if (validatedCoupon) {
      if (validatedCoupon.usageLimit !== null) {
        const updateResult = await tx.coupon.updateMany({
          where: {
            id: validatedCoupon.id,
            usageCount: { lt: validatedCoupon.usageLimit },
          },
          data: {
            usageCount: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          const err = new Error(`El cupón "${validatedCoupon.code}" ha alcanzado su límite de usos disponibles.`);
          err.statusCode = 400;
          err.isOperational = true;
          throw err;
        }
      } else {
        await tx.coupon.update({
          where: { id: validatedCoupon.id },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }
    }

    const orderNumber = await generateOrderNumber(tx, restaurant.id);

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: user.id,
        restaurantId: restaurant.id,
        status: "RECEIVED",
        orderType: normalizedOrderType,
        customerName,
        customerPhone,
        deliveryAddress: isDelivery ? delivery.address.trim() : null,
        deliveryRef: isDelivery && delivery?.reference ? delivery.reference.trim() : null,
        notes: notes ? notes.trim() : null,
        paymentMethod: paymentMethod || "cash",
        subtotal: orderSubtotal,
        deliveryFee,
        discount: discountAmount,
        couponId: validatedCoupon ? validatedCoupon.id : null,
        couponCode: validatedCoupon ? validatedCoupon.code : null,
        couponSnapshot: validatedCoupon
          ? {
              id: validatedCoupon.id,
              code: validatedCoupon.code,
              description: validatedCoupon.description,
              discountType: validatedCoupon.discountType,
              discountValue: validatedCoupon.discountValue,
              discountApplied: discountAmount,
              minimumOrderAmount: validatedCoupon.minimumOrderAmount,
              maximumDiscount: validatedCoupon.maximumDiscount,
            }
          : null,
        total: orderTotal,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: true,
        restaurant: {
          select: { id: true, name: true, slug: true, logoUrl: true, phone: true },
        },
      },
    });

    // Incrementar unidades vendidas de cada producto de manera transaccional
    for (const item of orderItemsData) {
      await tx.product.update({
        where: { id: item.productId },
        data: { sold: { increment: item.quantity } },
      });
    }

    return order;
    },
    { timeout: 15000, maxWait: 10000 }
  );

  return formatOrder(createdOrder);
}

/**
 * Consulta todos los pedidos pertenecientes al cliente autenticado.
 */
async function getCustomerOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: true,
      restaurant: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map(formatOrder);
}

/**
 * Consulta un pedido por ID o número de orden.
 * Seguridad: Solo lo permite si pertenece al usuario o si el usuario es ADMIN / SUPERADMIN.
 */
async function getOrderById(orderIdentifier, requestingUser) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: orderIdentifier },
        { orderNumber: orderIdentifier },
      ],
    },
    include: {
      items: true,
      restaurant: {
        select: { id: true, name: true, slug: true, logoUrl: true, phone: true },
      },
    },
  });

  if (!order) {
    const err = new Error("Pedido no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const isOwner = order.userId === requestingUser.id;
  let isAuthorizedAdmin = false;
  if (requestingUser.role === "SUPERADMIN") {
    isAuthorizedAdmin = true;
  } else if (requestingUser.role === "ADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: order.restaurantId,
        },
      },
    });
    isAuthorizedAdmin = !!(membership && membership.active);
  }

  if (!isOwner && !isAuthorizedAdmin) {
    const err = new Error("No tienes autorización para consultar este pedido.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  return formatOrder(order);
}

/**
 * Consulta pedidos de un restaurante (requiere permisos de administración).
 * Aislamiento multi-restaurante: Verifica membresía activa sobre el restaurante solicitado.
 */
async function getRestaurantOrders(restaurantIdOrSlug, requestingUser) {
  const isAdmin = requestingUser.role === "ADMIN" || requestingUser.role === "SUPERADMIN";
  if (!isAdmin) {
    const err = new Error("Acceso restringido para el panel de administración.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const activeRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdOrSlug }, { slug: restaurantIdOrSlug }],
    },
  });

  if (!activeRestaurant) {
    if (requestingUser.role === "SUPERADMIN") {
      const err = new Error("Restaurante no configurado.");
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
    const err = new Error("No tienes autorización para acceder a los pedidos de otro restaurante.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: activeRestaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para acceder a los pedidos de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const orders = await prisma.order.findMany({
    where: { restaurantId: activeRestaurant.id },
    include: {
      items: true,
      restaurant: {
        select: { id: true, name: true, slug: true, logoUrl: true, phone: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map(formatOrder);
}

/**
 * Calcula métricas en tiempo real a partir de los datos persistidos en Neon.
 * Todas las cifras provienen de pedidos y productos reales en PostgreSQL.
 * Aislamiento multi-restaurante: Valida membresía activa con rol OWNER o MANAGER.
 */
async function getRestaurantMetrics(restaurantIdOrSlug, requestingUser) {
  const isAdmin = requestingUser.role === "ADMIN" || requestingUser.role === "SUPERADMIN";
  if (!isAdmin) {
    const err = new Error("Acceso restringido para el panel de administración.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const activeRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdOrSlug }, { slug: restaurantIdOrSlug }],
    },
    include: {
      products: {
        where: { active: true },
        include: { category: true, options: true },
      },
    },
  });

  if (!activeRestaurant) {
    if (requestingUser.role === "SUPERADMIN") {
      const err = new Error("Restaurante no configurado.");
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
    const err = new Error("No tienes autorización para acceder a las métricas de otro restaurante.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: activeRestaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para acceder a las métricas de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para consultar métricas financieras.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // 1. Todos los pedidos del restaurante
  const allOrders = await prisma.order.findMany({
    where: { restaurantId: activeRestaurant.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  // 2. Pedidos y ventas de hoy (excluyendo cancelados)
  const todayOrders = allOrders.filter(
    (o) => new Date(o.createdAt) >= startOfToday && o.status !== "CANCELLED"
  );
  const todaySales = todayOrders.reduce((sum, o) => sum + o.total, 0);

  // 3. Ventas de la semana (últimos 7 días) agrupadas por día
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const weeklyDays = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i, 0, 0, 0, 0);
    const dayEnd = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() - i + 1, 0, 0, 0, 0);

    const dayOrders = allOrders.filter((o) => {
      const orderTime = new Date(o.createdAt);
      return orderTime >= dayStart && orderTime < dayEnd && o.status !== "CANCELLED";
    });
    const dayTotal = dayOrders.reduce((sum, o) => sum + o.total, 0);

    weeklyDays.push({
      date: dayStart.toISOString().slice(0, 10),
      dayLabel: dayNames[dayStart.getDay()],
      totalSales: dayTotal,
      ordersCount: dayOrders.length,
    });
  }

  // 4. Producto estrella con base en unidades vendidas en Neon
  let topProduct = null;
  const sortedProducts = [...activeRestaurant.products].sort((a, b) => b.sold - a.sold);
  if (sortedProducts.length > 0) {
    const top = sortedProducts[0];
    const topRevenue = top.sold * top.price;
    const topProfit = top.sold * (top.price - (top.cost || 0));
    topProduct = {
      id: top.id,
      name: top.name,
      price: top.price,
      cost: top.cost || 0,
      sold: top.sold,
      revenue: topRevenue,
      profit: topProfit,
      categoryName: top.category?.name || "General",
    };
  }

  // 5. Métricas de clientes
  const customerOrderCounts = new Map();
  allOrders.forEach((o) => {
    if (o.status !== "CANCELLED") {
      const key = o.userId || o.customerPhone;
      customerOrderCounts.set(key, (customerOrderCounts.get(key) || 0) + 1);
    }
  });

  const totalCustomers = customerOrderCounts.size;
  let frequentCustomers = 0;
  customerOrderCounts.forEach((count) => {
    if (count >= 2) frequentCustomers++;
  });

  const validOrders = allOrders.filter((o) => o.status !== "CANCELLED");
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const averageTicket = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

  // 6. Estimación de ganancia neta hoy (subtotal facturado - costo base - costo de adicionales)
  // Regla documentada: si el costo de un producto u opción es null, se computa como 0 (costo marginal no registrado).
  let todayProfit = 0;
  const productCostMap = new Map(activeRestaurant.products.map((p) => [p.id, p.cost || 0]));
  const optionCostMap = new Map();
  activeRestaurant.products.forEach((p) => {
    (p.options || []).forEach((opt) => {
      optionCostMap.set(opt.id, opt.cost != null ? opt.cost : 0);
    });
  });

  todayOrders.forEach((order) => {
    order.items.forEach((item) => {
      const baseCost = productCostMap.get(item.productId) || 0;
      let optionsCost = 0;
      if (Array.isArray(item.selectedOptions)) {
        item.selectedOptions.forEach((opt) => {
          const c = optionCostMap.get(opt.id);
          optionsCost += c != null ? c : 0;
        });
      }
      const totalItemCost = (baseCost + optionsCost) * item.quantity;
      todayProfit += (item.subtotal - totalItemCost);
    });
  });

  return {
    todaySales,
    todayOrdersCount: todayOrders.length,
    todayProfit,
    monthlyGoal: activeRestaurant.monthlyGoal || 5000000,
    weeklyDays,
    topProduct,
    customersSummary: {
      totalCustomers,
      frequentCustomers,
      repeatRate: totalCustomers > 0 ? Math.round((frequentCustomers / totalCustomers) * 100) : 0,
      averageTicket,
    },
    recentOrders: allOrders.slice(0, 10).map(formatOrder),
  };
}

/**
 * Helper — Valida acceso y membresía del usuario sobre el restaurante solicitado.
 * Retorna el restaurante con sus productos y categorías si la validación es exitosa.
 */
async function verifyRestaurantAccess(restaurantIdOrSlug, requestingUser, allowedRoles = ["OWNER", "MANAGER"]) {
  const isAdmin = requestingUser.role === "ADMIN" || requestingUser.role === "SUPERADMIN";
  if (!isAdmin) {
    const err = new Error("Acceso restringido para el panel de administración.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const activeRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdOrSlug }, { slug: restaurantIdOrSlug }],
    },
    include: {
      products: {
        where: { active: true },
        include: { category: true, options: true },
      },
    },
  });

  if (!activeRestaurant) {
    if (requestingUser.role === "SUPERADMIN") {
      const err = new Error("Restaurante no configurado.");
      err.statusCode = 404;
      err.isOperational = true;
      throw err;
    }
    const err = new Error("No tienes autorización para acceder a este restaurante.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: activeRestaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para acceder a los datos de este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!allowedRoles.includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para esta acción.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  return activeRestaurant;
}

/**
 * Retorna análisis comercial completo:
 * - Productos estrella (ranking de volumen y facturación)
 * - Productos más rentables (margen real y ganancia neta en COP)
 * - Demanda temporal por día de la semana y por hora (excluyendo CANCELLED)
 */
async function getRestaurantAnalytics(restaurantIdOrSlug, requestingUser) {
  const activeRestaurant = await verifyRestaurantAccess(restaurantIdOrSlug, requestingUser);

  // Consultar pedidos válidos del restaurante (excluyendo CANCELLED)
  const validOrders = await prisma.order.findMany({
    where: {
      restaurantId: activeRestaurant.id,
      status: { not: "CANCELLED" },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Mapa de estadísticas de productos
  const productStatsMap = new Map();

  activeRestaurant.products.forEach((p) => {
    productStatsMap.set(p.id, {
      id: p.id,
      name: p.name,
      categoryName: p.category?.name || "General",
      price: p.price,
      cost: p.cost || 0,
      unitsSold: p.sold || 0,
      itemsSoldFromOrders: 0,
      revenueFromOrders: 0,
      imageUrl: p.imageUrl,
    });
  });

  validOrders.forEach((o) => {
    o.items.forEach((item) => {
      let entry = productStatsMap.get(item.productId);
      if (!entry) {
        entry = {
          id: item.productId,
          name: item.name,
          categoryName: "General",
          price: item.unitPrice,
          cost: 0,
          unitsSold: 0,
          itemsSoldFromOrders: 0,
          revenueFromOrders: 0,
          imageUrl: null,
        };
        productStatsMap.set(item.productId, entry);
      }
      entry.itemsSoldFromOrders += item.quantity;
      entry.revenueFromOrders += item.subtotal;
    });
  });

  const allProductStats = Array.from(productStatsMap.values()).map((p) => {
    const units = Math.max(p.unitsSold, p.itemsSoldFromOrders);
    const revenue = p.revenueFromOrders > 0 ? p.revenueFromOrders : units * p.price;
    const totalCost = units * (p.cost || 0);
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;
    return {
      id: p.id,
      name: p.name,
      categoryName: p.categoryName,
      price: p.price,
      cost: p.cost,
      unitsSold: units,
      revenue,
      totalCost,
      profit,
      margin,
      imageUrl: p.imageUrl,
    };
  });

  // A. Ranking Productos Estrella (más vendidos)
  const topSellingProducts = [...allProductStats]
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .map((p, idx) => ({
      ...p,
      rank: idx + 1,
      isTopStar: idx === 0 && p.unitsSold > 0,
    }));

  // B. Ranking Productos Más Rentables (mayor ganancia neta en COP y margen)
  const mostProfitableProducts = [...allProductStats]
    .sort((a, b) => b.profit - a.profit || b.margin - a.margin)
    .map((p, idx) => ({
      ...p,
      profitRank: idx + 1,
      isTopProfit: idx === 0 && p.profit > 0,
    }));

  // C. Demanda por Día de la Semana (America/Bogota UTC-5)
  // 1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie, 6: Sáb, 0: Dom
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayNames = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
  };

  const dayMap = new Map();
  dayOrder.forEach((dayIdx) => {
    dayMap.set(dayIdx, {
      dayIndex: dayIdx,
      dayName: dayNames[dayIdx],
      ordersCount: 0,
      totalSales: 0,
      isPeak: false,
    });
  });

  // Demanda por Hora del Día (0 a 23)
  const hourMap = new Map();
  for (let h = 0; h < 24; h++) {
    const startStr = `${String(h).padStart(2, "0")}:00`;
    const endStr = `${String((h + 1) % 24).padStart(2, "0")}:00`;
    hourMap.set(h, {
      hour: h,
      hourLabel: `${startStr} - ${endStr}`,
      ordersCount: 0,
      totalSales: 0,
      isPeak: false,
    });
  }

  validOrders.forEach((o) => {
    const bogotaDate = new Date(new Date(o.createdAt).getTime() - 5 * 60 * 60 * 1000);
    const day = bogotaDate.getUTCDay();
    const hour = bogotaDate.getUTCHours();

    if (dayMap.has(day)) {
      const dEntry = dayMap.get(day);
      dEntry.ordersCount += 1;
      dEntry.totalSales += o.total;
    }

    if (hourMap.has(hour)) {
      const hEntry = hourMap.get(hour);
      hEntry.ordersCount += 1;
      hEntry.totalSales += o.total;
    }
  });

  const demandByDay = Array.from(dayMap.values());
  const demandByHour = Array.from(hourMap.values());

  // Identificar pico de día
  let maxDayOrders = 0;
  let peakDay = null;
  demandByDay.forEach((d) => {
    if (d.ordersCount > maxDayOrders) {
      maxDayOrders = d.ordersCount;
      peakDay = d;
    }
  });
  if (peakDay && peakDay.ordersCount > 0) {
    peakDay.isPeak = true;
  }

  // Identificar pico de hora
  let maxHourOrders = 0;
  let peakHour = null;
  demandByHour.forEach((h) => {
    if (h.ordersCount > maxHourOrders) {
      maxHourOrders = h.ordersCount;
      peakHour = h;
    }
  });
  if (peakHour && peakHour.ordersCount > 0) {
    peakHour.isPeak = true;
  }

  const totalAnalyzedRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

  return {
    hasOrders: validOrders.length > 0,
    totalAnalyzedOrders: validOrders.length,
    totalAnalyzedRevenue,
    topSellingProducts,
    mostProfitableProducts,
    demandByDay,
    demandByHour,
    peakDay: peakDay && peakDay.ordersCount > 0 ? peakDay : null,
    peakHour: peakHour && peakHour.ordersCount > 0 ? peakHour : null,
  };
}

/**
 * Retorna la meta mensual vigente y el estado de cumplimiento del restaurante.
 */
async function getRestaurantGoal(restaurantIdOrSlug, requestingUser) {
  const activeRestaurant = await verifyRestaurantAccess(restaurantIdOrSlug, requestingUser);

  // Fecha y mes en Bogotá (UTC-5)
  const now = new Date();
  const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const year = bogotaNow.getUTCFullYear();
  const month = bogotaNow.getUTCMonth(); // 0 a 11

  const startOfMonth = new Date(Date.UTC(year, month, 1, 5, 0, 0, 0));
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const startOfNextMonth = new Date(Date.UTC(nextYear, nextMonth, 1, 5, 0, 0, 0));

  // Pedidos válidos del mes actual (excluyendo CANCELLED)
  const monthOrders = await prisma.order.findMany({
    where: {
      restaurantId: activeRestaurant.id,
      status: { not: "CANCELLED" },
      createdAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
    select: {
      id: true,
      total: true,
      createdAt: true,
    },
  });

  const currentMonthSales = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const monthlyGoal = activeRestaurant.monthlyGoal || 5000000;
  const progressPct = monthlyGoal > 0 ? Number(((currentMonthSales / monthlyGoal) * 100).toFixed(1)) : 0;
  const remaining = Math.max(0, monthlyGoal - currentMonthSales);
  const isGoalReached = currentMonthSales >= monthlyGoal;

  const lastDayOfMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const currentDay = bogotaNow.getUTCDate();
  const daysRemaining = Math.max(0, lastDayOfMonth - currentDay);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return {
    restaurantId: activeRestaurant.id,
    restaurantName: activeRestaurant.name,
    restaurantSlug: activeRestaurant.slug,
    monthName: monthNames[month],
    year,
    monthlyGoal,
    currentMonthSales,
    currentMonthOrdersCount: monthOrders.length,
    progressPct,
    remaining,
    isGoalReached,
    daysRemaining,
    daysInMonth: lastDayOfMonth,
  };
}

/**
 * Modifica la meta mensual de ventas del restaurante en Neon.
 */
async function updateRestaurantGoal(restaurantIdOrSlug, newGoal, requestingUser) {
  const activeRestaurant = await verifyRestaurantAccess(restaurantIdOrSlug, requestingUser);

  const goalNum = Number(newGoal);
  if (!Number.isInteger(goalNum) || goalNum <= 0) {
    const err = new Error("La meta mensual de ventas debe ser un número entero mayor a 0 (COP).");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  await prisma.restaurant.update({
    where: { id: activeRestaurant.id },
    data: { monthlyGoal: goalNum },
  });

  return getRestaurantGoal(activeRestaurant.id, requestingUser);
}

/**
 * Actualiza el estado de un pedido validando las transiciones de estado permitidas.
 */
async function updateOrderStatus(orderIdentifier, newStatus, requestingUser) {
  const isAdmin = requestingUser.role === "ADMIN" || requestingUser.role === "SUPERADMIN";
  if (!isAdmin) {
    const err = new Error("No tienes permisos para modificar el estado del pedido.");
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  const upperStatus = String(newStatus).toUpperCase();
  const validStatusList = Object.keys(VALID_TRANSITIONS);

  if (!validStatusList.includes(upperStatus)) {
    const err = new Error(`Estado inválido: "${newStatus}". Estados válidos: ${validStatusList.join(", ")}`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: orderIdentifier },
        { orderNumber: orderIdentifier },
      ],
    },
    include: { restaurant: true },
  });

  if (!order) {
    const err = new Error("Pedido no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  // Aislamiento multi-restaurante: verificar membresía activa sobre el restaurante del pedido
  if (requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: order.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para modificar pedidos de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER", "KITCHEN"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para modificar pedidos.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const allowedNext = VALID_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(upperStatus)) {
    const err = new Error(
      `Transición no permitida de "${order.status}" a "${upperStatus}". Estados posibles: ${allowedNext.join(", ") || "Ninguno (estado terminal)"}`
    );
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { status: upperStatus },
    include: {
      items: true,
      restaurant: {
        select: { id: true, name: true, slug: true, logoUrl: true, phone: true },
      },
    },
  });

  return formatOrder(updated);
}

module.exports = {
  formatOrder,
  generateOrderNumber,
  checkCounterTableAvailable,
  resetCounterTableCache,
  createOrder,
  getCustomerOrders,
  getOrderById,
  getRestaurantOrders,
  getRestaurantMetrics,
  getRestaurantAnalytics,
  getRestaurantGoal,
  updateRestaurantGoal,
  updateOrderStatus,
};
