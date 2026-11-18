/**
 * superadmin.service.js
 * Capa de servicio integral para el módulo SuperAdmin de FoodiePOP (Etapa 5C).
 * Todas las funciones requieren autenticación y rol global SUPERADMIN.
 */
"use strict";

const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.isOperational = true;
  return err;
}

// ─── Helpers de Fecha y Zona Horaria (America/Bogota: UTC-5) ─────────────────

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

function getBogotaDateParts(date = new Date()) {
  const bogotaDate = new Date(date.getTime() + BOGOTA_OFFSET_MS);
  return {
    year: bogotaDate.getUTCFullYear(),
    month: bogotaDate.getUTCMonth(),
    day: bogotaDate.getUTCDate(),
  };
}

function getStartOfBogotaDay(date = new Date()) {
  const { year, month, day } = getBogotaDateParts(date);
  return new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
}

function getEndOfBogotaDay(date = new Date()) {
  const { year, month, day } = getBogotaDateParts(date);
  return new Date(Date.UTC(year, month, day + 1, 4, 59, 59, 999));
}

function formatBogotaDateString(date) {
  const { year, month, day } = getBogotaDateParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Helper para formatear pedidos en SuperAdmin
function formatSuperAdminOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryRef: order.deliveryRef,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    restaurant: order.restaurant
      ? {
          id: order.restaurant.id,
          name: order.restaurant.name,
          slug: order.restaurant.slug,
          phone: order.restaurant.phone,
          address: order.restaurant.address,
        }
      : null,
    itemsCount: order.items ? order.items.length : (order._count?.items ?? 0),
    items: order.items
      ? order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
          notes: item.notes,
          selectedOptions: item.selectedOptions || [],
        }))
      : undefined,
    user: order.user
      ? {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone,
        }
      : undefined,
  };
}

// ─── 1. Dashboard Global y Métricas ──────────────────────────────────────────

