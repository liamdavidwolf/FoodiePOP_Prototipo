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

let kitchenUserA;
let cookieKitchenA;

let clientUser;
let cookieClient;

let restaurantA;
let restaurantB;

const createdCategoryIds = [];
const createdProductIds = [];
const createdUserIds = [];
const createdRestaurantIds = [];

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
    where: { slug: "la-esquina-food", active: true },
    include: { categories: true },
  });
  assert.ok(restaurantA, "Debe existir 'la-esquina-food'");

  // 2. Admin para Restaurante A
  const adminDbA = await prisma.user.create({
    data: {
      name: "Admin Categorías A",
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

  // 3. Usuario Cocina (KITCHEN) para Restaurante A
  const kitchenDbA = await prisma.user.create({
    data: {
      name: "Cocina Categorías A",
      email: `kitchen_cat_a_${ts}@foodiepop.test`,
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

  const resLoginKitchen = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: kitchenDbA.email, password: "KitchenPass123!" }),
  });
  cookieKitchenA = resLoginKitchen.headers.get("set-cookie").split(";")[0];

  // 4. Restaurante Secundario (B) para pruebas de Aislamiento
  restaurantB = await prisma.restaurant.create({
    data: {
      slug: `cat-isol-rest-${ts}`,
      name: "Restaurante B Categorías",
      deliveryFee: 4500,
    },
  });
  createdRestaurantIds.push(restaurantB.id);

  // 5. Admin para Restaurante B
  const adminDbB = await prisma.user.create({
    data: {
      name: "Admin Categorías B",
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

  // 6. Usuario Cliente para pruebas de permisos
  const resRegClient = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Categorías Tester",
      email: `client_cat_${ts}@foodiepop.test`,
      password: "Password123!",
      phone: "3009999999",
    }),
  });
  const dataClient = await resRegClient.json();
  clientUser = dataClient.data.user;
  cookieClient = resRegClient.headers.get("set-cookie").split(";")[0];
  createdUserIds.push(clientUser.id);
});

after(async () => {
  // Limpieza de productos creados en pruebas
  if (createdProductIds.length > 0) {
    try {
      await prisma.productOption.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.orderItem.deleteMany({ where: { productId: { in: createdProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    } catch (e) {
      console.warn("Error limpiando productos:", e.message);
    }
  }

  // Limpieza de categorías creadas en pruebas
  if (createdCategoryIds.length > 0) {
    try {
      await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    } catch (e) {
      console.warn("Error limpiando categorías:", e.message);
    }
  }

  // Limpieza de restaurantes creados
  if (createdRestaurantIds.length > 0) {
    try {
      await prisma.userRestaurantRole.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } });
      await prisma.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } });
    } catch (e) {
      console.warn("Error limpiando restaurantes:", e.message);
    }
  }

  // Limpieza de usuarios creados
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

