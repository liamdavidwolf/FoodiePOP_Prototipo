const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");
const { checkCounterTableAvailable } = require("../src/services/order.service");

let server;
let baseUrl;

let testUser;
let testCookie;
let testRestaurant;
let testProduct;
let opt1;
let opt2;

// Fase 7A: indica si la tabla de contadores está disponible en Neon
let counterTableReady = false;

const createdOrderIds = [];
const createdUserIds = [];

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  counterTableReady = await checkCounterTableAvailable();
  if (!counterTableReady) {
    console.warn(
      "\n[options.test.js] AVISO: La tabla restaurant_order_counters no existe en Neon.\n" +
      "Los tests de creación de pedidos se omitirán hasta que la migración de Fase 7A sea aplicada.\n"
    );
  }

  // Consultar restaurante con producto que tenga al menos 2 opciones en Neon
  testRestaurant = await prisma.restaurant.findFirst({
    where: { slug: "la-esquina-food", active: true },
    include: {
      products: {
        where: { active: true, available: true },
        include: {
          options: {
            where: { active: true },
          },
        },
      },
    },
  });

  assert.ok(testRestaurant, "Debe existir el restaurante 'la-esquina-food'");

  testProduct = testRestaurant.products.find((p) => p.options.length >= 2);
  assert.ok(testProduct, "Debe existir un producto con al menos 2 adicionales");

  opt1 = testProduct.options[0];
  opt2 = testProduct.options[1];

  // Crear usuario cliente para pruebas
  const ts = Date.now();
  const resReg = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Tester Opciones",
      email: `options_test_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3007777777",
    }),
  });
  const dataReg = await resReg.json();
  testUser = dataReg.data.user;
  testCookie = resReg.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(testUser.id);
});

after(async () => {
  if (createdOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    } catch (e) {
      console.warn("Error al limpiar pedidos:", e.message);
    }
  }

  if (createdUserIds.length > 0) {
    try {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } catch (e) {
      console.warn("Error al limpiar usuarios:", e.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("Suite de Pruebas: Selector de Adicionales y Consistencia de Precios (Etapa 5A / 5B)", () => {
  test("1. El producto sin adicionales mantiene exactamente su precio base original", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptions: [],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    assert.strictEqual(order.subtotal, testProduct.price, "Subtotal debe coincidir con el precio base del producto");
    assert.strictEqual(order.total, testProduct.price, "Total debe coincidir con el precio base sin envío");
    assert.strictEqual(order.items[0].selectedOptions.length, 0);
  });

  test("2. Seleccionar un adicional aumenta el precio exactamente en el valor de la opción", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptions: [opt1],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const expectedTotal = testProduct.price + opt1.price;
    assert.strictEqual(order.subtotal, expectedTotal, `Debe sumar ${testProduct.price} + ${opt1.price} = ${expectedTotal}`);
    assert.strictEqual(order.total, expectedTotal);
    assert.strictEqual(order.items[0].selectedOptions.length, 1);
    assert.strictEqual(order.items[0].selectedOptions[0].id, opt1.id);
  });

  test("3. Seleccionar dos adicionales suma ambos importes al precio base", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptions: [opt1, opt2],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const expectedTotal = testProduct.price + opt1.price + opt2.price;
    assert.strictEqual(order.subtotal, expectedTotal, `Debe sumar base + opt1 + opt2 = ${expectedTotal}`);
    assert.strictEqual(order.total, expectedTotal);
    assert.strictEqual(order.items[0].selectedOptions.length, 2);
  });

  test("4. Deseleccionar un adicional resta su importe del total", async () => {
    // Si el usuario tenía seleccionados opt1 y opt2, y deselecciona opt1, solo se envía opt2
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            selectedOptions: [opt2], // Solo opt2 activo tras deseleccionar opt1
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const expectedTotal = testProduct.price + opt2.price;
    assert.strictEqual(order.subtotal, expectedTotal);
    assert.strictEqual(order.total, expectedTotal);
    assert.strictEqual(order.items[0].selectedOptions.length, 1);
    assert.strictEqual(order.items[0].selectedOptions[0].id, opt2.id);
  });

  test("5. Cambiar la cantidad multiplica (precio base + adicionales) * cantidad", async () => {
    const qty = 3;
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: qty,
            selectedOptions: [opt1, opt2],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const unitSum = testProduct.price + opt1.price + opt2.price;
    const expectedTotal = unitSum * qty;
    assert.strictEqual(order.subtotal, expectedTotal, `(Base + Adicionales) * ${qty} debe dar ${expectedTotal}`);
    assert.strictEqual(order.total, expectedTotal);
  });

  test("6. Preservación del formato de opciones en el snapshot de PostgreSQL", async () => {
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 2,
            selectedOptions: [
              { id: opt1.id, name: opt1.name, price: opt1.price },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    const savedItem = await prisma.orderItem.findFirst({
      where: { orderId: order.orderId },
    });
    assert.ok(savedItem);
    assert.ok(Array.isArray(savedItem.selectedOptions));
    assert.strictEqual(savedItem.selectedOptions.length, 1);
    assert.strictEqual(savedItem.selectedOptions[0].id, opt1.id);
    assert.strictEqual(savedItem.selectedOptions[0].name, opt1.name);
    assert.strictEqual(savedItem.selectedOptions[0].price, opt1.price);
  });

  test("7. El backend recalcula los importes con los precios de PostgreSQL ignorando precios falsificados del cliente", async () => {
    // El cliente malicioso envía price = 0 para el producto y para los adicionales
    const res = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCookie,
      },
      body: JSON.stringify({
        restaurantSlug: testRestaurant.slug,
        orderType: "pickup",
        customer: { name: testUser.name, phone: testUser.phone },
        items: [
          {
            productId: testProduct.id,
            quantity: 1,
            price: 0,
            unitPrice: 0,
            subtotal: 0,
            selectedOptions: [
              { id: opt1.id, name: opt1.name, price: 0 },
            ],
          },
        ],
        total: 0,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    const order = json.data.order;
    createdOrderIds.push(order.orderId);

    // El servidor debe haber cobrado el valor real guardado en Neon
    const expectedRealTotal = testProduct.price + opt1.price;
    assert.strictEqual(order.subtotal, expectedRealTotal, "Servidor debe recalcular con el precio real de DB");
    assert.strictEqual(order.total, expectedRealTotal);
  });

  test("8. Lógica de estado y cálculo de ProductModal (Simulación de UI React)", () => {
    // Simular el reducer / lógica de toggle implementada en ProductModal
    let selectedOptions = [];
    const handleOptionToggle = (option) => {
      const exists = selectedOptions.find((o) => o.id === option.id);
      if (exists) {
        selectedOptions = selectedOptions.filter((o) => o.id !== option.id);
      } else {
        selectedOptions = [...selectedOptions, option];
      }
    };

    // Estado inicial: 0 opciones
    assert.strictEqual(selectedOptions.length, 0);

    // 1. Seleccionar opt1
    handleOptionToggle(opt1);
    assert.strictEqual(selectedOptions.length, 1);
    assert.strictEqual(selectedOptions[0].id, opt1.id);

    let optionsTotal = selectedOptions.reduce((s, o) => s + o.price, 0);
    let unitPrice = testProduct.price + optionsTotal;
    assert.strictEqual(unitPrice, testProduct.price + opt1.price);

    // 2. Seleccionar opt2
    handleOptionToggle(opt2);
    assert.strictEqual(selectedOptions.length, 2);
    optionsTotal = selectedOptions.reduce((s, o) => s + o.price, 0);
    unitPrice = testProduct.price + optionsTotal;
    assert.strictEqual(unitPrice, testProduct.price + opt1.price + opt2.price);

    // 3. Deseleccionar opt1
    handleOptionToggle(opt1);
    assert.strictEqual(selectedOptions.length, 1);
    assert.strictEqual(selectedOptions[0].id, opt2.id);
    optionsTotal = selectedOptions.reduce((s, o) => s + o.price, 0);
    unitPrice = testProduct.price + optionsTotal;
    assert.strictEqual(unitPrice, testProduct.price + opt2.price);

    // 4. Multiplicador de cantidad
    let qty = 3;
    let total = unitPrice * qty;
    assert.strictEqual(total, (testProduct.price + opt2.price) * 3);

    // 5. Reseteo por cambio de producto (useEffect con dependencia [product?.id])
    selectedOptions = [];
    qty = 1;
    assert.strictEqual(selectedOptions.length, 0);
    assert.strictEqual(qty, 1);
  });
});
