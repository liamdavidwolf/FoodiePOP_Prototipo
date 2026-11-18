const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");
const { checkCounterTableAvailable } = require("../src/services/order.service");

let server;
let baseUrl;

let clientUserA;
let clientUserB;
let adminUser;
let cookieUserA;
let cookieUserB;
let cookieAdmin;

let testRestaurant;
let testProduct;
let testOption;

// Fase 7A: indica si la tabla de contadores está disponible en Neon
let counterTableReady = false;

const createdOrderIds = [];
const createdUserIds = [];

before(async () => {
  // Iniciar servidor en puerto libre
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  // Detectar si la migración de Fase 7A está aplicada (tabla de contadores disponible)
  counterTableReady = await checkCounterTableAvailable();
  if (!counterTableReady) {
    console.warn(
      "\n[orders.test.js] AVISO: La tabla restaurant_order_counters no existe en Neon.\n" +
      "Los tests de creación de pedidos se omitirán hasta que la migración de Fase 7A sea aplicada.\n"
    );
  }

  // Obtener restaurante, producto y opciones existentes en Neon
  testRestaurant = await prisma.restaurant.findFirst({
    where: { slug: "la-esquina-food", active: true },
    include: {
      products: {
        where: { active: true, available: true },
        include: { options: { where: { active: true } } },
      },
    },
  });

  assert.ok(testRestaurant, "Debe existir al menos un restaurante activo en Neon");
  testProduct = testRestaurant.products.find((p) => p.options.length > 0) || testRestaurant.products[0];
  assert.ok(testProduct, "Debe existir al menos un producto activo");
  testOption = testProduct.options[0];

  // Crear usuario Cliente A
  const ts = Date.now();
  const resRegA = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente A",
      email: `client_a_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3001111111",
    }),
  });
  const dataA = await resRegA.json();
  clientUserA = dataA.data.user;
  cookieUserA = resRegA.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUserA.id);

  // Crear usuario Cliente B
  const resRegB = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente B",
      email: `client_b_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3002222222",
    }),
  });
  const dataB = await resRegB.json();
  clientUserB = dataB.data.user;
  cookieUserB = resRegB.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUserB.id);

  // Crear usuario Admin directamente en DB para pruebas de panel
  const bcrypt = require("bcryptjs");
  const adminDb = await prisma.user.create({
    data: {
      name: "Admin Tester",
      email: `admin_${ts}@foodiepop.test`,
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
});

after(async () => {
  // Limpieza de datos de prueba en Neon
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Error al limpiar pedidos de prueba:", e.message);
    }
  }

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

describe("FoodiePOP — Suite de Pruebas de Pedidos e Historial (Etapa 3)", () => {
  let createdOrderA;

  test("1. Creación de un pedido válido y cálculo estricto en el servidor", async () => {
    const payload = {
      restaurantSlug: testRestaurant.slug,
      orderType: "delivery",
      delivery: {
        address: "Calle 100 #15-20",
        reference: "Apto 301",
      },
      customer: {
        name: "Cliente A",
        phone: "3001111111",
      },
      items: [
        {
          productId: testProduct.id,
          quantity: 2,
          selectedOptions: testOption ? [{ id: testOption.id }] : [],
          notes: "Término medio por favor",
        },
      ],
      paymentMethod: "cash",
      notes: "Timbre no funciona",
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201, `Debería ser 201. Error: ${json.error}`);
    assert.ok(json.data.order, "Debe contener objeto order");

    const order = json.data.order;
    createdOrderA = order;
    createdOrderIds.push(order.orderId);

    // Verificaciones de cálculo en servidor
    const expectedOptionPrice = testOption ? testOption.price : 0;
    const expectedSubtotal = (testProduct.price + expectedOptionPrice) * 2;
    const expectedDeliveryFee = testRestaurant.deliveryFee;
    const expectedTotal = expectedSubtotal + expectedDeliveryFee;

    assert.strictEqual(order.subtotal, expectedSubtotal, "Subtotal calculado por el servidor");
    assert.strictEqual(order.deliveryFee, expectedDeliveryFee, "Costo de domicilio oficial");
    assert.strictEqual(order.total, expectedTotal, "Total exacto");
    assert.strictEqual(order.status, "received", "Estado inicial debe ser received");
    assert.ok(
      /^\d{6}$/.test(order.orderNumber),
      `El número de orden debe tener formato de 6 dígitos numéricos (Fase 7A). Recibido: ${order.orderNumber}`
    );
    assert.strictEqual(order.items.length, 1);
    assert.strictEqual(order.items[0].name, testProduct.name, "Snapshot histórico del nombre");
    assert.strictEqual(order.items[0].unitPrice, testProduct.price, "Snapshot histórico del precio");
  });

  test("2. Rechazo de usuario no autenticado", async () => {
    const resCreate = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: testProduct.id, quantity: 1 }] }),
    });
    assert.strictEqual(resCreate.status, 401, "No autenticado al crear pedido debe responder 401");

    const resList = await fetch(`${baseUrl}/orders`, {
      method: "GET",
    });
    assert.strictEqual(resList.status, 401, "No autenticado al listar pedidos debe responder 401");
  });

  test("3. Intento de consultar pedido de otro usuario debe responder 403 Forbidden", async () => {
    // Cliente B intenta consultar el pedido de Cliente A
    const res = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}`, {
      method: "GET",
      headers: {
        Cookie: cookieUserB,
      },
    });

    assert.strictEqual(res.status, 403, "Cliente B no debe tener acceso al pedido de Cliente A");
    const json = await res.json();
    assert.ok(json.error.includes("autorización") || json.error.includes("permiso"));
  });

  test("4. Cliente dueño y administrador sí pueden consultar el pedido", async () => {
    // Cliente A (dueño)
    const resOwner = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}`, {
      method: "GET",
      headers: { Cookie: cookieUserA },
    });
    assert.strictEqual(resOwner.status, 200);

    // Administrador
    const resAdmin = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}`, {
      method: "GET",
      headers: { Cookie: cookieAdmin },
    });
    assert.strictEqual(resAdmin.status, 200);
  });

  test("5. Precio manipulado desde el frontend debe ser ignorado por el servidor", async () => {
    const forgedPayload = {
      restaurantSlug: testRestaurant.slug,
      orderType: "pickup",
      items: [
        {
          productId: testProduct.id,
          quantity: 1,
          price: 1,       // Intento de hackear precio unitario a $1 COP
          unitPrice: 1,
          subtotal: 1,    // Intento de hackear subtotal a $1 COP
        },
      ],
      total: 1,           // Intento de hackear total a $1 COP
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify(forgedPayload),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    createdOrderIds.push(json.data.order.orderId);

    // El servidor debe haber calculado el precio real de la BD
    assert.strictEqual(
      json.data.order.total,
      testProduct.price,
      "El total DEBE ser el precio real de la base de datos, ignorando el $1 enviado"
    );
  });

  test("6. Producto inexistente o inactivo debe ser rechazado", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        items: [{ productId: "cmv_fake_non_existent_product_123", quantity: 1 }],
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("no existe") || json.error.includes("disponible"));
  });

  test("7. Adicional u opción inexistente debe ser rechazada", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptions: [{ id: "cmv_fake_option_999" }],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes("opción"));
  });

  test("8. Cantidades inválidas (0, negativas, decimales) deben ser rechazadas", async () => {
    const testCases = [0, -2, 1.5, "dos"];

    for (const qty of testCases) {
      const res = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieUserA,
        },
        body: JSON.stringify({
          restaurantSlug: testRestaurant.slug,
          items: [{ productId: testProduct.id, quantity: qty }],
        }),
      });

      assert.strictEqual(res.status, 400, `Cantidad "${qty}" debe responder 400`);
    }
  });

  test("9. Pedido vacío debe ser rechazado", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        items: [],
      }),
    });

    assert.strictEqual(res.status, 400);
  });

  test("10. Atomicidad transaccional: fallo con producto inválido no guarda nada", async () => {
    const countBefore = await prisma.order.count();

    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        items: [
          { productId: testProduct.id, quantity: 1 },
          { productId: "cmv_non_existent_fake_item", quantity: 1 },
        ],
      }),
    });

    assert.strictEqual(res.status, 400);
    const countAfter = await prisma.order.count();
    assert.strictEqual(countAfter, countBefore, "No deben quedar registros huérfanos tras un error");
  });

  test("11. Persistencia real en PostgreSQL (Neon)", async () => {
    const dbOrder = await prisma.order.findUnique({
      where: { id: createdOrderA.orderId },
      include: { items: true },
    });

    assert.ok(dbOrder, "El pedido debe existir en la tabla orders de Neon");
    assert.strictEqual(dbOrder.userId, clientUserA.id);
    assert.strictEqual(dbOrder.restaurantId, testRestaurant.id);
    assert.strictEqual(dbOrder.items.length, 1);
    assert.strictEqual(dbOrder.items[0].productId, testProduct.id);
    assert.strictEqual(dbOrder.items[0].quantity, 2);
    assert.strictEqual(typeof dbOrder.items[0].subtotal, "number");
  });

  test("12. Consulta de historial del cliente vía GET /api/v1/orders", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "GET",
      headers: { Cookie: cookieUserA },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data), "Debe responder un array con los pedidos del cliente");
    assert.ok(json.data.length >= 1, "Debe incluir el pedido creado");
    assert.strictEqual(json.data[0].userId, clientUserA.id);
  });

  test("13. Actualización de estado de pedido y validación de transiciones", async () => {
    // 1. Transición válida: RECEIVED -> CONFIRMED (por Admin)
    const resUpdate = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });

    assert.strictEqual(resUpdate.status, 200);
    const jsonUpdate = await resUpdate.json();
    assert.strictEqual(jsonUpdate.data.order.status, "confirmed");

    // 2. Transición inválida: CONFIRMED -> DELIVERED (no se puede saltar PREPARING/READY)
    const resInvalid = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdmin,
      },
      body: JSON.stringify({ status: "DELIVERED" }),
    });

    assert.strictEqual(resInvalid.status, 400, "Transición no permitida debe ser rechazada");

    // 3. Intento de actualización por cliente normal (debe responder 403)
    const resClientAttempt = await fetch(`${baseUrl}/orders/${createdOrderA.orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieUserA,
      },
      body: JSON.stringify({ status: "PREPARING" }),
    });

    assert.strictEqual(resClientAttempt.status, 403);
  });
});