async function getMetrics({ period = 30 } = {}) {
  const periodDays = Number.isInteger(Number(period)) && Number(period) > 0 ? Number(period) : 30;
  const now = new Date();
  const startToday = getStartOfBogotaDay(now);
  const endToday = getEndOfBogotaDay(now);

  // Inicio del período (N días hacia atrás considerando el día actual en Bogotá)
  const startPeriod = new Date(startToday.getTime() - (periodDays - 1) * 24 * 60 * 60 * 1000);

  // Consultas agregadas concurrentes
  const [
    totalRestaurants,
    activeRestaurants,
    closedOrPausedRestaurants,
    statusBreakdown,
    totalUsers,
    totalOrders,
    todayOrders,
    todaySalesAgg,
    periodValidOrdersCount,
    periodSalesAgg,
    periodOrdersRaw,
    topItemsRaw,
    topRestaurantsRaw,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { active: true, status: "OPEN" } }),
    prisma.restaurant.count({
      where: {
        OR: [{ status: "CLOSED" }, { status: "PAUSED" }, { active: false }],
      },
    }),
    prisma.restaurant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({
      where: { createdAt: { gte: startToday, lte: endToday } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        createdAt: { gte: startToday, lte: endToday },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: startPeriod },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        createdAt: { gte: startPeriod },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: startPeriod } },
      select: { createdAt: true, total: true, status: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, subtotal: true },
      where: {
        order: {
          createdAt: { gte: startPeriod },
          status: { not: "CANCELLED" },
        },
      },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.groupBy({
      by: ["restaurantId"],
      _sum: { total: true },
      _count: { _all: true },
      where: {
        createdAt: { gte: startPeriod },
        status: { not: "CANCELLED" },
      },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
  ]);

  // Construir mapa de evolución diaria para cada uno de los días del período
  const dailyMap = new Map();
  for (let i = periodDays - 1; i >= 0; i--) {
    const targetDate = new Date(startToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = formatBogotaDateString(targetDate);
    dailyMap.set(dateStr, { date: dateStr, sales: 0, orders: 0 });
  }

  // Agrupar pedidos del período en el timeline
  for (const o of periodOrdersRaw) {
    const dateStr = formatBogotaDateString(new Date(o.createdAt));
    if (dailyMap.has(dateStr)) {
      const entry = dailyMap.get(dateStr);
      entry.orders += 1;
      if (o.status !== "CANCELLED") {
        entry.sales += o.total;
      }
    }
  }

  const dailyEvolution = Array.from(dailyMap.values());

  // Ticket promedio del período (ventas período / pedidos válidos período)
  const periodSales = periodSalesAgg._sum.total || 0;
  const averageTicket =
    periodValidOrdersCount > 0 ? Math.round(periodSales / periodValidOrdersCount) : 0;

  // Resolver nombres de productos más vendidos
  const productIds = topItemsRaw.map((item) => item.productId);
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          price: true,
          restaurant: { select: { id: true, name: true, slug: true } },
        },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const topProducts = topItemsRaw.map((item) => {
    const prod = productMap.get(item.productId);
    return {
      id: item.productId,
      name: prod?.name || "Producto no disponible",
      price: prod?.price || 0,
      soldUnits: item._sum.quantity || 0,
      revenue: item._sum.subtotal || 0,
      restaurant: prod?.restaurant || null,
    };
  });

  // Resolver nombres de restaurantes con mayor volumen de ventas
  const restaurantIds = topRestaurantsRaw.map((r) => r.restaurantId);
  const topRestNames = restaurantIds.length > 0
    ? await prisma.restaurant.findMany({
        where: { id: { in: restaurantIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const restNameMap = new Map(topRestNames.map((r) => [r.id, r]));

  const topRestaurants = topRestaurantsRaw.map((r) => ({
    restaurant: restNameMap.get(r.restaurantId) || {
      id: r.restaurantId,
      name: "Restaurante",
      slug: "–",
    },
    revenue: r._sum.total || 0,
    orderCount: r._count._all || 0,
  }));

  const statusMap = { OPEN: 0, CLOSED: 0, PAUSED: 0 };
  for (const s of statusBreakdown) {
    statusMap[s.status] = s._count._all;
  }

  return {
    periodDays,
    timezone: "America/Bogota",
    totalRestaurants,
    activeRestaurants,
    closedOrPausedRestaurants,
    restaurantsByStatus: statusMap,
    totalUsers,
    totalOrders,
    todayOrders,
    todaySales: todaySalesAgg._sum.total || 0,
    periodSales,
    periodValidOrders: periodValidOrdersCount,
    averageTicket,
    dailyEvolution,
    topProducts,
    topRestaurants,
  };
}

// Compatibilidad con GET /superadmin/stats
async function getNetworkStats() {
  const metrics = await getMetrics({ period: 30 });
  return {
    restaurants: {
      total: metrics.totalRestaurants,
      active: metrics.activeRestaurants,
    },
    users: { total: metrics.totalUsers },
    orders: {
      total: metrics.totalOrders,
      today: metrics.todayOrders,
      byStatus: metrics.restaurantsByStatus,
    },
    revenue: {
      total: metrics.periodSales,
      today: metrics.todaySales,
    },
    topRestaurants: metrics.topRestaurants.map((tr) => ({
      restaurant: tr.restaurant,
      totalRevenue: tr.revenue,
      orderCount: tr.orderCount,
    })),
  };
}

// ─── 2. Gestión de Restaurantes ───────────────────────────────────────────────

async function listRestaurants({
  page = 1,
  limit = 20,
  search,
  active,
  status,
} = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * take;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      {
        memberships: {
          some: {
            user: {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }
  if (typeof active === "boolean") where.active = active;
  if (status && ["OPEN", "CLOSED", "PAUSED"].includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }

  const [total, rawRestaurants] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        phone: true,
        address: true,
        deliveryFee: true,
        schedule: true,
        logoUrl: true,
        bannerUrl: true,
        status: true,
        active: true,
        createdAt: true,
        _count: {
          select: { orders: true, products: true, memberships: true },
        },
        memberships: {
          where: { role: "OWNER", active: true },
          take: 1,
          select: {
            id: true,
            role: true,
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    }),
  ]);

  // Agrupación de ventas totales por restaurante (excluyendo CANCELLED) sin consultas N+1
  const restaurantIds = rawRestaurants.map((r) => r.id);
  const salesAgg = restaurantIds.length > 0
    ? await prisma.order.groupBy({
        by: ["restaurantId"],
        _sum: { total: true },
        where: {
          restaurantId: { in: restaurantIds },
          status: { not: "CANCELLED" },
        },
      })
    : [];

  const salesMap = new Map(salesAgg.map((s) => [s.restaurantId, s._sum.total || 0]));

  const restaurants = rawRestaurants.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    phone: r.phone,
    address: r.address,
    deliveryFee: r.deliveryFee,
    schedule: r.schedule,
    logoUrl: r.logoUrl,
    bannerUrl: r.bannerUrl,
    status: r.status,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    productsCount: r._count.products,
    ordersCount: r._count.orders,
    membersCount: r._count.memberships,
    totalSales: salesMap.get(r.id) || 0,
    primaryOwner: r.memberships?.[0]?.user || null,
  }));

  return {
    data: restaurants,
    meta: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

async function createRestaurant(data) {
  const {
    slug,
    name,
    description,
    phone,
    address,
    deliveryFee,
    schedule,
    logoUrl,
    bannerUrl,
    status,
    owner,
  } = data;
  if (!slug || !name) throw httpError(400, "Se requieren slug y nombre del restaurante.");

  const cleanSlug = String(slug).trim().toLowerCase();
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(cleanSlug)) {
    throw httpError(400, "El slug solo puede contener letras minúsculas, números y guiones.");
  }

  const existing = await prisma.restaurant.findUnique({ where: { slug: cleanSlug } });
  if (existing) {
    throw httpError(409, `Ya existe un restaurante con el slug "${cleanSlug}".`);
  }

  const validStatus = status && ["OPEN", "CLOSED", "PAUSED"].includes(status.toUpperCase())
    ? status.toUpperCase()
    : "OPEN";

  // Validar datos de owner si se proporcionaron
  let ownerEmail = null;
  let ownerName = null;
  let ownerPassword = null;
  let isNewOwner = false;

  if (owner && owner.email && String(owner.email).trim()) {
    ownerEmail = String(owner.email).trim().toLowerCase();
    ownerName = owner.name && String(owner.name).trim() ? String(owner.name).trim() : `${name.trim()} Admin`;
    ownerPassword = owner.password && String(owner.password).trim() ? String(owner.password).trim() : null;
  }

  return await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.create({
      data: {
        slug: cleanSlug,
        name: name.trim(),
        description: description?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        deliveryFee: Number.isInteger(Number(deliveryFee)) && Number(deliveryFee) >= 0 ? Number(deliveryFee) : 4000,
        schedule: schedule?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        bannerUrl: bannerUrl?.trim() || null,
        status: validStatus,
        active: true,
      },
    });

    let primaryOwner = null;

    if (ownerEmail) {
      let user = await tx.user.findUnique({ where: { email: ownerEmail } });

      if (user) {
        // Usuario ya registrado: si era cliente común, ascenderlo a ADMIN para habilitar panel
        if (user.role === "CLIENT") {
          user = await tx.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
        }
        // Si se envió explícitamente una nueva contraseña, actualizarla
        if (ownerPassword && ownerPassword.length >= 6) {
          const passwordHash = await bcrypt.hash(ownerPassword, 10);
          user = await tx.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
        }
      } else {
        // Crear nuevo usuario ADMIN
        isNewOwner = true;
        const passToUse = ownerPassword && ownerPassword.length >= 6
          ? ownerPassword
          : `Foodie${Math.floor(1000 + Math.random() * 9000)}!`;
        ownerPassword = passToUse; // Guardar texto plano para retornarlo y mostrar credenciales
        const passwordHash = await bcrypt.hash(passToUse, 10);

        user = await tx.user.create({
          data: {
            email: ownerEmail,
            name: ownerName,
            passwordHash,
            role: "ADMIN",
            phone: phone?.trim() || null,
            active: true,
          },
        });
      }

      // Asignar rol OWNER en este restaurante
      await tx.userRestaurantRole.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          role: "OWNER",
          active: true,
        },
      });

      primaryOwner = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isNewUser: isNewOwner,
        assignedPassword: isNewOwner || ownerPassword ? ownerPassword : null,
      };
    }

    return {
      ...restaurant,
      primaryOwner,
    };
  });
}