describe("Gestión Completa de Categorías de Menú (Sprint Final)", () => {
  let createdCatId;
  const ts = Date.now().toString().slice(-6);

  // 1. Crear categoría
  test("1. Admin crea una nueva categoría válida en su restaurante", async () => {
    const res = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: `Tacos y Burritos ${ts}`,
        description: "Comida mexicana artesanal preparada al momento",
        position: 10,
        active: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.ok(json.data.id);
    assert.strictEqual(json.data.name, `Tacos y Burritos ${ts}`);
    assert.strictEqual(json.data.description, "Comida mexicana artesanal preparada al momento");
    assert.strictEqual(json.data.position, 10);
    assert.strictEqual(json.data.active, true);
    assert.strictEqual(json.data.productsCount, 0);

    createdCatId = json.data.id;
    createdCategoryIds.push(json.data.id);
  });

  // 2. Rechazar duplicados o datos inválidos
  test("2. Rechaza creación de categoría con nombre duplicado o longitud menor a 2 caracteres", async () => {
    // Duplicado en el mismo restaurante
    const resDup = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: `Tacos y Burritos ${ts}`,
      }),
    });

    assert.strictEqual(resDup.status, 409);
    const jsonDup = await resDup.json();
    assert.match(jsonDup.error, /ya existe una categoría/i);

    // Nombre inválido (vacío o 1 caracter)
    const resShort = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: "A",
      }),
    });

    assert.strictEqual(resShort.status, 400);
    const jsonShort = await resShort.json();
    assert.match(jsonShort.error, /al menos 2 caracteres/i);
  });

  // 3. Listar categorías por restaurante (admin y pública)
  test("3. Listar categorías administrativas y públicas del restaurante", async () => {
    // Listado administrativo
    const resAdmin = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/admin-categories`, {
      headers: { Cookie: cookieAdminA },
    });
    assert.strictEqual(resAdmin.status, 200);
    const jsonAdmin = await resAdmin.json();
    assert.ok(Array.isArray(jsonAdmin.data));
    const found = jsonAdmin.data.find((c) => c.id === createdCatId);
    assert.ok(found, "Debe contener la categoría recién creada");
    assert.strictEqual(found.productsCount, 0);

    // Listado público
    const resPublic = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`);
    assert.strictEqual(resPublic.status, 200);
    const jsonPublic = await resPublic.json();
    assert.ok(Array.isArray(jsonPublic.data));
    assert.ok(jsonPublic.data.some((c) => c.id === createdCatId));
  });

  // 4. Editar categoría
  test("4. Admin edita el nombre y la posición de una categoría existente", async () => {
    const res = await fetch(`${baseUrl}/menu/categories/${createdCatId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: `Tex-Mex Especial ${ts}`,
        position: 12,
        description: "Actualizada con nuevas recetas Tex-Mex",
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.name, `Tex-Mex Especial ${ts}`);
    assert.strictEqual(json.data.position, 12);
    assert.strictEqual(json.data.description, "Actualizada con nuevas recetas Tex-Mex");
  });

  // 5. Activar y desactivar categoría
  test("5. Admin desactiva una categoría y se oculta del menú público; se reactiva y reaparece", async () => {
    // Desactivar
    const resOff = await fetch(`${baseUrl}/menu/categories/${createdCatId}/availability`, {
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

    // Comprobar que no aparece en el menú público del cliente
    const resPubOff = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`);
    const jsonPubOff = await resPubOff.json();
    assert.ok(!jsonPubOff.data.some((c) => c.id === createdCatId), "Categoría inactiva no debe estar en menú público");

    // Reactivar
    const resOn = await fetch(`${baseUrl}/menu/categories/${createdCatId}/availability`, {
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

    // Comprobar que reaparece en el menú público
    const resPubOn = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`);
    const jsonPubOn = await resPubOn.json();
    assert.ok(jsonPubOn.data.some((c) => c.id === createdCatId), "Categoría activa debe volver a aparecer");
  });

  // 6. Asociar productos a la categoría
  test("6. Permite crear y asociar productos a la categoría creada", async () => {
    const resProd = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminA,
      },
      body: JSON.stringify({
        name: `Taco Al Pastor ${ts}`,
        description: "Taco con cerdo adobado y piña",
        price: 18000,
        cost: 6000,
        categoryId: createdCatId,
      }),
    });

    assert.strictEqual(resProd.status, 201);
    const jsonProd = await resProd.json();
    assert.strictEqual(jsonProd.data.categoryId, createdCatId);
    createdProductIds.push(jsonProd.data.id);

    // Verificar que el conteo en admin-categories ahora es 1
    const resAdmin = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/admin-categories`, {
      headers: { Cookie: cookieAdminA },
    });
    const jsonAdmin = await resAdmin.json();
    const cat = jsonAdmin.data.find((c) => c.id === createdCatId);
    assert.strictEqual(cat.productsCount, 1);
  });

  // 7. Evitar eliminar categorías con productos asociados (Regla 6)
  test("7. Impide eliminar una categoría que tiene productos asociados (400)", async () => {
    const resDel = await fetch(`${baseUrl}/menu/categories/${createdCatId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookieAdminA,
      },
    });

    assert.strictEqual(resDel.status, 400);
    const jsonDel = await resDel.json();
    assert.match(jsonDel.error, /no es posible eliminar la categoría/i);
    assert.match(jsonDel.error, /producto\(s\) asociado\(s\)/i);

    // Comprobar que la categoría sigue existiendo
    const dbCat = await prisma.category.findUnique({ where: { id: createdCatId } });
    assert.ok(dbCat, "La categoría no debe haberse borrado");
  });

  // 8. Eliminar categoría vacía
  test("8. Permite eliminar de forma segura una categoría cuando no tiene productos asociados", async () => {
    // Crear categoría temporal sin productos
    const tempCat = await prisma.category.create({
      data: {
        restaurantId: restaurantA.id,
        name: `Temporal Vacia ${ts}`,
        position: 99,
        active: true,
      },
    });

    const resDel = await fetch(`${baseUrl}/menu/categories/${tempCat.id}`, {
      method: "DELETE",
      headers: {
        Cookie: cookieAdminA,
      },
    });

    assert.strictEqual(resDel.status, 200);
    const jsonDel = await resDel.json();
    assert.strictEqual(jsonDel.action, "deleted");

    // Verificar en la BD que fue eliminada
    const dbCheck = await prisma.category.findUnique({ where: { id: tempCat.id } });
    assert.strictEqual(dbCheck, null);
  });

  // 9. Aislamiento multi-restaurante
  test("9. Admin de Restaurante B no puede consultar, crear, editar ni eliminar categorías de Restaurante A (403)", async () => {
    // Consultar admin-categories de Rest A con token de Admin B
    const resGet = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/admin-categories`, {
      headers: { Cookie: cookieAdminB },
    });
    assert.strictEqual(resGet.status, 403);

    // Crear categoría en Rest A con token de Admin B
    const resCreate = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminB,
      },
      body: JSON.stringify({ name: `Infiltrado ${ts}` }),
    });
    assert.strictEqual(resCreate.status, 403);

    // Editar categoría de Rest A con token de Admin B
    const resEdit = await fetch(`${baseUrl}/menu/categories/${createdCatId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieAdminB,
      },
      body: JSON.stringify({ name: "Intento Hacker" }),
    });
    assert.strictEqual(resEdit.status, 403);

    // Eliminar categoría de Rest A con token de Admin B
    const resDelete = await fetch(`${baseUrl}/menu/categories/${createdCatId}`, {
      method: "DELETE",
      headers: { Cookie: cookieAdminB },
    });
    assert.strictEqual(resDelete.status, 403);
  });

  // 10. Validar permisos: no autenticado, CLIENT y KITCHEN
  test("10. Rechaza solicitudes de no autenticados (401), clientes (403) y rol operativo KITCHEN (403)", async () => {
    // 10.1 No autenticado
    const resAnon = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/admin-categories`);
    assert.strictEqual(resAnon.status, 401);

    // 10.2 Cliente
    const resClient = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieClient,
      },
      body: JSON.stringify({ name: "Cat Cliente" }),
    });
    assert.strictEqual(resClient.status, 403);

    // 10.3 Rol KITCHEN (no tiene permisos de gestión de categorías)
    const resKitchenCreate = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieKitchenA,
      },
      body: JSON.stringify({ name: "Cat Cocina" }),
    });
    assert.strictEqual(resKitchenCreate.status, 403);
  });

  // 11. Productos existentes siguen funcionando
  test("11. Productos preexistentes mantienen su categoría intacta y su funcionamiento normal", async () => {
    const resProds = await fetch(`${baseUrl}/menu/restaurant/${restaurantA.slug}/products`);
    assert.strictEqual(resProds.status, 200);
    const jsonProds = await resProds.json();
    assert.ok(Array.isArray(jsonProds.data));

    // Verificar que los productos iniciales tienen categoría y opciones
    const allProducts = jsonProds.data.flatMap((c) => c.products || []);
    const burger = allProducts.find((p) => p.name === "Classic Burger");
    assert.ok(burger, "Classic Burger debe seguir existiendo");
    assert.ok(burger.price > 0);
  });
});
