/**
 * memberships.test.js
 * FoodiePOP — Suite de Pruebas: Membresías y Arquitectura Multi-Restaurante (Etapa 5B)
 *
 * Cobertura obligatoria:
 * 1. Creación idempotente de membresías (upsert sin duplicación).
 * 2. Administrador con membresía activa (acceso concedido 200).
 * 3. Administrador sin membresía (rechazado con 403 Forbidden).
 * 4. Membresía inactiva (active: false, rechazado con 403 Forbidden).
 * 5. Usuario asignado a dos restaurantes (accede a ambos, denegado en un 3ro).
 * 6. Rol local KITCHEN: permitido en listado de pedidos y actualización de estado, pero bloqueado (403) en métricas financieras y catálogo admin.
 * 7. Aislamiento de pedidos entre restaurantes (Admin A no puede ver ni mutar pedidos de Restaurante B).
 * 8. Aislamiento de productos y métricas entre restaurantes.
 * 9. Acceso global de SUPERADMIN a cualquier restaurante sin membresía previa.
 * 10. Protección de rutas ante solicitudes manipuladas (slugs o IDs ajenos).
 * 11. Preservación del checkout, historial de pedidos y opciones de producto.
 */
"use strict";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");
const { checkCounterTableAvailable } = require("../src/services/order.service");

let server;
let baseUrl;

// Fase 7A: indica si la tabla de contadores está disponible en Neon
let counterTableReady = false;

// Restaurantes de prueba
let restA;
let restB;
let restC;

// Productos de prueba
let prodA;
let prodB;
let prodC;

// Usuarios y cookies
let superadminUser;
let cookieSA = "";

let adminRestA;
let cookieAdminA = "";

let adminRestB;
let cookieAdminB = "";

let adminNoMembership;
let cookieAdminNoMem = "";

let adminMultiRest; // Asignado a restA y restB
let cookieAdminMulti = "";

let kitchenUserA; // Rol KITCHEN en restA
let cookieKitchenA = "";

let clientUser;
let cookieClient = "";

// Órdenes de prueba
let orderA;
let orderB;

const createdUserIds = [];
const createdRestaurantIds = [];
const createdOrderIds = [];

function extractCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  const match = raw.match(/foodiepop_token=([^;]+)/);
  return match ? `foodiepop_token=${match[1]}` : "";
}

