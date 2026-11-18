const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

let server;
let baseUrl;

let adminUser;
let clientUser;
let cookieAdmin;
let cookieClient;

let testRestaurant;
let testProduct;

let foreignRestaurant;
let foreignProduct;
let foreignOrder;

const createdUserIds = [];
const createdOrderIds = [];

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  // Restaurante principal
  testRestaurant = await prisma.restaurant.findFirst({
    where: { slug: "la-esquina-food" },
    include: {
      products: {
        include: { options: true },
      },
    },
  });

  assert.ok(testRestaurant, "Debe existir el restaurante 'la-esquina-food' en Neon");
  testProduct = testRestaurant.products[0];
  assert.ok(testProduct, "Debe existir al menos un producto en el restaurante");

  const ts = Date.now();

  // Crear usuario Admin
  const adminDb = await prisma.user.create({
    data: {
      name: "Admin Panel Tester",
      email: `admin_panel_${ts}@foodiepop.test`,
      passwordHash: await bcrypt.hash("AdminPass123!", 10),
      role: "ADMIN",
      active: true,
    },
  });
  adminUser = adminDb;
  createdUserIds.push(adminDb.id);

  // Asignar membresía OWNER sobre testRestaurant (La Esquina Food)
  await prisma.userRestaurantRole.create({
    data: {
      userId: adminDb.id,
      restaurantId: testRestaurant.id,
      role: "OWNER",
      active: true,
    },
  });

  const resLoginAdmin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminDb.email,
      password: "AdminPass123!",
    }),
  });
  cookieAdmin = resLoginAdmin.headers.get("set-cookie").split(";")[0];

  // Crear usuario Cliente
  const resRegClient = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Panel Tester",
      email: `client_panel_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3009999999",
    }),
  });
  const dataClient = await resRegClient.json();
  clientUser = dataClient.data.user;
  cookieClient = resRegClient.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUser.id);

  // Crear un restaurante secundario para pruebas de aislamiento estricto
  foreignRestaurant = await prisma.restaurant.create({
    data: {
      slug: `foreign-rest-${ts}`,
      name: "Restaurante Ajeno Test",
      deliveryFee: 5000,
    },
  });

  const foreignCat = await prisma.category.create({
    data: {
      restaurantId: foreignRestaurant.id,
      name: `Cat Ajena ${ts}`,
    },
  });

  foreignProduct = await prisma.product.create({
    data: {
      restaurantId: foreignRestaurant.id,
      categoryId: foreignCat.id,
      name: `Foreign Product ${ts}`,
      price: 15000,
      cost: 6000,
      available: true,
    },
  });

  foreignOrder = await prisma.order.create({
    data: {
      orderNumber: `FP-FOR-${ts}`,
      userId: clientUser.id,
      restaurantId: foreignRestaurant.id,
      status: "RECEIVED",
      orderType: "PICKUP",
      customerName: "Cliente Foráneo",
      customerPhone: "3000000000",
      subtotal: 15000,
      total: 15000,
      items: {
        create: {
          productId: foreignProduct.id,
          name: foreignProduct.name,
          unitPrice: foreignProduct.price,
          quantity: 1,
          subtotal: 15000,
        },
      },
    },
  });
  createdOrderIds.push(foreignOrder.id);
});

after(async () => {
  // Limpieza de pedidos de prueba
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Error al limpiar pedidos de prueba:", e.message);
    }
  }

  // Limpieza del restaurante foráneo de prueba
  if (foreignRestaurant) {
    try {
      await prisma.productOption.deleteMany({ where: { product: { restaurantId: foreignRestaurant.id } } });
      await prisma.product.deleteMany({ where: { restaurantId: foreignRestaurant.id } });
      await prisma.category.deleteMany({ where: { restaurantId: foreignRestaurant.id } });
      await prisma.restaurant.deleteMany({ where: { id: foreignRestaurant.id } });
    } catch (e) {
      console.warn("Error al limpiar restaurante foráneo:", e.message);
    }
  }

  // Limpieza de usuarios
  if (createdUserIds.length > 0) {
    try {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (e) {
      console.warn("Error al limpiar usuarios de prueba:", e.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Suite de Pruebas: Panel de Restaurante, Auditoría de Seguridad y Aislamiento", () => {
  test("1. Admin accede a métricas reales del restaurante /orders/admin/restaurant/:slug/metrics", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food/metrics`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data, "Debe contener el objeto data");
    assert.strictEqual(typeof json.data.todaySales, "number");
    assert.strictEqual(typeof json.data.todayOrdersCount, "number");
    assert.strictEqual(typeof json.data.todayProfit, "number");
    assert.ok(Array.isArray(json.data.weeklyDays), "weeklyDays debe ser un array");
    assert.strictEqual(json.data.weeklyDays.length, 7, "Debe incluir los 7 días de la semana");
    assert.ok(json.data.customersSummary, "Debe incluir resumen de clientes");
    assert.ok(Array.isArray(json.data.recentOrders), "recentOrders debe ser un array");
  });

  test("2. Cliente común es rechazado con 403 al intentar acceder a métricas de restaurante", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food/metrics`, {
      method: "GET",
      headers: { Cookie: cookieClient },
    });

    assert.strictEqual(res.status, 403, "Cliente debe recibir 403 Forbidden");
    const json = await res.json();
    assert.ok(json.error, "Debe responder mensaje de error");
  });

  test("3. Usuario no autenticado es rechazado con 401 en métricas", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food/metrics`, {
      method: "GET",
    });

    assert.strictEqual(res.status, 401);
  });

  test("4. Aislamiento de restaurante: Admin no puede acceder a métricas de un restaurante ajeno", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/otro-restaurante-ajeno/metrics`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 403, "Debe rechazar acceso a restaurante ajeno con 403");
  });

  test("5. Admin accede al listado operativo de pedidos /orders/admin/restaurant/:slug", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data), "Debe devolver lista de pedidos en data");
  });

  test("6. Cliente común es rechazado con 403 en listado de pedidos administrativos", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food`, {
      method: "GET",
      headers: { Cookie: cookieClient },
    });

    assert.strictEqual(res.status, 403);
  });

  test("7. Admin consulta el catálogo completo de productos vía /menu/restaurant/:slug/admin-products", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/la-esquina-food/admin-products`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data), "Debe devolver array de productos");
    assert.ok(json.data.length > 0, "Debe contener productos del catálogo");
  });

  test("8. Cliente común es rechazado con 403 en /admin-products", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/la-esquina-food/admin-products`, {
      method: "GET",
      headers: { Cookie: cookieClient },
    });

    assert.strictEqual(res.status, 403);
  });

  test("9. Admin activa y desactiva disponibilidad de producto (PATCH /menu/products/:id/availability)", async () => {
    const initialStatus = testProduct.available;

    // 1. Cambiar a lo opuesto
    const resToggle = await fetch(`${baseUrl}/menu/products/${testProduct.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ available: !initialStatus }),
    });

    assert.strictEqual(resToggle.status, 200);
    const jsonToggle = await resToggle.json();
    assert.strictEqual(jsonToggle.data.available, !initialStatus);

    // 2. Restaurar al estado inicial
    const resRestore = await fetch(`${baseUrl}/menu/products/${testProduct.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ available: initialStatus }),
    });

    assert.strictEqual(resRestore.status, 200);
    const jsonRestore = await resRestore.json();
    assert.strictEqual(jsonRestore.data.available, initialStatus);
  });

  test("10. Cliente común no puede modificar la disponibilidad de productos (403)", async () => {
    const res = await fetch(`${baseUrl}/menu/products/${testProduct.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({ available: false }),
    });

    assert.strictEqual(res.status, 403);
  });

  test("11. Validación de payload en cambio de disponibilidad (rechaza tipos no booleanos)", async () => {
    const res = await fetch(`${baseUrl}/menu/products/${testProduct.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ available: "invalid_value" }),
    });

    assert.strictEqual(res.status, 400);
  });

  test("12. Aislamiento estricto: Admin intenta modificar un producto de otro restaurante (403)", async () => {
    const res = await fetch(`${baseUrl}/menu/products/${foreignProduct.id}/availability`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ available: false }),
    });

    assert.strictEqual(res.status, 403, "Debe responder 403 al intentar mutar un producto de otro restaurante");
  });

  test("13. Aislamiento estricto: Admin intenta cambiar el estado de un pedido ajeno (403)", async () => {
    const res = await fetch(`${baseUrl}/orders/${foreignOrder.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });

    assert.strictEqual(res.status, 403, "Debe responder 403 al intentar mutar el pedido de otro restaurante");
  });

  test("14. Aislamiento estricto: Admin intenta consultar un pedido de otro restaurante por ID (403)", async () => {
    const res = await fetch(`${baseUrl}/orders/${foreignOrder.id}`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 403, "Debe responder 403 si un admin consulta pedidos de otro restaurante");
  });

  test("15. Aislamiento estricto: Admin intenta acceder al catálogo privado de otro restaurante (403)", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/${foreignRestaurant.slug}/admin-products`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });

    assert.strictEqual(res.status, 403, "Debe responder 403 si un admin consulta catálogo de otro restaurante");
  });

  test("16. Métricas: Pedidos con estado CANCELLED no se contabilizan en ventas completadas", async () => {
    // 1. Obtener métricas iniciales
    const resInitial = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food/metrics`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });
    const initialData = (await resInitial.json()).data;

    // 2. Crear un pedido con estado CANCELLED hoy
    const ts = Date.now();
    const cancelledOrder = await prisma.order.create({
      data: {
        orderNumber: `FP-CAN-${ts}`,
        userId: clientUser.id,
        restaurantId: testRestaurant.id,
        status: "CANCELLED",
        orderType: "PICKUP",
        customerName: "Cliente Cancelado",
        customerPhone: "3000000001",
        subtotal: 99999,
        total: 99999,
        items: {
          create: {
            productId: testProduct.id,
            name: testProduct.name,
            unitPrice: testProduct.price,
            quantity: 1,
            subtotal: 99999,
          },
        },
      },
    });
    createdOrderIds.push(cancelledOrder.id);

    // 3. Volver a consultar métricas
    const resAfter = await fetch(`${baseUrl}/orders/admin/restaurant/la-esquina-food/metrics`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });
    const afterData = (await resAfter.json()).data;

    // 4. Las ventas y conteo de hoy no deben haberse incrementado con el pedido cancelado
    assert.strictEqual(
      afterData.todaySales,
      initialData.todaySales,
      "Las ventas de hoy no deben incluir pedidos CANCELLED"
    );
    assert.strictEqual(
      afterData.todayOrdersCount,
      initialData.todayOrdersCount,
      "El conteo de pedidos de hoy no debe incluir pedidos CANCELLED"
    );
  });
});