async function getRestaurantDetail(restaurantIdentifier) {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdentifier }, { slug: restaurantIdentifier }],
    },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              active: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { orders: true, products: true, categories: true, memberships: true },
      },
    },
  });

  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  // Ventas totales del restaurante excluyendo cancelados
  const salesAgg = await prisma.order.aggregate({
    _sum: { total: true },
    where: {
      restaurantId: restaurant.id,
      status: { not: "CANCELLED" },
    },
  });

  return {
    ...restaurant,
    productsCount: restaurant._count.products,
    ordersCount: restaurant._count.orders,
    categoriesCount: restaurant._count.categories,
    membersCount: restaurant._count.memberships,
    totalSales: salesAgg._sum.total || 0,
    staff: restaurant.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  };
}

async function updateRestaurant(restaurantIdentifier, data) {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdentifier }, { slug: restaurantIdentifier }],
    },
  });
  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  const allowed = [
    "name",
    "description",
    "phone",
    "address",
    "deliveryFee",
    "schedule",
    "logoUrl",
    "bannerUrl",
    "status",
    "active",
  ];

  const patch = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === "status") {
        const val = String(data[key]).toUpperCase();
        if (!["OPEN", "CLOSED", "PAUSED"].includes(val)) {
          throw httpError(400, "Estado no válido. Use: OPEN, CLOSED, PAUSED.");
        }
        patch.status = val;
      } else if (key === "active") {
        patch.active = Boolean(data[key]);
      } else if (key === "deliveryFee") {
        const fee = Number(data[key]);
        if (!Number.isInteger(fee) || fee < 0) {
          throw httpError(400, "deliveryFee debe ser un entero no negativo.");
        }
        patch.deliveryFee = fee;
      } else if (typeof data[key] === "string") {
        patch[key] = data[key].trim();
      } else {
        patch[key] = data[key];
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    throw httpError(400, "No se proporcionaron campos válidos para actualizar.");
  }

  return prisma.restaurant.update({
    where: { id: restaurant.id },
    data: patch,
  });
}