async function loginUser(email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `Login falló para ${email}`);
  return extractCookie(res);
}

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });

  counterTableReady = await checkCounterTableAvailable();
  if (!counterTableReady) {
    console.warn(
      "\n[memberships.test.js] AVISO: La tabla restaurant_order_counters no existe en Neon.\n" +
      "El test de checkout (11) se omitirá hasta que la migración de Fase 7A sea aplicada.\n"
    );
  }

  const ts = Date.now();
  const password = "TestPass2026!";
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Crear 3 restaurantes aislados para la suite
  restA = await prisma.restaurant.create({
    data: {
      slug: `m-rest-a-${ts}`,
      name: `Restaurante A ${ts}`,
      deliveryFee: 3000,
      status: "OPEN",
    },
  });
  createdRestaurantIds.push(restA.id);

  restB = await prisma.restaurant.create({
    data: {
      slug: `m-rest-b-${ts}`,
      name: `Restaurante B ${ts}`,
      deliveryFee: 4000,
      status: "OPEN",
    },
  });
  createdRestaurantIds.push(restB.id);

  restC = await prisma.restaurant.create({
    data: {
      slug: `m-rest-c-${ts}`,
      name: `Restaurante C ${ts}`,
      deliveryFee: 5000,
      status: "OPEN",
    },
  });
  createdRestaurantIds.push(restC.id);

  // Categorías y Productos para cada restaurante
  const catA = await prisma.category.create({
    data: { restaurantId: restA.id, name: "Cat A" },
  });
  prodA = await prisma.product.create({
    data: {
      restaurantId: restA.id,
      categoryId: catA.id,
      name: `Prod A ${ts}`,
      price: 20000,
      cost: 8000,
      available: true,
      options: {
        create: [{ name: "Queso A", price: 2500, cost: 500 }],
      },
    },
    include: { options: true },
  });

  const catB = await prisma.category.create({
    data: { restaurantId: restB.id, name: "Cat B" },
  });
  prodB = await prisma.product.create({
    data: {
      restaurantId: restB.id,
      categoryId: catB.id,
      name: `Prod B ${ts}`,
      price: 25000,
      cost: 10000,
      available: true,
    },
  });

  const catC = await prisma.category.create({
    data: { restaurantId: restC.id, name: "Cat C" },
  });
  prodC = await prisma.product.create({
    data: {
      restaurantId: restC.id,
      categoryId: catC.id,
      name: `Prod C ${ts}`,
      price: 30000,
      cost: 12000,
      available: true,
    },
  });

  // 2. Crear SuperAdmin
  superadminUser = await prisma.user.create({
    data: {
      name: "SuperAdmin Tester",
      email: `sa_m_${ts}@foodiepop.test`,
      passwordHash,
      role: "SUPERADMIN",
    },
  });
  createdUserIds.push(superadminUser.id);
  cookieSA = await loginUser(superadminUser.email, password);

  // 3. Crear Admin Restaurante A (con membresía OWNER en restA)
  adminRestA = await prisma.user.create({
    data: {
      name: "Admin Rest A",
      email: `admin_a_${ts}@foodiepop.test`,
      passwordHash,
      role: "ADMIN",
    },
  });
  createdUserIds.push(adminRestA.id);
  await prisma.userRestaurantRole.create({
    data: {
      userId: adminRestA.id,
      restaurantId: restA.id,
      role: "OWNER",
      active: true,
    },
  });
  cookieAdminA = await loginUser(adminRestA.email, password);

  // 4. Crear Admin Restaurante B (con membresía MANAGER en restB)
  adminRestB = await prisma.user.create({
    data: {
      name: "Admin Rest B",
      email: `admin_b_${ts}@foodiepop.test`,
      passwordHash,
      role: "ADMIN",
    },
  });
  createdUserIds.push(adminRestB.id);
  await prisma.userRestaurantRole.create({
    data: {
      userId: adminRestB.id,
      restaurantId: restB.id,
      role: "MANAGER",
      active: true,
    },
  });
  cookieAdminB = await loginUser(adminRestB.email, password);

  // 5. Crear Admin Sin Membresía alguna
  adminNoMembership = await prisma.user.create({
    data: {
      name: "Admin Sin Membresia",
      email: `admin_nomem_${ts}@foodiepop.test`,
      passwordHash,
      role: "ADMIN",
    },
  });
  createdUserIds.push(adminNoMembership.id);
  cookieAdminNoMem = await loginUser(adminNoMembership.email, password);

  // 6. Crear Admin Multi-Restaurante (asignado a restA y restB, pero no a restC)
  adminMultiRest = await prisma.user.create({
    data: {
      name: "Admin Multi",
      email: `admin_multi_${ts}@foodiepop.test`,
      passwordHash,
      role: "ADMIN",
    },
  });
  createdUserIds.push(adminMultiRest.id);
  await prisma.userRestaurantRole.createMany({
    data: [
      { userId: adminMultiRest.id, restaurantId: restA.id, role: "MANAGER", active: true },
      { userId: adminMultiRest.id, restaurantId: restB.id, role: "OWNER", active: true },
    ],
  });
  cookieAdminMulti = await loginUser(adminMultiRest.email, password);

  // 7. Crear Personal de Cocina KITCHEN en restA
  kitchenUserA = await prisma.user.create({
    data: {
      name: "Cocinero Rest A",
      email: `kitchen_a_${ts}@foodiepop.test`,
      passwordHash,
      role: "ADMIN", // Rol global administrativo con rol operativo KITCHEN
    },
  });
  createdUserIds.push(kitchenUserA.id);
  await prisma.userRestaurantRole.create({
    data: {
      userId: kitchenUserA.id,
      restaurantId: restA.id,
      role: "KITCHEN",
      active: true,
    },
  });
  cookieKitchenA = await loginUser(kitchenUserA.email, password);

  // 8. Crear Cliente
  clientUser = await prisma.user.create({
    data: {
      name: "Cliente Común",
      email: `client_m_${ts}@foodiepop.test`,
      passwordHash,
      role: "CLIENT",
      phone: "3001234567",
    },
  });
  createdUserIds.push(clientUser.id);
  cookieClient = await loginUser(clientUser.email, password);

  // 9. Crear Pedidos en Rest A y Rest B
  orderA = await prisma.order.create({
    data: {
      orderNumber: `FP-MA-${ts}`,
      userId: clientUser.id,
      restaurantId: restA.id,
      status: "RECEIVED",
      orderType: "PICKUP",
      customerName: "Cliente A",
      customerPhone: "3001234567",
      subtotal: 20000,
      total: 20000,
      items: {
        create: {
          productId: prodA.id,
          name: prodA.name,
          unitPrice: prodA.price,
          quantity: 1,
          subtotal: 20000,
        },
      },
    },
  });
  createdOrderIds.push(orderA.id);

  orderB = await prisma.order.create({
    data: {
      orderNumber: `FP-MB-${ts}`,
      userId: clientUser.id,
      restaurantId: restB.id,
      status: "CONFIRMED",
      orderType: "PICKUP",
      customerName: "Cliente B",
      customerPhone: "3001234567",
      subtotal: 25000,
      total: 25000,
      items: {
        create: {
          productId: prodB.id,
          name: prodB.name,
          unitPrice: prodB.price,
          quantity: 1,
          subtotal: 25000,
        },
      },
    },
  });
  createdOrderIds.push(orderB.id);
});

