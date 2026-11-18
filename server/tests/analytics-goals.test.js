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

let kitchenUserA;
let cookieKitchenA;

let restaurantA;
let productA1;
let productA2;

let restaurantB;
let productB1;

let emptyRestaurant;

const createdOrderIds = [];
const createdUserIds = [];
const createdRestaurantIds = [];
const createdCategoryIds = [];
const createdProductIds = [];

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
    include: {
      categories: true,
      products: { where: { active: true } },
    },
  });
  assert.ok(restaurantA, "Debe existir 'la-esquina-food'");

  // Asegurar al menos 2 productos en restaurantA para comparaciones de rentabilidad vs volumen
  if (restaurantA.products.length < 2) {
    const cat = restaurantA.categories[0];
    const newP = await prisma.product.create({
      data: {
        restaurantId: restaurantA.id,
        categoryId: cat.id,
        name: `Prod Aux Sprint2 ${ts}`,
        price: 20000,
        cost: 8000,
        available: true,
      },
    });
    createdProductIds.push(newP.id);
    restaurantA.products.push(newP);
  }

  productA1 = restaurantA.products[0];
  productA2 = restaurantA.products[1];

  // 2. Admin con rol OWNER en Restaurante A
  const adminDbA = await prisma.user.create({
    data: {
      name: "Admin Sprint 2 A",
      email: `admin_s2_a_${ts}@foodiepop.test`,
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

  // 3. Usuario KITCHEN en Restaurante A (para comprobar permisos restringidos)
  const kitchenDbA = await prisma.user.create({
    data: {
      name: "Cocina Sprint 2 A",
      email: `kitchen_s2_a_${ts}@foodiepop.test`,
      passwordHash: await bcrypt.hash("KitchenPass123!", 10),
      role: "ADMIN",
      active: true,
    },
  });
  kitchenUserA = kitchenDbA;
  createdUserIds.push(kitchenDbA.id);

  await prisma.userRestaurantRole.create({
    data: {
      userId: kitchenDbA.id,
      restaurantId: restaurantA.id,
      role: "KITCHEN",
      active: true,
    },
  });

  const resLoginK = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: kitchenDbA.email, password: "KitchenPass123!" }),
  });
  cookieKitchenA = resLoginK.headers.get("set-cookie").split(";")[0];

  // 4. Restaurante Secundario (B) para pruebas de Aislamiento
  restaurantB = await prisma.restaurant.create({
    data: {
      slug: `rest-b-analytics-${ts}`,
      name: "Restaurante B Analytics",
      monthlyGoal: 4000000,
    },
  });
  createdRestaurantIds.push(restaurantB.id);

  const catB = await prisma.category.create({
    data: {
      restaurantId: restaurantB.id,
      name: `Cat B ${ts}`,
    },
  });
  createdCategoryIds.push(catB.id);

  productB1 = await prisma.product.create({
    data: {
      restaurantId: restaurantB.id,
      categoryId: catB.id,
      name: `Prod B ${ts}`,
      price: 18000,
      cost: 7000,
    },
  });
  createdProductIds.push(productB1.id);

  const adminDbB = await prisma.user.create({
    data: {
      name: "Admin Sprint 2 B",
      email: `admin_s2_b_${ts}@foodiepop.test`,
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

  // 5. Restaurante vacío (sin pedidos)
  emptyRestaurant = await prisma.restaurant.create({
    data: {
      slug: `rest-empty-${ts}`,
      name: "Restaurante Vacío Test",
      monthlyGoal: 3000000,
    },
  });
  createdRestaurantIds.push(emptyRestaurant.id);

  await prisma.userRestaurantRole.create({
    data: {
      userId: adminDbA.id,
      restaurantId: emptyRestaurant.id,
      role: "OWNER",
      active: true,
    },
  });

  // 6. Cliente común para pruebas
  const resRegClient = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Sprint 2 Tester",
      email: `client_s2_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3006666666",
    }),
  });
  const dataClient = await resRegClient.json();
  clientUser = dataClient.data.user;
  cookieClient = resRegClient.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUser.id);

  // 7. Crear pedidos reales para Restaurant A con fechas controladas
  // Pedido 1: Producto A1 x 5 (Alto volumen)
  const o1 = await prisma.order.create({
    data: {
      orderNumber: `FP-AN1-${ts}`,
      userId: clientUser.id,
      restaurantId: restaurantA.id,
      status: "DELIVERED",
      orderType: "PICKUP",
      customerName: "Cliente A",
      customerPhone: "3001111111",
      subtotal: productA1.price * 5,
      total: productA1.price * 5,
      createdAt: new Date(),
      items: {
        create: {
          productId: productA1.id,
          name: productA1.name,
          unitPrice: productA1.price,
          quantity: 5,
          subtotal: productA1.price * 5,
        },
      },
    },
  });
  createdOrderIds.push(o1.id);

  // Pedido 2: Producto A2 x 2 (Menor volumen)
  const o2 = await prisma.order.create({
    data: {
      orderNumber: `FP-AN2-${ts}`,
      userId: clientUser.id,
      restaurantId: restaurantA.id,
      status: "PREPARING",
      orderType: "PICKUP",
      customerName: "Cliente B",
      customerPhone: "3002222222",
      subtotal: productA2.price * 2,
      total: productA2.price * 2,
      createdAt: new Date(),
      items: {
        create: {
          productId: productA2.id,
          name: productA2.name,
          unitPrice: productA2.price,
          quantity: 2,
          subtotal: productA2.price * 2,
        },
      },
    },
  });
  createdOrderIds.push(o2.id);

  // Pedido 3: CANCELLED (para verificar que se excluya de todas las métricas)
  const oCancel = await prisma.order.create({
    data: {
      orderNumber: `FP-ANCAN-${ts}`,
      userId: clientUser.id,
      restaurantId: restaurantA.id,
      status: "CANCELLED",
      orderType: "PICKUP",
      customerName: "Cliente Cancelado",
      customerPhone: "3009999999",
      subtotal: 999999,
      total: 999999,
      createdAt: new Date(),
      items: {
        create: {
          productId: productA1.id,
          name: productA1.name,
          unitPrice: productA1.price,
          quantity: 20,
          subtotal: 999999,
        },
      },
    },
  });
  createdOrderIds.push(oCancel.id);
});

after(async () => {
  // Limpieza de pedidos
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Error limpiando pedidos:", e.message);
    }
  }

  // Limpieza de productos
  if (createdProductIds.length > 0) {
    try {
      await prisma.productOption.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.orderItem.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    } catch (e) {
      console.warn("Error limpiando productos:", e.message);
    }
  }

  // Limpieza de categorías
  if (createdCategoryIds.length > 0) {
    try {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    } catch (e) {
      console.warn("Error limpiando categorías:", e.message);
    }
  }

  // Limpieza de membresías y restaurantes
  if (createdRestaurantIds.length > 0) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } });
      await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
    } catch (e) {
      console.warn("Error limpiando restaurantes:", e.message);
    }
  }

  // Limpieza de usuarios
  if (createdUserIds.length > 0) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (e) {
      console.warn("Error limpiando usuarios:", e.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Suite de Pruebas: Sprint 2 — Análisis de Ventas y Metas Comerciales", () => {
  // 1. Ranking de productos más vendidos
  test("1. Ranking de productos más vendidos: identifica unidades vendidas e ingresos (GET /analytics)", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const data = json.data;

    assert.ok(data.hasOrders);
    assert.ok(data.totalAnalyzedOrders >= 2, "Debe analizar al menos los pedidos válidos creados");
    assert.ok(Array.isArray(data.topSellingProducts));
    assert.ok(data.topSellingProducts.length >= 2);

    const firstProduct = data.topSellingProducts[0];
    assert.strictEqual(firstProduct.rank, 1);
    assert.strictEqual(firstProduct.isTopStar, true, "El primer producto debe tener la insignia isTopStar");
    assert.ok(firstProduct.unitsSold > 0);
    assert.ok(firstProduct.revenue > 0);
  });

  // 2. Cálculo de rentabilidad por producto
  test("2. Cálculo de rentabilidad por producto: ingresos, costos acumulados, ganancia y margen %", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const mostProfitable = json.data.mostProfitableProducts;

    assert.ok(Array.isArray(mostProfitable));
    const topProfit = mostProfitable[0];
    assert.strictEqual(topProfit.profitRank, 1);
    assert.ok(topProfit.profit >= 0);
    assert.ok(typeof topProfit.margin === "number");

    // Verificar fórmula matemática: Profit = Revenue - TotalCost
    assert.strictEqual(topProfit.profit, topProfit.revenue - topProfit.totalCost);

    // Si Revenue > 0, Margin = (Profit / Revenue) * 100
    if (topProfit.revenue > 0) {
      const expectedMargin = Number(((topProfit.profit / topProfit.revenue) * 100).toFixed(1));
      assert.strictEqual(topProfit.margin, expectedMargin);
    }
  });

  // 3. Exclusión de pedidos cancelados
  test("3. Exclusión estricta de pedidos CANCELLED en todas las métricas de analítica y metas", async () => {
    // Obtener métricas iniciales
    const resInitial = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });
    const initialData = (await resInitial.json()).data;

    // Crear un pedido CANCELLED con monto exorbitante
    const ts = Date.now();
    const cancelled = await prisma.order.create({
      data: {
        orderNumber: `FP-EXCAN-${ts}`,
        userId: clientUser.id,
        restaurantId: restaurantA.id,
        status: "CANCELLED",
        orderType: "PICKUP",
        customerName: "Cancel Tester Exclusión",
        customerPhone: "3000000000",
        subtotal: 77777777,
        total: 77777777,
        items: {
          create: {
            productId: productA1.id,
            name: productA1.name,
            unitPrice: productA1.price,
            quantity: 50,
            subtotal: 77777777,
          },
        },
      },
    });
    createdOrderIds.push(cancelled.id);

    // Consultar analítica nuevamente
    const resAfter = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });
    const afterData = (await resAfter.json()).data;

    // Las órdenes y las ventas analizadas no deben haber variado con el pedido cancelado
    assert.strictEqual(afterData.totalAnalyzedOrders, initialData.totalAnalyzedOrders);
    assert.strictEqual(afterData.totalAnalyzedRevenue, initialData.totalAnalyzedRevenue);

    // La meta tampoco debe verse incrementada por el pedido cancelado
    const resGoal = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });
    const goalData = (await resGoal.json()).data;
    assert.ok(goalData.currentMonthSales < 77777777);
  });

  // 4. Agrupación de ventas por día de la semana
  test("4. Agrupación de ventas por día de la semana e identificación de peakDay", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const demandByDay = json.data.demandByDay;

    assert.strictEqual(demandByDay.length, 7, "Debe retornar los 7 días de la semana");
    const peakDay = json.data.peakDay;
    assert.ok(peakDay, "Debe existir un día pico con pedidos");
    assert.strictEqual(peakDay.isPeak, true);
    assert.ok(peakDay.ordersCount >= 2);
  });

  // 5. Agrupación de ventas por hora del día
  test("5. Agrupación de ventas por hora del día e identificación de peakHour", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const demandByHour = json.data.demandByHour;

    assert.strictEqual(demandByHour.length, 24, "Debe retornar las 24 horas del día");
    const peakHour = json.data.peakHour;
    assert.ok(peakHour, "Debe identificar el horario pico de pedidos");
    assert.strictEqual(peakHour.isPeak, true);
    assert.ok(peakHour.ordersCount >= 1);
  });

  // 6. Consulta de meta mensual vigente
  test("6. Consulta de meta mensual vigente desde Restaurant.monthlyGoal (GET /goal)", async () => {
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    const goal = json.data;

    assert.strictEqual(goal.restaurantSlug, restaurantA.slug);
    assert.strictEqual(goal.monthlyGoal, 5000000, "Debe retornar el default de 5000000 o valor configurado");
    assert.ok(typeof goal.currentMonthSales === "number");
    assert.ok(typeof goal.progressPct === "number");
    assert.ok(typeof goal.remaining === "number");
    assert.ok(typeof goal.isGoalReached === "boolean");
    assert.ok(goal.monthName);
    assert.ok(goal.year);
  });

  // 7. Modificación de meta mensual
  test("7. Modificación de meta mensual de ventas y persistencia en Neon (PATCH /goal)", async () => {
    const newGoal = 7500000;
    const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ monthlyGoal: newGoal }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.monthlyGoal, newGoal);

    // Verificar persistencia directa en Neon
    const dbRest = await prisma.restaurant.findUnique({
      where: { id: restaurantA.id },
      select: { monthlyGoal: true },
    });
    assert.strictEqual(dbRest.monthlyGoal, newGoal, "El valor debe quedar persistido en PostgreSQL");

    // Restaurar a 5000000
    await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ monthlyGoal: 5000000 }),
    });
  });

  // 8. Validación de metas negativas o inválidas
  test("8. Validación de metas: rechaza valores negativos, cero, decimales o tipos incompatibles (400)", async () => {
    const invalidGoals = [-1000, 0, "no_es_numero", 15000.5];
    for (const g of invalidGoals) {
      const res = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
        body: JSON.stringify({ monthlyGoal: g }),
      });
      assert.strictEqual(res.status, 400, `Debe responder 400 con meta inválida: ${g}`);
    }
  });

  // 9. Cálculo del porcentaje de cumplimiento
  test("9. Cálculo del porcentaje de cumplimiento y estado isGoalReached", async () => {
    // Configurar temporalmente una meta muy baja (1 COP) para verificar isGoalReached = true
    const resLow = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ monthlyGoal: 100 }),
    });

    assert.strictEqual(resLow.status, 200);
    const lowData = (await resLow.json()).data;
    assert.strictEqual(lowData.isGoalReached, true, "Con meta de $100 COP debe marcar meta cumplida");
    assert.strictEqual(lowData.remaining, 0);
    assert.ok(lowData.progressPct >= 100);

    // Restaurar meta
    await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ monthlyGoal: 5000000 }),
    });
  });

  // 10. Aislamiento entre restaurantes
  test("10. Aislamiento estricto: Admin A no puede consultar analítica ni modificar meta de Restaurante B (403)", async () => {
    // Admin A intenta consultar analítica de B
    const resAnB = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantB.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });
    assert.strictEqual(resAnB.status, 403, "Debe rechazar consulta analítica de restaurante ajeno");

    // Admin A intenta consultar meta de B
    const resGetGoalB = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantB.slug}/goal`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });
    assert.strictEqual(resGetGoalB.status, 403, "Debe rechazar consulta de meta de restaurante ajeno");

    // Admin A intenta modificar meta de B
    const resPatchGoalB = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantB.slug}/goal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookieAdminA },
      body: JSON.stringify({ monthlyGoal: 9999999 }),
    });
    assert.strictEqual(resPatchGoalB.status, 403, "Debe rechazar mutación de meta de restaurante ajeno");
  });

  // 11. Restricciones de permisos
  test("11. Restricción de permisos: rechaza usuario no autenticado (401), rol CLIENT (403) y rol KITCHEN (403)", async () => {
    // 11.1 No autenticado
    const resUnauth = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
    });
    assert.strictEqual(resUnauth.status, 401);

    // 11.2 Cliente
    const resClient = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieClient },
    });
    assert.strictEqual(resClient.status, 403);

    // 11.3 Rol operativo KITCHEN (solo permitido en pedidos operativos, no en finanzas/metas)
    const resKitchen = await fetch(`${baseUrl}/orders/admin/restaurant/${restaurantA.slug}/goal`, {
      method: "GET",
      headers: { Cookie: cookieKitchenA },
    });
    assert.strictEqual(resKitchen.status, 403);
  });

  // 12. Restaurantes sin ventas registradas
  test("12. Restaurante sin ventas responde estructura coherente sin excepciones ni datos inventados", async () => {
    const resEmptyAn = await fetch(`${baseUrl}/orders/admin/restaurant/${emptyRestaurant.slug}/analytics`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(resEmptyAn.status, 200);
    const jsonEmpty = await resEmptyAn.json();
    assert.strictEqual(jsonEmpty.data.hasOrders, false);
    assert.strictEqual(jsonEmpty.data.totalAnalyzedOrders, 0);
    assert.strictEqual(jsonEmpty.data.totalAnalyzedRevenue, 0);
    assert.strictEqual(jsonEmpty.data.peakDay, null);
    assert.strictEqual(jsonEmpty.data.peakHour, null);

    const resEmptyGoal = await fetch(`${baseUrl}/orders/admin/restaurant/${emptyRestaurant.slug}/goal`, {
      method: "GET",
      headers: { Cookie: cookieAdminA },
    });

    assert.strictEqual(resEmptyGoal.status, 200);
    const goalEmpty = (await resEmptyGoal.json()).data;
    assert.strictEqual(goalEmpty.currentMonthSales, 0);
    assert.strictEqual(goalEmpty.progressPct, 0);
    assert.strictEqual(goalEmpty.isGoalReached, false);
    assert.strictEqual(goalEmpty.remaining, goalEmpty.monthlyGoal);
  });
});