async function setRestaurantStatus(restaurantIdentifier, { status, active }) {
  return updateRestaurant(restaurantIdentifier, { status, active });
}

// ─── 3. Gestión de Personal y Membresías ───────────────────────────────────────

async function listStaff(restaurantIdentifier) {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdentifier }, { slug: restaurantIdentifier }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  const memberships = await prisma.userRestaurantRole.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          active: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    restaurant,
    staff: memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      restaurantId: m.restaurantId,
      role: m.role,
      active: m.active,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      user: m.user,
    })),
  };
}

async function addStaff(restaurantIdentifier, { userId, email, role = "MANAGER", active = true }) {
  const validRoles = ["OWNER", "MANAGER", "KITCHEN"];
  const cleanRole = String(role).toUpperCase();
  if (!validRoles.includes(cleanRole)) {
    throw httpError(400, `Rol local no válido. Use: ${validRoles.join(", ")}.`);
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdentifier }, { slug: restaurantIdentifier }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  // Resolver usuario por ID o Email
  let user;
  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  } else if (email) {
    user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  if (!user) throw httpError(404, "Usuario no encontrado.");

  // Comprobar que no exista membresía previa para evitar duplicados
  const existing = await prisma.userRestaurantRole.findUnique({
    where: {
      userId_restaurantId: { userId: user.id, restaurantId: restaurant.id },
    },
  });

  if (existing) {
    throw httpError(409, "El usuario ya cuenta con una membresía asignada en este restaurante.");
  }

  // Creación segura: jamás modifica el rol global User.role
  const membership = await prisma.userRestaurantRole.create({
    data: {
      userId: user.id,
      restaurantId: restaurant.id,
      role: cleanRole,
      active: active !== false,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, role: true, active: true },
      },
    },
  });

  return { membership, user, restaurant };
}

