const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

let server;
let baseUrl;

let adminUserA;
let cookieAdminA;

let adminUserB;
let cookieAdminB;

let clientUser;
let cookieClient;

let restaurantA;
let categoryA;

let restaurantB;
let categoryB;

const createdProductIds = [];
const createdOptionIds = [];
const createdUserIds = [];
const createdRestaurantIds = [];
const createdCategoryIds = [];
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

  const ts = Date.now();

  // 1. Restaurante Principal (A)
  restaurantA = await prisma.restaurant.findFirst({
    where: { slug: "la-esquina-food" },
    include: { categories: true },
  });
  assert.ok(restaurantA, "Debe existir 'la-esquina-food'");
  categoryA = restaurantA.categories[0];
  assert.ok(categoryA, "Debe existir al menos una categoría en restaurantA");

  // 2. Admin para Restaurante A
  const adminDbA = await prisma.user.create({
    data: {
      name: "Admin Catálogo A",
      email: `admin_cat_a_${ts}@foodiepop.test`,
      passwordHash: await bcrypt.hash("AdminPass123!", 10),
      role: "ADMIN",
      active: true,
    },
  });
  adminUserA = adminDbA;
  createdUserIds.push(adminDbA.id);

  await prisma.userRestaurantRole.create({
    data: {
      userId: adminDbA.id,
      restaurantId: restaurantA.id,
      role: "OWNER",
      active: true,
    },
  });

  const resLoginA = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminDbA.email, password: "AdminPass123!" }),
  });
  cookieAdminA = resLoginA.headers.get("set-cookie").split(";")[0];

  // 3. Restaurante Secundario (B) para pruebas de Aislamiento
  restaurantB = await prisma.restaurant.create({
    data: {
      slug: `cat-isol-rest-${ts}`,
      name: "Restaurante B Aislamiento",
      deliveryFee: 4500,
    },
  });
  createdRestaurantIds.push(restaurantB.id);

  categoryB = await prisma.category.create({
    data: {
      restaurantId: restaurantB.id,
      name: `Cat B ${ts}`,
    },
  });
  createdCategoryIds.push(categoryB.id);

  // 4. Admin para Restaurante B
  const adminDbB = await prisma.user.create({
    data: {
      name: "Admin Catálogo B",
      email: `admin_cat_b_${ts}@foodiepop.test`,
      passwordHash: await bcrypt.hash("AdminPass123!", 10),
      role: "ADMIN",
      active: true,
    },
  });
  adminUserB = adminDbB;
  createdUserIds.push(adminDbB.id);

  await prisma.userRestaurantRole.create({
    data: {
      userId: adminDbB.id,
      restaurantId: restaurantB.id,
      role: "OWNER",
      active: true,
    },
  });

  const resLoginB = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminDbB.email, password: "AdminPass123!" }),
  });
  cookieAdminB = resLoginB.headers.get("set-cookie").split(";")[0];

  // 5. Usuario Cliente para pruebas de permisos y checkout
  const resRegClient = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Catálogo Tester",
      email: `client_cat_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3008888888",
    }),
  });
  const dataClient = await resRegClient.json();
  clientUser = dataClient.data.user;
  cookieClient = resRegClient.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUser.id);
});

after(async () => {
  // Limpieza de pedidos
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Error en limpieza de pedidos:", e.message);
    }
  }

  // Limpieza de opciones
  if (createdOptionIds.length > 0) {
    try {
      await prisma.productOption.deleteMany({ where: { id: { in: createdOptionIds } } });
    } catch (e) {
      console.warn("Error en limpieza de opciones:", e.message);
    }
  }

  // Limpieza de productos
  if (createdProductIds.length > 0) {
    try {
      await prisma.productOption.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.orderItem.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    } catch (e) {
      console.warn("Error en limpieza de productos:", e.message);
    }
  }

  // Limpieza de categorías y restaurante B
  if (createdCategoryIds.length > 0) {
    try {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    } catch (e) {
      console.warn("Error en limpieza de categorías:", e.message);
    }
  }

  if (createdRestaurantIds.length > 0) {
    try {
      await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
    } catch (e) {
      console.warn("Error en limpieza de restaurantes:", e.message);
    }
  }

  // Limpieza de usuarios
  if (createdUserIds.length > 0) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (e) {
      console.warn("Error en limpieza de usuarios:", e.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Suite de Pruebas: Sprint 1 — Gestión Completa de Catálogo y Costos", () => {
  let createdProd;
  let createdOpt;

  // 1. Crear producto con datos válidos
  test("1. Admin crea un producto válido en su restaurante (POST /menu/restaurant/:slug/products)", async () => {
    const ts = Date.now();
    const res = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: `Burger Gourmet ${ts}`,
        description: "Hamburguesa artesanal con carne angus",
        price: 32000,
        cost: 14000,
        categoryId: categoryA.id,
        imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
        available: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.ok(json.data);
    assert.ok(json.data.id);
    assert.strictEqual(json.data.name, `Burger Gourmet ${ts}`);
    assert.strictEqual(json.data.price, 32000);
    assert.strictEqual(json.data.cost, 14000);
    assert.strictEqual(json.data.available, true);
    assert.strictEqual(json.data.categoryId, categoryA.id);

    createdProd = json.data;
    createdProductIds.push(json.data.id);
  });

  // 2. Validar campos obligatorios
  test("2. Rechaza creación de producto sin nombre o sin categoría (400)", async () => {
    // Sin nombre
    const resNoName = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: "   ",
        price: 20000,
        categoryId: categoryA.id,
      }),
    });
    assert.strictEqual(resNoName.status, 400);

    // Sin categoría
    const resNoCat = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: "Producto Sin Cat",
        price: 20000,
      }),
    });
    assert.strictEqual(resNoCat.status, 400);
  });

  // 3. Rechazar precios inválidos
  test("3. Rechaza precios inválidos (negativos, cero o tipos incompatibles) (400)", async () => {
    const invalidPrices = [-5000, 0, "gratis", 12.5];
    for (const p of invalidPrices) {
      const res = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
        body: JSON.stringify({
          name: `Prod Invalido ${Date.now()}`,
          price: p,
          categoryId: categoryA.id,
        }),
      });
      assert.strictEqual(res.status, 400, `Debe rechazar precio '${p}' con 400`);
    }
  });

  // 4. Rechazar costos de producción inválidos
  test("4. Rechaza costos de producción negativos (400)", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: `Prod Costo Invalido ${Date.now()}`,
        price: 25000,
        cost: -1000,
        categoryId: categoryA.id,
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  // 5. Rechazar nombres duplicados en el mismo restaurante
  test("5. Rechaza creación de producto con nombre duplicado en el mismo restaurante (409)", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: createdProd.name,
        price: 25000,
        categoryId: categoryA.id,
      }),
    });
    assert.strictEqual(res.status, 409);
  });

  // 6. Editar producto existente
  test("6. Admin edita completamente un producto existente (PATCH /menu/products/:id)", async () => {
    const res = await fetch(`${baseUrl}/menu/products/${createdProd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: `${createdProd.name} — Edición Especial`,
        price: 36000,
        cost: 16000,
        description: "Descripción actualizada con salsa trufada",
        available: false,
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.name, `${createdProd.name} — Edición Especial`);
    assert.strictEqual(json.data.price, 36000);
    assert.strictEqual(json.data.cost, 16000);
    assert.strictEqual(json.data.available, false);

    // Restaurar disponibilidad para las pruebas posteriores
    await fetch(`${baseUrl}/menu/products/${createdProd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ available: true }),
    });
  });

  // 7. Rechazar acceso no autorizado
  test("7. Rechaza creación y edición de productos a usuarios no autenticados (401) y clientes (403)", async () => {
    // Sin autenticación
    const resUnauth = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacker Burger", price: 10000, categoryId: categoryA.id }),
    });
    assert.strictEqual(resUnauth.status, 401);

    // Cliente común
    const resClient = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieClient },
      body: JSON.stringify({ name: "Client Burger", price: 10000, categoryId: categoryA.id }),
    });
    assert.strictEqual(resClient.status, 403);
  });

  // 8. Aislamiento por restaurante
  test("8. Aislamiento multi-restaurante: Admin A no puede crear ni editar productos en Restaurante B (403)", async () => {
    // Admin A intenta crear producto en Restaurante B
    const resCreate = await fetch(`${baseUrl}/menu/restaurant/${restaurantB.slug}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ name: "Intruso Burger", price: 20000, categoryId: categoryB.id }),
    });
    assert.strictEqual(resCreate.status, 403);

    // Admin B intenta editar el producto de Restaurante A
    const resEdit = await fetch(`${baseUrl}/menu/products/${createdProd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminB },
      body: JSON.stringify({ price: 1000 }),
    });
    assert.strictEqual(resEdit.status, 403);
  });

  // 9. Crear y editar adicionales (ProductOption)
  test("9. Admin crea y edita un adicional para el producto (POST /products/:id/options, PATCH /options/:id)", async () => {
    // 9.1 Crear adicional
    const resOpt = await fetch(`${baseUrl}/menu/products/${createdProd.id}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: "Queso Cheddar Fundido",
        price: 4500,
        cost: 2000,
        active: true,
      }),
    });

    assert.strictEqual(resOpt.status, 201);
    const jsonOpt = await resOpt.json();
    assert.ok(jsonOpt.data);
    assert.strictEqual(jsonOpt.data.name, "Queso Cheddar Fundido");
    assert.strictEqual(jsonOpt.data.price, 4500);
    assert.strictEqual(jsonOpt.data.cost, 2000);
    assert.strictEqual(jsonOpt.data.active, true);

    createdOpt = jsonOpt.data;
    createdOptionIds.push(createdOpt.id);

    // 9.2 Editar adicional (nombre, precio, costo, active)
    const resEditOpt = await fetch(`${baseUrl}/menu/options/${createdOpt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({
        name: "Doble Queso Cheddar Fundido",
        price: 5000,
        cost: 2500,
        active: true,
      }),
    });

    assert.strictEqual(resEditOpt.status, 200);
    const jsonEditOpt = await resEditOpt.json();
    assert.strictEqual(jsonEditOpt.data.name, "Doble Queso Cheddar Fundido");
    assert.strictEqual(jsonEditOpt.data.price, 5000);
    assert.strictEqual(jsonEditOpt.data.cost, 2500);
  });

  // 10. Aislamiento en adicionales
  test("10. Aislamiento en adicionales: Admin B no puede crear ni modificar adicionales de Restaurante A (403)", async () => {
    // Admin B intenta agregar opción al producto de A
    const resAdd = await fetch(`${baseUrl}/menu/products/${createdProd.id}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminB },
      body: JSON.stringify({ name: "Papas Fritas", price: 6000 }),
    });
    assert.strictEqual(resAdd.status, 403);

    // Admin B intenta modificar opción de A
    const resMod = await fetch(`${baseUrl}/menu/options/${createdOpt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminB },
      body: JSON.stringify({ price: 100 }),
    });
    assert.strictEqual(resMod.status, 403);
  });

  // 11. Compatibilidad con ProductModal, Checkout y Snapshots
  test("11. Compatibilidad con checkout y preservación inmutable del snapshot histórico", async () => {
    // Cliente compra el producto recién creado con el adicional recién creado
    const resOrder = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieClient },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: clientUser.name, phone: clientUser.phone },
        items: [
          {
            productId: createdProd.id,
            quantity: 2,
            selectedOptions: [
              { id: createdOpt.id, name: "Doble Queso Cheddar Fundido", price: 5000 },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(resOrder.status, 201);
    const orderJson = await resOrder.json();
    const order = orderJson.data.order;
    createdOrderIds.push(order.orderId);

    // Precio base (36000) + Adicional (5000) = 41000 * 2 = 82000
    assert.strictEqual(order.subtotal, 82000);
    assert.strictEqual(order.total, 82000);

    // Verificar snapshot en BD
    const savedItem = await prisma.orderItem.findFirst({
      where: { orderId: order.orderId },
    });
    assert.ok(savedItem);
    assert.strictEqual(savedItem.selectedOptions[0].id, createdOpt.id);
    assert.strictEqual(savedItem.selectedOptions[0].price, 5000);

    // 12. Modificar el producto y el adicional posteriormente en el catálogo
    await fetch(`${baseUrl}/menu/products/${createdProd.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ price: 99999, name: "Producto Renombrado" }),
    });

    await fetch(`${baseUrl}/menu/options/${createdOpt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ price: 88888, name: "Opción Renombrada" }),
    });

    // 13. El pedido histórico permanece exactamente intacto
    const historicalItem = await prisma.orderItem.findFirst({
      where: { orderId: order.orderId },
    });
    assert.strictEqual(historicalItem.unitPrice, 36000, "Precio unitario histórico debe conservarse");
    assert.strictEqual(historicalItem.subtotal, 82000, "Subtotal histórico debe conservarse");
    assert.strictEqual(historicalItem.selectedOptions[0].price, 5000, "Precio del adicional en snapshot debe conservarse");
  });
});

