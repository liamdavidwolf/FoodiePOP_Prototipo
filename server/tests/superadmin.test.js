/**
 * superadmin.test.js
 * Suite de integración para la API del SuperAdmin (Etapa 5C).
 * Convención del proyecto: servidor HTTP efímero + Prisma directo para setup.
 */
"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

// ─── Estado compartido ────────────────────────────────────────────────────────

let server;
let baseUrl;

let superadminUser;
let adminUser; // ADMIN con membresía OWNER
let clientUser;
let cookieSA = "";
let cookieAdmin = "";
let cookieClient = "";

let createdRestaurantId = "";
let foreignRestaurantId = "";
const createdUserIds = [];
const createdRestaurantIds = [];
const createdOrderIds = [];

// ─── Helper HTTP ──────────────────────────────────────────────────────────────

async function req(method, path, body, cookie = "") {
  const url = `${baseUrl}${path}`;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, headers: res.headers };
}

function extractCookie(headers) {
  const raw = headers.get("set-cookie") || "";
  const match = raw.match(/foodiepop_token=([^;]+)/);
  return match ? `foodiepop_token=${match[1]}` : "";
}

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  // Servidor efímero en puerto libre
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });

  const ts = Date.now();
  const hash = await bcrypt.hash("SApass2025!", 10);

  // 1. Crear SUPERADMIN directamente en BD
  superadminUser = await prisma.user.create({
    data: {
      name: "Super Admin Test",
      email: `superadmin-test-${ts}@foodiepop.test`,
      passwordHash: hash,
      role: "SUPERADMIN",
    },
  });
  createdUserIds.push(superadminUser.id);

  // 2. Crear ADMIN con membresía OWNER para probar denegación global
  adminUser = await prisma.user.create({
    data: {
      name: "Admin Owner Test",
      email: `admin-owner-test-${ts}@foodiepop.test`,
      passwordHash: hash,
      role: "ADMIN",
    },
  });
  createdUserIds.push(adminUser.id);

  // 3. Crear CLIENT de prueba
  clientUser = await prisma.user.create({
    data: {
      name: "Client SA Test",
      email: `client-sa-test-${ts}@foodiepop.test`,
      passwordHash: hash,
      phone: "3008887766",
    },
  });
  createdUserIds.push(clientUser.id);

  // Login SuperAdmin
  const loginSARes = await req("POST", "/auth/login", {
    email: superadminUser.email,
    password: "SApass2025!",
  });
  assert.equal(loginSARes.status, 200);
  cookieSA = extractCookie(loginSARes.headers);

  // Login Admin
  const loginAdminRes = await req("POST", "/auth/login", {
    email: adminUser.email,
    password: "SApass2025!",
  });
  assert.equal(loginAdminRes.status, 200);
  cookieAdmin = extractCookie(loginAdminRes.headers);

  // Login Client
  const loginClientRes = await req("POST", "/auth/login", {
    email: clientUser.email,
    password: "SApass2025!",
  });
  assert.equal(loginClientRes.status, 200);
  cookieClient = extractCookie(loginClientRes.headers);
});