async function updateStaffMembership(restaurantIdentifier, membershipId, { role, active }) {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: restaurantIdentifier }, { slug: restaurantIdentifier }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  const membership = await prisma.userRestaurantRole.findUnique({
    where: { id: membershipId },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, role: true, active: true },
      },
    },
  });

  if (!membership || membership.restaurantId !== restaurant.id) {
    throw httpError(404, "Membresía no encontrada en este restaurante.");
  }

  const patch = {};
  if (role !== undefined) {
    const cleanRole = String(role).toUpperCase();
    if (!["OWNER", "MANAGER", "KITCHEN"].includes(cleanRole)) {
      throw httpError(400, "Rol local no válido. Use: OWNER, MANAGER, KITCHEN.");
    }
    patch.role = cleanRole;
  }
  if (active !== undefined) {
    patch.active = Boolean(active);
  }

  if (Object.keys(patch).length === 0) {
    throw httpError(400, "Debe especificar 'role' y/o 'active' para actualizar la membresía.");
  }

  const updated = await prisma.userRestaurantRole.update({
    where: { id: membership.id },
    data: patch,
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, role: true, active: true },
      },
    },
  });

  return { membership: updated, restaurant };
}

// Compatibilidad con los endpoints previos /memberships
async function listMemberships(restaurantId) {
  const result = await listStaff(restaurantId);
  return { restaurant: result.restaurant, memberships: result.staff };
}

async function upsertMembership({ userId, restaurantId, role, active = true }) {
  const validRoles = ["OWNER", "MANAGER", "KITCHEN"];
  if (!validRoles.includes(role)) {
    throw httpError(400, `Rol local no válido. Use: ${validRoles.join(", ")}.`);
  }

  const [user, restaurant] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true } }),
  ]);
  if (!user) throw httpError(404, "Usuario no encontrado.");
  if (!restaurant) throw httpError(404, "Restaurante no encontrado.");

  const membership = await prisma.userRestaurantRole.upsert({
    where: { userId_restaurantId: { userId, restaurantId } },
    create: { userId, restaurantId, role, active },
    update: { role, active },
  });

  return { membership, user, restaurant };
}

async function revokeMembership(userId, restaurantId) {
  const membership = await prisma.userRestaurantRole.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  if (!membership) throw httpError(404, "Membresía no encontrada.");

  await prisma.userRestaurantRole.delete({
    where: { userId_restaurantId: { userId, restaurantId } },
  });

  return { message: "Membresía revocada correctamente." };
}

// ─── 4. Gestión Global de Usuarios ───────────────────────────────────────────

async function listUsers({ page = 1, limit = 20, search, role, active } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * take;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role && ["CLIENT", "ADMIN", "SUPERADMIN"].includes(role.toUpperCase())) {
    where.role = role.toUpperCase();
  }
  if (typeof active === "boolean") where.active = active;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            active: true,
            createdAt: true,
            restaurant: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: { select: { orders: true, memberships: true } },
      },
    }),
  ]);

  return {
    data: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      ordersCount: u._count.orders,
      membershipsCount: u._count.memberships,
    })),
    meta: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

