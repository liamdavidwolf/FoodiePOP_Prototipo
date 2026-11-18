const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const app = require("../src/index");
const prisma = require("../src/lib/prisma");

let server;
let baseUrl;

// Guardamos correos de prueba generados para limpiarlos al final si se desea
const createdTestUserIds = [];

before(async () => {
  // Iniciar servidor en puerto libre efímero para pruebas
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  // Limpiar usuarios de prueba en la base de datos Neon
  if (createdTestUserIds.length > 0) {
    try {
      await prisma.user.deleteMany({
        where: { id: { in: createdTestUserIds } },
      });
    } catch (err) {
      console.warn("Advertencia al limpiar usuarios de prueba:", err.message);
    }
  }

  await prisma.$disconnect();
  await new Promise((resolve) => server.close(resolve));
});

describe("FoodiePOP — Suite de Pruebas de Autenticación y Menú", () => {
  const timestamp = Date.now();
  const validEmail = `cliente_${timestamp}@foodiepop.test`;
  const validPassword = "SecurePass2025!";
  let sessionCookie = "";

  test("1. Registro correcto de un cliente y asignación de cookie HttpOnly", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cliente De Prueba",
        email: validEmail,
        password: validPassword,
        phone: "3001234567",
      }),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201, `Debería ser 201 Created.`);
    assert.ok(json.data, "Debe contener json.data");
    assert.ok(json.data.user, "Debe contener data.user");
    assert.strictEqual(json.data.user.email, validEmail);
    assert.strictEqual(json.data.user.name, "Cliente De Prueba");
    assert.strictEqual(json.data.user.role, "CLIENT");
    assert.strictEqual(json.data.user.passwordHash, undefined, "Nunca debe retornar el hash");

    createdTestUserIds.push(json.data.user.id);

    // Verificar cookie
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Debe incluir encabezado Set-Cookie");
    assert.ok(setCookie.includes("foodiepop_token="), "Debe incluir cookie foodiepop_token");
    assert.ok(setCookie.toLowerCase().includes("httponly"), "La cookie DEBE ser HttpOnly");
  });

  test("2. Rechazo de correo inválido", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Correo Malo",
        email: "correo-invalido-sin-arroba",
        password: "ValidPassword123!",
      }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, "Debe retornar mensaje de error");
  });

  test("3. Rechazo de contraseñas que no cumplan la política definida", async () => {
    // Caso: Menor a 8 caracteres
    const resShort = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Contraseña Corta",
        email: `short_${Date.now()}@foodiepop.test`,
        password: "Pass1",
      }),
    });
    assert.strictEqual(resShort.status, 400);

    // Caso: Sin números (solo letras)
    const resNoNumber = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Sin Numero",
        email: `nonumber_${Date.now()}@foodiepop.test`,
        password: "Sololetraslargas",
      }),
    });
    assert.strictEqual(resNoNumber.status, 400);
  });

  test("4. Rechazo de correos duplicados (incluso con mayúsculas y espacios)", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cliente Duplicado",
        email: `  ${validEmail.toUpperCase()}  `,
        password: "AnotherPassword123!",
      }),
    });

    assert.strictEqual(res.status, 409, "Debe rechazar con 409 Conflict");
    const json = await res.json();
    assert.ok(json.error.includes("registrado"));
  });

  test("5. Intento de escalamiento de privilegios a ADMIN/SUPERADMIN debe ser neutralizado", async () => {
    const hackerEmail = `hacker_${Date.now()}@foodiepop.test`;
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Intento Hacker",
        email: hackerEmail,
        password: "SuperSecret123!",
        role: "ADMIN",
        isAdmin: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    createdTestUserIds.push(json.data.user.id);

    // Verificar en la respuesta y en la base de datos que el rol asignado sea CLIENT
    assert.strictEqual(json.data.user.role, "CLIENT", "El rol retornado DEBE ser CLIENT");

    const dbUser = await prisma.user.findUnique({ where: { email: hackerEmail } });
    assert.strictEqual(dbUser.role, "CLIENT", "El rol en Neon DEBE ser forzado a CLIENT");
  });

  test("6. Inicio de sesión correcto y obtención de cookie de sesión", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validEmail,
        password: validPassword,
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.user);
    assert.strictEqual(json.data.user.email, validEmail);

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.ok(setCookie.includes("foodiepop_token="));
    sessionCookie = setCookie.split(";")[0]; // Obtener 'foodiepop_token=valor'
  });

  test("7. Inicio de sesión incorrecto (contraseña errónea y usuario inexistente)", async () => {
    // Contraseña incorrecta
    const resBadPass = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validEmail,
        password: "WrongPassword999!",
      }),
    });
    assert.strictEqual(resBadPass.status, 401);
    const jsonBadPass = await resBadPass.json();
    assert.strictEqual(jsonBadPass.error, "Credenciales inválidas. Verifica tu correo y contraseña.");

    // Usuario inexistente (debe devolver el mismo error genérico)
    const resNonExistent = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "inexistente_9999@foodiepop.test",
        password: "AnyPassword123!",
      }),
    });
    assert.strictEqual(resNonExistent.status, 401);
    const jsonNonExistent = await resNonExistent.json();
    assert.strictEqual(jsonNonExistent.error, "Credenciales inválidas. Verifica tu correo y contraseña.");
  });

  test("8. Recuperación de la sesión actual vía GET /api/v1/auth/me usando la cookie", async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.user.email, validEmail);
    assert.strictEqual(json.data.user.role, "CLIENT");
  });

  test("9. Rechazo de acceso a GET /api/v1/auth/me sin autenticación", async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
    });

    assert.strictEqual(res.status, 401);
  });

  test("10. Cierre de sesión (logout) y verificación de eliminación de cookie", async () => {
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie, "Logout debe enviar cabecera para expirar cookie");
    assert.ok(
      setCookie.includes("foodiepop_token=;") || setCookie.includes("Max-Age=0") || setCookie.includes("Expires="),
      "La cookie debe haber sido limpiada"
    );
  });

  test("11. Persistencia de los usuarios en la base de datos Neon (PostgreSQL)", async () => {
    const dbUser = await prisma.user.findUnique({
      where: { email: validEmail },
    });

    assert.ok(dbUser, "El usuario debe existir en Neon");
    assert.strictEqual(dbUser.email, validEmail);
    assert.ok(dbUser.passwordHash.startsWith("$2a$") || dbUser.passwordHash.startsWith("$2b$"), "La contraseña debe estar hasheada con bcrypt ($2a$/$2b$)");
    assert.strictEqual(dbUser.passwordHash.length, 60, "El hash bcrypt debe tener longitud de 60 caracteres");
    assert.notStrictEqual(dbUser.passwordHash, validPassword, "Nunca debe estar en texto plano");
  });

  test("12. Funcionamiento intacto del menú conectado a Neon", async () => {
    const resRestaurant = await fetch(`${baseUrl}/menu/restaurant/la-esquina-food`);
    assert.strictEqual(resRestaurant.status, 200);
    const restJson = await resRestaurant.json();
    assert.ok(restJson.data.name);

    const resProducts = await fetch(`${baseUrl}/menu/restaurant/la-esquina-food/products`);
    assert.strictEqual(resProducts.status, 200);
    const prodJson = await resProducts.json();
    assert.ok(Array.isArray(prodJson.data), "Debe ser lista de categorías con productos");
    assert.ok(prodJson.data.length > 0, "Debe tener categorías");
  });
});