after(async () => {
  // Limpiar pedidos creados
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch { /* ignorar */ }
  }

  // Limpiar restaurantes creados
  for (const id of createdRestaurantIds) {
    try {
      await prisma.productOption.deleteMany({ where: { product: { restaurantId: id } } });
      await prisma.product.deleteMany({ where: { restaurantId: id } });
      await prisma.category.deleteMany({ where: { restaurantId: id } });
      await prisma.userRestaurantRole.deleteMany({ where: { restaurantId: id } });
      await prisma.restaurant.delete({ where: { id } });
    } catch { /* ignorar */ }
  }

  // Limpiar usuarios de prueba
  if (createdUserIds.length) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch { /* ignorar */ }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

// ─── Tests: Dashboard y Métricas Globales (Etapa 5C) ─────────────────────────

describe("GET /superadmin/metrics", () => {
  it("retorna métricas globales con zona horaria America/Bogota y período por defecto (30 días)", async () => {
    const { status, json } = await req("GET", "/superadmin/metrics", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(json.data, "Debe contener data");
    assert.equal(json.data.timezone, "America/Bogota");
    assert.equal(json.data.periodDays, 30);
    assert.ok(typeof json.data.totalRestaurants === "number");
    assert.ok(typeof json.data.activeRestaurants === "number");
    assert.ok(typeof json.data.closedOrPausedRestaurants === "number");
    assert.ok(json.data.restaurantsByStatus);
    assert.ok(typeof json.data.totalUsers === "number");
    assert.ok(typeof json.data.totalOrders === "number");
    assert.ok(typeof json.data.todayOrders === "number");
    assert.ok(typeof json.data.todaySales === "number");
    assert.ok(typeof json.data.periodSales === "number");
    assert.ok(typeof json.data.averageTicket === "number");
    assert.ok(Array.isArray(json.data.dailyEvolution));
    assert.equal(json.data.dailyEvolution.length, 30);
    assert.ok(Array.isArray(json.data.topProducts));
    assert.ok(Array.isArray(json.data.topRestaurants));
  });

  it("acepta filtro de período a 7 días y ajusta dailyEvolution", async () => {
    const { status, json } = await req("GET", "/superadmin/metrics?period=7", undefined, cookieSA);
    assert.equal(status, 200);
    assert.equal(json.data.periodDays, 7);
    assert.equal(json.data.dailyEvolution.length, 7);
    for (const day of json.data.dailyEvolution) {
      assert.ok(day.date);
      assert.ok(typeof day.sales === "number");
      assert.ok(typeof day.orders === "number");
    }
  });

  it("excluye pedidos CANCELLED de las ventas totales y de hoy", async () => {
    // 1. Obtener métricas previas
    const prev = (await req("GET", "/superadmin/metrics?period=7", undefined, cookieSA)).json.data;

    // 2. Crear un restaurante y un pedido CANCELLED con monto alto
    const rest = await prisma.restaurant.create({
      data: {
        slug: `metric-test-${Date.now()}`,
        name: "Restaurante Metric Cancel Test",
      },
    });
    createdRestaurantIds.push(rest.id);

    const cat = await prisma.category.create({
      data: { restaurantId: rest.id, name: "Cat Cancel" },
    });
    const prod = await prisma.product.create({
      data: {
        restaurantId: rest.id,
        categoryId: cat.id,
        name: "Prod Cancel",
        price: 50000,
      },
    });

    const cancelledOrder = await prisma.order.create({
      data: {
        orderNumber: `FP-MET-CAN-${Date.now()}`,
        userId: clientUser.id,
        restaurantId: rest.id,
        status: "CANCELLED",
        orderType: "PICKUP",
        customerName: "Cliente Cancel",
        customerPhone: "3000000000",
        subtotal: 50000,
        total: 50000,
        items: {
          create: {
            productId: prod.id,
            name: prod.name,
            unitPrice: 50000,
            quantity: 1,
            subtotal: 50000,
          },
        },
      },
    });
    createdOrderIds.push(cancelledOrder.id);

    // 3. Consultar métricas de nuevo
    const next = (await req("GET", "/superadmin/metrics?period=7", undefined, cookieSA)).json.data;

    // El total de pedidos se incrementa pero las ventas no incluyen el monto cancelado
    assert.equal(next.todaySales, prev.todaySales, "todaySales no debe incluir pedidos cancelados");
    assert.equal(next.periodSales, prev.periodSales, "periodSales no debe incluir pedidos cancelados");
  });

  it("rechaza acceso sin autenticación — 401", async () => {
    const { status } = await req("GET", "/superadmin/metrics");
    assert.equal(status, 401);
  });

  it("rechaza acceso de CLIENT — 403", async () => {
    const { status } = await req("GET", "/superadmin/metrics", undefined, cookieClient);
    assert.equal(status, 403);
  });

  it("rechaza acceso de ADMIN (incluso con membresía OWNER) — 403", async () => {
    const { status } = await req("GET", "/superadmin/metrics", undefined, cookieAdmin);
    assert.equal(status, 403, "ADMIN no debe acceder al dashboard global de SuperAdmin");
  });
});

describe("GET /superadmin/stats (compatibilidad)", () => {
  it("retorna estructura compatible para clientes previos", async () => {
    const { status, json } = await req("GET", "/superadmin/stats", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(json.data.restaurants);
    assert.ok(json.data.users);
    assert.ok(json.data.orders);
    assert.ok(json.data.revenue);
  });
});

// ─── Tests: Restaurantes ──────────────────────────────────────────────────────

describe("Gestión de Restaurantes", () => {
  it("POST: crea un nuevo restaurante con datos válidos", async () => {
    const slug = `test-sa-rest-${Date.now()}`;
    const { status, json } = await req("POST", "/superadmin/restaurants", {
      slug,
      name: "Restaurante SuperAdmin Test",
      description: "Creado en pruebas automatizadas",
      deliveryFee: 2500,
    }, cookieSA);
    assert.equal(status, 201, `Error al crear restaurante: ${JSON.stringify(json)}`);
    assert.ok(json.data.id);
    assert.equal(json.data.slug, slug);
    createdRestaurantId = json.data.id;
    createdRestaurantIds.push(createdRestaurantId);
  });

  it("POST: rechaza slug duplicado — 409", async () => {
    const { status } = await req("POST", "/superadmin/restaurants", {
      slug: "la-esquina-food",
      name: "Duplicado",
    }, cookieSA);
    assert.equal(status, 409);
  });

  it("GET: lista restaurantes incluyendo conteos y volumen de ventas totalSales", async () => {
    const { status, json } = await req("GET", "/superadmin/restaurants", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.meta && typeof json.meta.total === "number");
    const r = json.data.find((item) => item.id === createdRestaurantId);
    assert.ok(r);
    assert.ok(typeof r.productsCount === "number");
    assert.ok(typeof r.ordersCount === "number");
    assert.ok(typeof r.membersCount === "number");
    assert.ok(typeof r.totalSales === "number");
  });

  it("GET /:id: detalle completo con staff y ventas totales", async () => {
    assert.ok(createdRestaurantId);
    const { status, json } = await req("GET", `/superadmin/restaurants/${createdRestaurantId}`, undefined, cookieSA);
    assert.equal(status, 200);
    assert.equal(json.data.id, createdRestaurantId);
    assert.ok(Array.isArray(json.data.staff));
    assert.ok(typeof json.data.totalSales === "number");
    assert.ok(typeof json.data.productsCount === "number");
  });

  it("PATCH /:id: actualiza información y estado del restaurante", async () => {
    const { status, json } = await req("PATCH", `/superadmin/restaurants/${createdRestaurantId}`, {
      name: "Restaurante SA Modificado",
      status: "PAUSED",
      active: true,
    }, cookieSA);
    assert.equal(status, 200);
    assert.equal(json.data.name, "Restaurante SA Modificado");
    assert.equal(json.data.status, "PAUSED");
  });
});

// ─── Tests: Personal y Membresías (Etapa 5C) ──────────────────────────────────

describe("Gestión de Personal y Membresías (Rutas /staff)", () => {
  let createdStaffMembershipId = "";

  it("GET /restaurants/:id/staff: lista personal asignado", async () => {
    assert.ok(createdRestaurantId);
    const { status, json } = await req(
      "GET", `/superadmin/restaurants/${createdRestaurantId}/staff`,
      undefined, cookieSA
    );
    assert.equal(status, 200);
    assert.ok(json.data.restaurant);
    assert.ok(Array.isArray(json.data.staff));
  });

  it("POST /restaurants/:id/staff: asigna un usuario existente con rol MANAGER", async () => {
    assert.ok(createdRestaurantId && clientUser?.id);
    const { status, json } = await req(
      "POST", `/superadmin/restaurants/${createdRestaurantId}/staff`,
      { userId: clientUser.id, role: "MANAGER" }, cookieSA
    );
    assert.equal(status, 201);
    assert.equal(json.data.membership.role, "MANAGER");
    assert.equal(json.data.membership.userId, clientUser.id);
    createdStaffMembershipId = json.data.membership.id;

    // Verificar que el rol global del usuario CLIENT no se alteró
    const dbUser = await prisma.user.findUnique({ where: { id: clientUser.id } });
    assert.equal(dbUser.role, "CLIENT", "El rol global no debe ser alterado por una membresía");
  });

  it("POST /restaurants/:id/staff: evita membresías duplicadas para el mismo usuario — 409", async () => {
    const { status } = await req(
      "POST", `/superadmin/restaurants/${createdRestaurantId}/staff`,
      { userId: clientUser.id, role: "OWNER" }, cookieSA
    );
    assert.equal(status, 409);
  });

  it("POST /restaurants/:id/staff: rechaza rol local inválido — 400", async () => {
    const { status } = await req(
      "POST", `/superadmin/restaurants/${createdRestaurantId}/staff`,
      { userId: adminUser.id, role: "SUPERADMIN" }, cookieSA
    );
    assert.equal(status, 400);
  });

  it("PATCH /restaurants/:id/staff/:membershipId: modifica rol local a KITCHEN y estado activo", async () => {
    assert.ok(createdStaffMembershipId);
    const { status, json } = await req(
      "PATCH", `/superadmin/restaurants/${createdRestaurantId}/staff/${createdStaffMembershipId}`,
      { role: "KITCHEN", active: false }, cookieSA
    );
    assert.equal(status, 200);
    assert.equal(json.data.membership.role, "KITCHEN");
    assert.equal(json.data.membership.active, false);
  });

  it("PATCH /restaurants/:id/staff/:membershipId: reactiva la membresía (active: true)", async () => {
    const { status, json } = await req(
      "PATCH", `/superadmin/restaurants/${createdRestaurantId}/staff/${createdStaffMembershipId}`,
      { active: true }, cookieSA
    );
    assert.equal(status, 200);
    assert.equal(json.data.membership.active, true);
  });

  it("PATCH /restaurants/:id/staff/:membershipId: retorna 404 para ID de membresía inexistente", async () => {
    const { status } = await req(
      "PATCH", `/superadmin/restaurants/${createdRestaurantId}/staff/fake-membership-id-999`,
      { role: "MANAGER" }, cookieSA
    );
    assert.equal(status, 404);
  });
});

// ─── Tests: Usuarios (Etapa 5C) ───────────────────────────────────────────────

describe("Gestión Global de Usuarios", () => {
  it("GET /superadmin/users: lista usuarios con membresías sin exponer passwordHash", async () => {
    const { status, json } = await req("GET", "/superadmin/users", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.meta && typeof json.meta.total === "number");
    for (const u of json.data) {
      assert.equal(u.passwordHash, undefined, "No debe exponer passwordHash");
      assert.ok(Array.isArray(u.memberships));
    }
  });

  it("GET /superadmin/users/:userId: detalle de usuario con membresías y pedidos", async () => {
    assert.ok(clientUser?.id);
    const { status, json } = await req("GET", `/superadmin/users/${clientUser.id}`, undefined, cookieSA);
    assert.equal(status, 200);
    assert.equal(json.data.id, clientUser.id);
    assert.equal(json.data.email, clientUser.email);
    assert.equal(json.data.passwordHash, undefined);
    assert.ok(Array.isArray(json.data.memberships));
    assert.ok(typeof json.data.ordersCount === "number");
  });

  it("GET /superadmin/users/:userId: retorna 404 para usuario inexistente", async () => {
    const { status } = await req("GET", "/superadmin/users/non-existent-user-cuid", undefined, cookieSA);
    assert.equal(status, 404);
  });
});

// ─── Tests: Consulta Global de Pedidos (Etapa 5C) ─────────────────────────────

describe("Consulta Global de Pedidos (/orders)", () => {
  let testOrderId = "";

  before(async () => {
    // Crear un restaurante y pedido dedicado para la consulta de pedidos
    const rest = await prisma.restaurant.create({
      data: {
        slug: `order-sa-rest-${Date.now()}`,
        name: "Restaurante Consulta Pedidos SA",
      },
    });
    createdRestaurantIds.push(rest.id);

    const cat = await prisma.category.create({
      data: { restaurantId: rest.id, name: "Cat SA Orders" },
    });
    const prod = await prisma.product.create({
      data: {
        restaurantId: rest.id,
        categoryId: cat.id,
        name: "Prod SA Order",
        price: 18000,
      },
    });

    const o = await prisma.order.create({
      data: {
        orderNumber: `FP-SA-ORD-${Date.now()}`,
        userId: clientUser.id,
        restaurantId: rest.id,
        status: "PREPARING",
        orderType: "DELIVERY",
        customerName: "Cliente Global Order",
        customerPhone: "3007776655",
        deliveryAddress: "Carrera 7 # 72-10",
        deliveryRef: "Oficina 402",
        subtotal: 18000,
        deliveryFee: 4000,
        total: 22000,
        items: {
          create: {
            productId: prod.id,
            name: prod.name,
            unitPrice: 18000,
            quantity: 1,
            subtotal: 18000,
          },
        },
      },
    });
    testOrderId = o.id;
    createdOrderIds.push(o.id);
  });

  it("GET /superadmin/orders: lista pedidos de todos los restaurantes con paginación", async () => {
    const { status, json } = await req("GET", "/superadmin/orders", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.meta && typeof json.meta.total === "number");
    const found = json.data.find((o) => o.id === testOrderId);
    assert.ok(found, "Debe incluir el pedido creado");
    assert.ok(found.restaurant);
    assert.equal(found.customerName, "Cliente Global Order");
  });

  it("GET /superadmin/orders?status=PREPARING: filtra por estado", async () => {
    const { status, json } = await req("GET", "/superadmin/orders?status=PREPARING", undefined, cookieSA);
    assert.equal(status, 200);
    assert.ok(json.data.every((o) => o.status === "PREPARING"));
  });

  it("GET /superadmin/orders?search=Cliente%20Global: busca por texto en cliente o número de orden", async () => {
    const { status, json } = await req(
      "GET", `/superadmin/orders?search=${encodeURIComponent("Cliente Global")}`,
      undefined, cookieSA
    );
    assert.equal(status, 200);
    assert.ok(json.data.length >= 1);
  });

  it("GET /superadmin/orders/:orderId: consulta detalle de solo lectura de un pedido", async () => {
    assert.ok(testOrderId);
    const { status, json } = await req("GET", `/superadmin/orders/${testOrderId}`, undefined, cookieSA);
    assert.equal(status, 200);
    assert.equal(json.data.id, testOrderId);
    assert.ok(json.data.restaurant);
    assert.ok(Array.isArray(json.data.items));
    assert.equal(json.data.items.length, 1);
    assert.equal(json.data.deliveryAddress, "Carrera 7 # 72-10");
  });

  it("GET /superadmin/orders/:orderId: retorna 404 para pedido inexistente", async () => {
    const { status } = await req("GET", "/superadmin/orders/fake-order-id-404", undefined, cookieSA);
    assert.equal(status, 404);
  });

  it("rechaza acceso de ADMIN con membresía a /superadmin/orders — 403", async () => {
    const { status } = await req("GET", "/superadmin/orders", undefined, cookieAdmin);
    assert.equal(status, 403);
  });
});