async function getUserDetail(userIdentifier) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: userIdentifier }, { email: String(userIdentifier).toLowerCase() }],
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          id: true,
          role: true,
          active: true,
          createdAt: true,
          restaurant: {
            select: { id: true, name: true, slug: true, status: true, active: true },
          },
        },
      },
      orders: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          restaurant: { select: { id: true, name: true, slug: true } },
        },
      },
      _count: { select: { orders: true, memberships: true } },
    },
  });

  if (!user) throw httpError(404, "Usuario no encontrado.");

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    ordersCount: user._count.orders,
    membershipsCount: user._count.memberships,
  };
}

async function setUserRole(targetUserId, newRole, requesterId) {
  const validRoles = ["CLIENT", "ADMIN", "SUPERADMIN"];
  if (!validRoles.includes(newRole)) {
    throw httpError(400, `Rol no válido. Use: ${validRoles.join(", ")}.`);
  }
  if (targetUserId === requesterId) {
    throw httpError(400, "No puedes modificar tu propio rol.");
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw httpError(404, "Usuario no encontrado.");

  return prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
}

async function setUserActive(targetUserId, active, requesterId) {
  if (targetUserId === requesterId) {
    throw httpError(400, "No puedes suspender tu propia cuenta.");
  }
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw httpError(404, "Usuario no encontrado.");
  return prisma.user.update({
    where: { id: targetUserId },
    data: { active },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
}

// ─── 5. Consulta Global de Pedidos ───────────────────────────────────────────

async function listOrders({
  page = 1,
  limit = 20,
  restaurantId,
  status,
  startDate,
  endDate,
  search,
} = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const take = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * take;

  const where = {};

  // Filtro por restaurante (por ID o por Slug)
  if (restaurantId) {
    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ id: restaurantId }, { slug: restaurantId }],
      },
      select: { id: true },
    });
    if (restaurant) {
      where.restaurantId = restaurant.id;
    } else {
      // Si el restaurante solicitado no existe, retornar array vacío
      return {
        data: [],
        meta: { total: 0, page: pageNum, limit: take, totalPages: 1 },
      };
    }
  }

  // Filtro por estado
  if (status) {
    const validStatuses = [
      "RECEIVED",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "ON_THE_WAY",
      "DELIVERED",
      "CANCELLED",
    ];
    const upper = String(status).toUpperCase();
    if (validStatuses.includes(upper)) {
      where.status = upper;
    }
  }

  // Filtro por rango de fechas
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      const parsedStart = new Date(startDate);
      if (!isNaN(parsedStart.getTime())) {
        where.createdAt.gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = new Date(endDate);
      if (!isNaN(parsedEnd.getTime())) {
        where.createdAt.lte = parsedEnd;
      }
    }
  }

  // Búsqueda por número de orden o nombre/teléfono de cliente
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true },
        },
        items: {
          select: { id: true, name: true, quantity: true, unitPrice: true, subtotal: true },
        },
      },
    }),
  ]);

  return {
    data: orders.map(formatSuperAdminOrder),
    meta: {
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    },
  };
}

async function getOrderDetail(orderIdentifier) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderIdentifier }, { orderNumber: orderIdentifier }],
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          address: true,
          status: true,
        },
      },
      items: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!order) throw httpError(404, "Pedido no encontrado.");

  return formatSuperAdminOrder(order);
}

module.exports = {
  // Métricas y Dashboard
  getMetrics,
  getNetworkStats,

  // Restaurantes
  listRestaurants,
  createRestaurant,
  getRestaurantDetail,
  updateRestaurant,
  setRestaurantStatus,

  // Personal y Membresías
  listStaff,
  addStaff,
  updateStaffMembership,
  listMemberships,
  upsertMembership,
  revokeMembership,

  // Usuarios
  listUsers,
  getUserDetail,
  setUserRole,
  setUserActive,

  // Pedidos globales
  listOrders,
  getOrderDetail,
};