after(async () => {
  // Limpieza de pedidos
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Limpieza de pedidos:", e.message);
    }
  }

  // Limpieza de restaurantes
  for (const id of createdRestaurantIds) {
    try {
      await prisma.productOption.deleteMany({ where: { product: { restaurantId: id } } });
      await prisma.product.deleteMany({ where: { restaurantId: id } });
      await prisma.category.deleteMany({ where: { restaurantId: id } });
      await prisma.userRestaurantRole.deleteMany({ where: { restaurantId: id } });
      await prisma.restaurant.delete({ where: { id } });
    } catch (e) {
      console.warn("Limpieza de restaurantes:", e.message);
    }
  }

  // Limpieza de usuarios
  if (createdUserIds.length > 0) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (e) {
      console.warn("Limpieza de usuarios:", e.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Suite de Pruebas: Membresías y Arquitectura Multi-Restaurante (Etapa 5B)", () => {
  // 1. Idempotencia de membresías
  test("1. Creación idempotente de membresías (upsert repetido no genera duplicados)", async () => {
    // Upsert 1
    const m1 = await prisma.userRestaurantRole.upsert({
      where: {
        userId_restaurantId: { userId: adminRestA.id, restaurantId: restA.id },
      },
      update: { role: "OWNER", active: true },
      create: { userId: adminRestA.id, restaurantId: restA.id, role: "OWNER", active: true },
    });
    assert.equal(m1.role, "OWNER");

    // Upsert 2
    const m2 = await prisma.userRestaurantRole.upsert({
      where: {
        userId_restaurantId: { userId: adminRestA.id, restaurantId: restA.id },
      },
      update: { role: "OWNER", active: true },
      create: { userId: adminRestA.id, restaurantId: restA.id, role: "OWNER", active: true },
    });
    assert.equal(m1.id, m2.id, "El ID de la membresía debe ser exactamente el mismo");

    const count = await prisma.userRestaurantRole.count({
      where: { userId: adminRestA.id, restaurantId: restA.id },
    });
    assert.equal(count, 1, "Solo debe existir un registro de membresía por (userId, restaurantId)");
  });

  // 2. Administrador con membresía activa
  test("2. Admin con membresía activa en Rest A accede a sus pedidos y métricas (200 OK)", async () => {
    // Pedidos
    const resOrders = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.id}`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resOrders.status, 200);
    const jsonOrders = await resOrders.json();
    assert.ok(Array.isArray(jsonOrders.data));

    // Métricas
    const resMetrics = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.slug}/metrics`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resMetrics.status, 200);
    const jsonMetrics = await resMetrics.json();
    assert.ok(jsonMetrics.data);

    // Catálogo admin
    const resCatalog = await fetch(`${baseUrl}/menu/restaurant/${restA.slug}/admin-products`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resCatalog.status, 200);
  });

  // 3. Administrador sin membresía
  test("3. Admin sin membresía es rechazado con 403 al intentar acceder a cualquier restaurante", async () => {
    // Intento en Rest A
    const resA = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.id}`, {
      headers: { Cookie: cookieAdminNoMem },
    });
    assert.equal(resA.status, 403);
    const jsonA = await resA.json();
    assert.ok(jsonA.error.includes("membresía activa") || jsonA.error.includes("permisos"));

    // Intento en Rest B
    const resB = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.slug}/metrics`, {
      headers: { Cookie: cookieAdminNoMem },
    });
    assert.equal(resB.status, 403);

    // Intento de catálogo admin en Rest A
    const resCat = await fetch(`${baseUrl}/menu/restaurant/${restA.slug}/admin-products`, {
      headers: { Cookie: cookieAdminNoMem },
    });
    assert.equal(resCat.status, 403);
  });

  // 4. Membresía inactiva
  test("4. Admin con membresía suspendida (active: false) es rechazado con 403", async () => {
    // Desactivar temporalmente la membresía de adminRestB
    await prisma.userRestaurantRole.update({
      where: {
        userId_restaurantId: { userId: adminRestB.id, restaurantId: restB.id },
      },
      data: { active: false },
    });

    try {
      const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.id}`, {
        headers: { Cookie: cookieAdminB },
      });
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.ok(json.error.includes("membresía activa"));
    } finally {
      // Restaurar membresía activa
      await prisma.userRestaurantRole.update({
        where: {
          userId_restaurantId: { userId: adminRestB.id, restaurantId: restB.id },
        },
        data: { active: true },
      });
    }
  });

  // 5. Usuario asignado a dos restaurantes
  test("5. Usuario asignado a dos restaurantes accede a Rest A y Rest B, pero no a Rest C", async () => {
    // Acceso a Rest A concedido (200)
    const resA = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.slug}`, {
      headers: { Cookie: cookieAdminMulti },
    });
    assert.equal(resA.status, 200);

    // Acceso a Rest B concedido (200)
    const resB = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.slug}`, {
      headers: { Cookie: cookieAdminMulti },
    });
    assert.equal(resB.status, 200);

    // Acceso a Rest C rechazado (403)
    const resC = await fetch(`${baseUrl}/orders/admin/restaurant/${restC.slug}`, {
      headers: { Cookie: cookieAdminMulti },
    });
    assert.equal(resC.status, 403);
  });

  // 6. Rol local KITCHEN (operaciones permitidas vs bloqueadas)
  test("6. Rol KITCHEN puede ver pedidos de cocina pero es rechazado (403) en métricas financieras y catálogo de costos", async () => {
    // 6.1 Listado de pedidos: PERMITIDO (200)
    const resOrders = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.id}`, {
      headers: { Cookie: cookieKitchenA },
    });
    assert.equal(resOrders.status, 200, "Cocina debe poder ver pedidos de su restaurante");

    // 6.2 Actualizar estado de pedido: PERMITIDO (200)
    const resUpdate = await fetch(`${baseUrl}/orders/${orderA.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieKitchenA,
      },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    assert.equal(resUpdate.status, 200, "Cocina debe poder actualizar estados de pedido permitidos");

    // 6.3 Métricas financieras: DENEGADO (403)
    const resMetrics = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.id}/metrics`, {
      headers: { Cookie: cookieKitchenA },
    });
    assert.equal(resMetrics.status, 403, "Cocina no debe tener acceso a métricas financieras");
    const jsonMetrics = await resMetrics.json();
    assert.ok(jsonMetrics.error.includes("rol operativo") || jsonMetrics.error.includes("KITCHEN"));

    // 6.4 Catálogo administrativo con costos: DENEGADO (403)
    const resCat = await fetch(`${baseUrl}/menu/restaurant/${restA.slug}/admin-products`, {
      headers: { Cookie: cookieKitchenA },
    });
    assert.equal(resCat.status, 403, "Cocina no debe tener acceso a catálogo privado con costos");
  });

  // 7. Aislamiento de pedidos entre restaurantes
  test("7. Aislamiento estricto: Admin A no puede leer ni modificar pedidos de Restaurante B (403)", async () => {
    // Lectura de pedidos de Rest B
    const resList = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.id}`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resList.status, 403, "Admin A no debe listar pedidos de Rest B");

    // Lectura por ID de pedido de Rest B
    const resSingle = await fetch(`${baseUrl}/orders/${orderB.id}`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resSingle.status, 403, "Admin A no debe consultar pedido de Rest B");

    // Mutación de estado en pedido de Rest B
    const resStatus = await fetch(`${baseUrl}/orders/${orderB.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({ status: "PREPARING" }),
    });
    assert.equal(resStatus.status, 403, "Admin A no debe mutar estado de pedido de Rest B");
  });

  // 8. Aislamiento de productos y métricas
  test("8. Aislamiento estricto: Admin A no puede modificar disponibilidad ni ver métricas de Rest B (403)", async () => {
    // Métricas de Rest B
    const resMetrics = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.slug}/metrics`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resMetrics.status, 403);

    // Catálogo de Rest B
    const resCat = await fetch(`${baseUrl}/menu/restaurant/${restB.slug}/admin-products`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resCat.status, 403);

    // Mutación de disponibilidad de producto en Rest B
    const resToggle = await fetch(`${baseUrl}/menu/products/${prodB.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({ available: false }),
    });
    assert.equal(resToggle.status, 403, "Admin A no debe mutar productos de Rest B");
  });

  // 9. Acceso global de SUPERADMIN
  test("9. SUPERADMIN accede a métricas, pedidos y productos de cualquier restaurante sin requerir membresía", async () => {
    // Pedidos de Rest A y Rest B
    const resOrdersA = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.id}`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resOrdersA.status, 200);

    const resOrdersB = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.id}`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resOrdersB.status, 200);

    // Métricas de Rest A y Rest B
    const resMetricsA = await fetch(`${baseUrl}/orders/admin/restaurant/${restA.slug}/metrics`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resMetricsA.status, 200);

    const resMetricsB = await fetch(`${baseUrl}/orders/admin/restaurant/${restB.slug}/metrics`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resMetricsB.status, 200);

    // Catálogo admin de Rest A
    const resCatA = await fetch(`${baseUrl}/menu/restaurant/${restA.slug}/admin-products`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resCatA.status, 200);

    // Consulta de cualquier pedido por ID
    const resOrderB = await fetch(`${baseUrl}/orders/${orderB.id}`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resOrderB.status, 200);
  });

  // 10. Protección de rutas ante solicitudes manipuladas
  test("10. Solicitud con restaurante inexistente o ID falso es rechazada con 403 / 404 seguro", async () => {
    // Admin con slug inexistente
    const resFake = await fetch(`${baseUrl}/orders/admin/restaurant/non-existent-fake-slug`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.equal(resFake.status, 403);

    // SuperAdmin con slug inexistente responde 404
    const resFakeSA = await fetch(`${baseUrl}/orders/admin/restaurant/non-existent-fake-slug`, {
      headers: { Cookie: cookieSA },
    });
    assert.equal(resFakeSA.status, 404);
  });

  // 11. Conservación de checkout, historial y adicionales
  test("11. Checkout multi-restaurante crea pedido en Rest A con adicionales sin sustituto silencioso", async () => {
    const ts = Date.now();
    const cheeseOpt = prodA.options[0];

    // 11.1 Intentar crear pedido SIN restaurantSlug ni restaurantId -> 400 Bad Request
    const resFail = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        items: [{ productId: prodA.id, quantity: 1 }],
      }),
    });
    assert.equal(resFail.status, 400, "Debe rechazar la creación si falta el restaurante solicitado");

    // 11.2 Crear pedido explícito en Rest A con adicional
    const resCreate = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Checkout", phone: "3009998877" },
        items: [
          {
            productId: prodA.id,
            quantity: 2,
            selectedOptions: cheeseOpt ? [{ id: cheeseOpt.id }] : [],
          },
        ],
      }),
    });
    assert.equal(resCreate.status, 201);
    const jsonCreate = await resCreate.json();
    const created = jsonCreate.data.order;
    createdOrderIds.push(created.orderId);

    // Precio: (20000 + 2500) * 2 = 45000
    assert.equal(created.subtotal, 45000);
    assert.equal(created.restaurantId, restA.id);

    // 11.3 Historial del cliente incluye el nuevo pedido
    const resHistory = await fetch(`${baseUrl}/orders`, {
      headers: { Cookie: cookieClient },
    });
    assert.equal(resHistory.status, 200);
    const jsonHistory = await resHistory.json();
    const found = jsonHistory.data.find((o) => o.orderId === created.orderId);
    assert.ok(found, "El pedido creado debe estar en el historial del cliente");
  });
});

