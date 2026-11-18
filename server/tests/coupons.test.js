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
let productA;

let restaurantB;
let productB;

const createdCouponIds = [];
const createdOrderIds = [];
const createdUserIds = [];
const createdRestaurantIds = [];
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
    include: { products: { where: { active: true, available: true } } },
  });
  assert.ok(restaurantA, "Debe existir restaurante la-esquina-food");
  productA = restaurantA.products[0];
  assert.ok(productA, "Debe existir al menos un producto disponible en restaurantA");

  // 2. Admin para Restaurante A
  const adminDbA = await prisma.user.create({
    data: {
      name: "Admin Cupones A",
      email: `admin_coup_a_${ts}@foodiepop.test`,
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
      slug: `coup-isol-rest-${ts}`,
      name: "Restaurante Cupones B",
      deliveryFee: 5000,
    },
  });
  createdRestaurantIds.push(restaurantB.id);

  const categoryB = await prisma.category.create({
    data: {
      restaurantId: restaurantB.id,
      name: `Cat B ${ts}`,
    },
  });

  productB = await prisma.product.create({
    data: {
      restaurantId: restaurantB.id,
      categoryId: categoryB.id,
      name: `Producto B ${ts}`,
      price: 30000,
      active: true,
      available: true,
    },
  });
  createdProductIds.push(productB.id);

  // 4. Admin para Restaurante B
  const adminDbB = await prisma.user.create({
    data: {
      name: "Admin Cupones B",
      email: `admin_coup_b_${ts}@foodiepop.test`,
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

  // 5. Usuario Cliente para pruebas de checkout
  const resRegClient = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Cupón Tester",
      email: `client_coup_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3007777777",
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
      console.warn("Error limpiando pedidos:", e.message);
    }
  }

  // Limpieza de cupones
  if (createdCouponIds.length > 0) {
    try {
      await prisma.coupon.deleteMany({ where: { id: { in: createdCouponIds } } });
    } catch (e) {
      console.warn("Error limpiando cupones:", e.message);
    }
  }

  // Limpieza de productos
  if (createdProductIds.length > 0) {
    try {
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    } catch (e) {
      console.warn("Error limpiando productos:", e.message);
    }
  }

  // Limpieza de restaurantes
  if (createdRestaurantIds.length > 0) {
    try {
      await prisma.category.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } });
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

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Sprint 3: Sistema Integral de Cupones y Descuentos", () => {
  let percentageCouponId;
  let fixedCouponId;
  const ts = Date.now().toString().slice(-6);

  // 1. Crear cupón de porcentaje
  test("1. Admin puede crear un cupón de tipo porcentaje", async () => {
    const res = await fetch(`${baseUrl}/coupons/admin/restaurant/${restaurantA.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        code: `PCT${ts}`,
        description: "15% de descuento inauguración",
        discountType: "PERCENTAGE",
        discountValue: 15,
        minimumOrderAmount: 20000,
        maximumDiscount: 10000,
        active: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.ok(json.data.id);
    assert.strictEqual(json.data.code, `PCT${ts}`);
    assert.strictEqual(json.data.discountType, "PERCENTAGE");
    assert.strictEqual(json.data.discountValue, 15);
    assert.strictEqual(json.data.maximumDiscount, 10000);
    percentageCouponId = json.data.id;
    createdCouponIds.push(json.data.id);
  });

  // 2. Crear cupón de valor fijo
  test("2. Admin puede crear un cupón de tipo valor fijo", async () => {
    const res = await fetch(`${baseUrl}/coupons/admin/restaurant/${restaurantA.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        code: `FIX${ts}`,
        description: "$5.000 COP de descuento fijo",
        discountType: "FIXED",
        discountValue: 5000,
        minimumOrderAmount: 25000,
        active: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.ok(json.data.id);
    assert.strictEqual(json.data.code, `FIX${ts}`);
    assert.strictEqual(json.data.discountType, "FIXED");
    assert.strictEqual(json.data.discountValue, 5000);
    fixedCouponId = json.data.id;
    createdCouponIds.push(json.data.id);
  });

  // 3. Editar cupón
  test("3. Admin puede editar las propiedades de un cupón", async () => {
    const res = await fetch(`${baseUrl}/coupons/admin/${fixedCouponId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        discountValue: 6000,
        description: "Descuento fijo actualizado a $6.000",
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.discountValue, 6000);
    assert.strictEqual(json.data.description, "Descuento fijo actualizado a $6.000");
  });

  // 4. Desactivar cupón
  test("4. Admin puede activar y desactivar un cupón", async () => {
    // Desactivar
    const resOff = await fetch(`${baseUrl}/coupons/admin/${fixedCouponId}/active`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({ active: false }),
    });

    assert.strictEqual(resOff.status, 200);
    const jsonOff = await resOff.json();
    assert.strictEqual(jsonOff.data.active, false);

    // Reactivar para siguientes pruebas
    const resOn = await fetch(`${baseUrl}/coupons/admin/${fixedCouponId}/active`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({ active: true }),
    });

    assert.strictEqual(resOn.status, 200);
    const jsonOn = await resOn.json();
    assert.strictEqual(jsonOn.data.active, true);
  });

  // 5. Aplicar cupón válido en checkout
  test("5. Cliente puede aplicar un cupón válido y se refleja en subtotal, descuento y total", async () => {
    // Crear cupón específico para checkout
    const code = `VALID${ts}`;
    const coupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code,
        discountType: "FIXED",
        discountValue: 4000,
        minimumOrderAmount: 10000,
        active: true,
      },
    });
    createdCouponIds.push(coupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 2 }],
        couponCode: code,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const expectedSubtotal = productA.price * 2;
    const expectedDiscount = 4000;
    const expectedTotal = expectedSubtotal - expectedDiscount;

    assert.strictEqual(order.subtotal, expectedSubtotal);
    assert.strictEqual(order.discount, expectedDiscount);
    assert.strictEqual(order.total, expectedTotal);
    assert.strictEqual(order.couponCode, code);
    assert.ok(order.couponSnapshot);
    assert.strictEqual(order.couponSnapshot.discountApplied, expectedDiscount);

    // Verificar incremento de usageCount
    const dbCoupon = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    assert.strictEqual(dbCoupon.usageCount, 1);
  });

  // 6. Rechazar código inexistente
  test("6. Se rechaza un pedido o validación con código inexistente", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: "CODIGO_FANTASMA_NO_EXISTE",
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /no existe/i);
  });

  // 7. Rechazar cupón expirado
  test("7. Se rechaza un cupón cuya fecha de fin ya pasó", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `EXP${ts}`,
        discountType: "PERCENTAGE",
        discountValue: 10,
        endDate: pastDate,
        active: true,
      },
    });
    createdCouponIds.push(expiredCoupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: `EXP${ts}`,
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /ha expirado/i);
  });

  // 8. Rechazar cupón inactivo
  test("8. Se rechaza un cupón inactivo", async () => {
    const inactiveCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `INACT${ts}`,
        discountType: "FIXED",
        discountValue: 3000,
        active: false,
      },
    });
    createdCouponIds.push(inactiveCoupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: `INACT${ts}`,
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /está inactivo/i);
  });

  // 9. Rechazar pedido que no cumple compra mínima
  test("9. Se rechaza un cupón si el subtotal no alcanza la compra mínima", async () => {
    const highMinCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `HIGH${ts}`,
        discountType: "FIXED",
        discountValue: 5000,
        minimumOrderAmount: 900000, // Imposible con 1 producto de 20k-40k
        active: true,
      },
    });
    createdCouponIds.push(highMinCoupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: `HIGH${ts}`,
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /compra mínima|monto mínimo/i);
  });

  // 10. Rechazar cupón sin usos disponibles
  test("10. Se rechaza un cupón cuando se ha alcanzado su límite de usos", async () => {
    const limitCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `LIM${ts}`,
        discountType: "FIXED",
        discountValue: 2000,
        usageLimit: 1,
        usageCount: 1, // Ya gastado
        active: true,
      },
    });
    createdCouponIds.push(limitCoupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: `LIM${ts}`,
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /límite de usos/i);
  });

  // 11. Aplicar tope de descuento máximo correctamente
  test("11. En cupón de porcentaje, se respeta el tope máximo (maximumDiscount)", async () => {
    const capCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `CAP${ts}`,
        discountType: "PERCENTAGE",
        discountValue: 50, // 50%
        maximumDiscount: 8000, // Tope 8.000
        active: true,
      },
    });
    createdCouponIds.push(capCoupon.id);

    // Comprar 3 unidades: subtotal = productA.price * 3 (ej. 30.000 * 3 = 90.000, el 50% sería 45.000)
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 3 }],
        couponCode: `CAP${ts}`,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    // Debe aplicar exactamente el tope de 8000
    assert.strictEqual(order.discount, 8000);
    assert.strictEqual(order.total, order.subtotal - 8000);
  });

  // 12. Comprobar cálculo de domicilio y total
  test("12. Descuento se aplica sobre subtotal antes de domicilio y el total nunca es negativo", async () => {
    // Cupón con valor gigante para comprobar que nunca queda total negativo
    const hugeCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `HUGE${ts}`,
        discountType: "FIXED",
        discountValue: 99999999, // Descuento superior al subtotal
        active: true,
      },
    });
    createdCouponIds.push(hugeCoupon.id);

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantA.slug,
        orderType: "delivery",
        delivery: { address: "Calle 100 # 20-30" },
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productA.id, quantity: 1 }],
        couponCode: `HUGE${ts}`,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    // El descuento se limita al subtotal
    assert.strictEqual(order.discount, order.subtotal);
    // El total final es max(0, subtotal - discount) + deliveryFee = 0 + deliveryFee
    assert.strictEqual(order.total, restaurantA.deliveryFee);
    assert.ok(order.total >= 0, "El total nunca debe ser negativo");
  });

  // 13. Comprobar aislamiento multi-restaurante
  test("13. Cupón de Restaurante A no puede ser aplicado en pedidos de Restaurante B", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({
        restaurantSlug: restaurantB.slug,
        orderType: "pickup",
        customer: { name: "Cliente Tester", phone: "3007777777" },
        items: [{ productId: productB.id, quantity: 1 }],
        couponCode: `PCT${ts}`, // Código de Restaurante A
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /no pertenece a este restaurante|no existe/i);
  });

  // 14. Comprobar permisos administrativos
  test("14. Clientes regulares no pueden crear ni administrar cupones (403)", async () => {
    const resCreate = await fetch(`${baseUrl}/coupons/admin/restaurant/${restaurantA.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient, // Cliente no admin
      },
      body: JSON.stringify({
        code: `HACK${ts}`,
        discountType: "FIXED",
        discountValue: 50000,
      }),
    });

    assert.strictEqual(resCreate.status, 403);

    // Admin B no puede administrar cupones de Restaurante A
    const resCrossAdmin = await fetch(`${baseUrl}/coupons/admin/restaurant/${restaurantA.id}`, {
      method: "GET",
      headers: {
        Cookie: cookieAdminB, // Admin de Restaurante B intentando leer Restaurante A
      },
    });

    assert.strictEqual(resCrossAdmin.status, 403);
  });

  // 15. Comprobar que pedidos históricos mantienen sus snapshots
  test("15. Pedidos históricos conservan discount: 0 y pedidos con cupón conservan couponSnapshot inmutable", async () => {
    // 15.1 Consultar pedidos existentes creados antes del Sprint 3
    const priorOrders = await prisma.order.findMany({
      where: { couponId: null },
      take: 2,
    });

    for (const prior of priorOrders) {
      assert.strictEqual(prior.discount, 0, "Pedidos históricos deben tener discount = 0");
      assert.strictEqual(prior.couponId, null, "Pedidos históricos deben tener couponId = null");
      assert.strictEqual(prior.couponSnapshot, null, "Pedidos históricos deben tener couponSnapshot = null");
    }

    // 15.2 Verificar pedido creado con cupón en el test 5
    const latestOrderWithCoupon = await prisma.order.findFirst({
      where: { couponCode: `VALID${ts}` },
    });

    assert.ok(latestOrderWithCoupon);
    assert.strictEqual(latestOrderWithCoupon.discount, 4000);
    assert.ok(latestOrderWithCoupon.couponSnapshot);
    assert.strictEqual(latestOrderWithCoupon.couponSnapshot.discountApplied, 4000);
  });

  // 16. Comprobar límite de usos ante concurrencia
  test("16. Control atómico de concurrencia: cupón con límite 1 sólo puede usarse una vez ante solicitudes concurrentes", async () => {
    const concCoupon = await prisma.coupon.create({
      data: {
        restaurantId: restaurantA.id,
        code: `CONC${ts}`,
        discountType: "FIXED",
        discountValue: 1000,
        usageLimit: 1, // Límite estricto de 1 solo uso
        usageCount: 0,
        active: true,
      },
    });
    createdCouponIds.push(concCoupon.id);

    // Ejecutar 3 órdenes simultáneas intentando canjear el mismo cupón único
    const orderPayload = {
      restaurantSlug: restaurantA.slug,
      orderType: "pickup",
      customer: { name: "Cliente Concurrente", phone: "3007777777" },
      items: [{ productId: productA.id, quantity: 1 }],
      couponCode: `CONC${ts}`,
    };

    const promises = [1, 2, 3].map(() =>
      fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieClient,
        },
        body: JSON.stringify(orderPayload),
      }).then((res) => res.json().then((body) => ({ status: res.status, body })))
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status === 400);

    // Registrar IDs creados para limpieza
    for (const s of successes) {
      if (s.body?.data?.order?.orderId) {
        createdOrderIds.push(s.body.data.order.orderId);
      }
    }

    // Exactamente 1 orden debe haber tenido éxito
    assert.strictEqual(successes.length, 1, "Solo 1 solicitud concurrente debe tener éxito con usageLimit = 1");
    // Las otras 2 deben haber sido rechazadas
    assert.strictEqual(failures.length, 2, "Las demás solicitudes concurrentes deben ser rechazadas");
    assert.match(failures[0].body.error, /límite de usos/i);

    // Comprobar que en la base de datos el contador no superó el límite
    const refreshed = await prisma.coupon.findUnique({ where: { id: concCoupon.id } });
    assert.strictEqual(refreshed.usageCount, 1, "usageCount debe ser exactamente 1");
  });
});

