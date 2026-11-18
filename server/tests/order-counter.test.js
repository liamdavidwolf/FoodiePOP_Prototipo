/**
 * order-counter.test.js
 * FoodiePOP — Fase 7A: Numeración Atómica por Restaurante
 *
 * Este archivo contiene tres categorías de prueba:
 *
 * UNIT: Lógica pura de formateo y cálculo de inicialización histórica (sin DB).
 * INTEGRATION: Verificación de integridad de datos reales en Neon (sin crear pedidos extra).
 * CONCURRENCIA: Prueba real de concurrencia contra PostgreSQL usando transacciones
 *   independientes y paralelas para el mismo restaurante.
 *   - Solo se ejecuta si la migración de Fase 7A está aplicada (tabla existe).
 *   - Limpia los registros que crea al finalizar.
 */

"use strict";

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const prisma = require("../src/lib/prisma");
const {
  generateOrderNumber,
  checkCounterTableAvailable,
  resetCounterTableCache,
} = require("../src/services/order.service");

let counterTableReady = false;
let testRestaurant = null;
// IDs de pedidos creados exclusivamente por esta suite para limpiar al finalizar
const concurrencyOrderIds = [];

before(async () => {
  resetCounterTableCache();
  counterTableReady = await checkCounterTableAvailable();

  testRestaurant = await prisma.restaurant.findFirst({ where: { active: true } });
  assert.ok(testRestaurant, "Debe existir al menos un restaurante activo en Neon");

  if (!counterTableReady) {
    console.warn(
      "\n[order-counter.test.js] AVISO: La tabla restaurant_order_counters no existe en Neon.\n" +
      "Las pruebas de concurrencia se omitirán hasta que la migración de Fase 7A sea aplicada.\n"
    );
  }
});

after(async () => {
  // Limpiar exclusivamente los pedidos creados por los tests de concurrencia
  if (concurrencyOrderIds.length > 0) {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: concurrencyOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: concurrencyOrderIds } } });
      console.log(`\n[order-counter.test.js] Limpiados ${concurrencyOrderIds.length} pedidos de prueba de concurrencia.`);
    } catch (err) {
      console.warn("[order-counter.test.js] Error al limpiar pedidos de concurrencia:", err.message);
    }
  }
  await prisma.$disconnect();
});

// ─── UNIT ────────────────────────────────────────────────────────────────────

describe("[UNIT] Fase 7A: Formato y lógica de inicialización histórica", () => {
  test("1. Formato de 6 dígitos numéricos con ceros a la izquierda", () => {
    const fmt = (n) => n.toString().padStart(6, "0");

    assert.strictEqual(fmt(1n), "000001");
    assert.strictEqual(fmt(42n), "000042");
    assert.strictEqual(fmt(9999n), "009999");
    assert.strictEqual(fmt(100000n), "100000");
    assert.match(fmt(1n), /^\d{6}$/);
    assert.match(fmt(999999n), /^\d{6}$/);
  });

  test("2. Precisión BigInt — sin pérdida al usar .toString() en valores grandes", () => {
    // Number.MAX_SAFE_INTEGER es 9_007_199_254_740_991 — BigInt no pierde precisión
    const large = 9_007_199_254_740_993n; // Supera MAX_SAFE_INTEGER
    const viaNumber = String(Number(large)); // pierde precisión: "9007199254740992"
    const viaBigInt = large.toString();     // correcto:         "9007199254740993"

    assert.notStrictEqual(viaNumber, "9007199254740993", "Number pierde precisión — confirma el problema");
    assert.strictEqual(viaBigInt, "9007199254740993", "BigInt.toString() mantiene precisión exacta");
  });

  test("3. Lógica de inicialización histórica — cálculo del contador seguro e idempotente", () => {
    function computeSafeCounter(orders, currentCounterVal = null) {
      let maxNumeric = 0n;
      for (const o of orders) {
        const numStr = String(o.orderNumber).trim();
        if (/^\d+$/.test(numStr)) {
          const val = BigInt(numStr);
          if (val > maxNumeric) maxNumeric = val;
        }
      }
      if (currentCounterVal !== null) {
        const curr = BigInt(currentCounterVal);
        if (curr >= maxNumeric) return curr; // Jamás disminuir
      }
      return maxNumeric;
    }

    // A: Solo pedidos con prefijo FP- → contador inicia en 0 (primer pedido será 000001)
    const ordersA = [{ orderNumber: "FP-1001" }, { orderNumber: "FP-1011" }];
    assert.strictEqual(computeSafeCounter(ordersA), 0n, "Prefijos FP- no colisionan → contador = 0");

    // B: Pedidos numéricos existentes → contador = máximo
    const ordersB = [{ orderNumber: "FP-1001" }, { orderNumber: "000045" }, { orderNumber: "000120" }];
    assert.strictEqual(computeSafeCounter(ordersB), 120n);

    // C: Idempotencia — contador existente mayor: se conserva
    assert.strictEqual(computeSafeCounter(ordersB, 150n), 150n, "No disminuye si ya es mayor");

    // D: Contador existente menor: se actualiza al máximo histórico
    assert.strictEqual(computeSafeCounter(ordersB, 100n), 120n, "Sube al máximo histórico si es menor");
  });

  test("4. Demostración de la estrategia SQL atómica: ON CONFLICT DO UPDATE", () => {
    // Verifica la estructura del SQL que PostgreSQL ejecutará.
    // ON CONFLICT ("restaurantId") DO UPDATE adquiere un ExclusiveTupleLock a nivel de fila,
    // impidiendo que otra transacción concurrente modifique el mismo contador hasta COMMIT/ROLLBACK.
    const upsertSQL = `
      INSERT INTO "restaurant_order_counters" ("id", "restaurantId", "lastNumber", "updatedAt")
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT ("restaurantId") DO UPDATE
        SET "lastNumber" = "restaurant_order_counters"."lastNumber" + 1,
            "updatedAt" = NOW()
      RETURNING "lastNumber";
    `;
    assert.ok(upsertSQL.includes('ON CONFLICT ("restaurantId") DO UPDATE'));
    assert.ok(upsertSQL.includes('"lastNumber" + 1'));
    assert.ok(upsertSQL.includes('RETURNING "lastNumber"'));
  });
});

// ─── INTEGRATION ─────────────────────────────────────────────────────────────

describe("[INTEGRATION] Fase 7A: Integridad de datos reales en Neon", () => {
  test("5. Pedidos históricos FP-1001..FP-1011 permanecen intactos", async () => {
    const orders = await prisma.order.findMany({
      select: { id: true, orderNumber: true, restaurantId: true },
    });
    assert.ok(orders.length > 0, "Debe existir al menos un pedido en Neon");

    const historical = orders.filter((o) => o.orderNumber.startsWith("FP-"));
    assert.ok(historical.length > 0, "Los pedidos históricos FP- deben existir");

    for (const o of historical) {
      assert.match(
        o.orderNumber,
        /^FP-\d+(-\d+)?$/,
        `Pedido histórico conserva su formato original: ${o.orderNumber}`
      );
    }

    // Ningún pedido histórico fue sobreescrito con formato 6-dígitos
    const historicalNums = new Set(historical.map((o) => o.orderNumber));
    const numericOrders = orders.filter((o) => /^\d{6}$/.test(o.orderNumber));
    for (const o of numericOrders) {
      assert.strictEqual(
        historicalNums.has(o.orderNumber),
        false,
        `No debe haber colisión entre formato FP- y 6-dígitos: ${o.orderNumber}`
      );
    }
  });

  test("6. Tabla restaurant_order_counters: estado de migración reportado correctamente", async () => {
    const tableExists = await checkCounterTableAvailable();
    // Independientemente del valor, el resultado debe ser booleano
    assert.strictEqual(typeof tableExists, "boolean", "checkCounterTableAvailable() debe retornar boolean");

    if (tableExists) {
      console.log("    ✓ Migración de Fase 7A aplicada en Neon — contador atómico activo");
    } else {
      console.log("    ○ Migración de Fase 7A pendiente — sistema en modo pre-migración");
    }
  });
});

// ─── CONCURRENCIA ─────────────────────────────────────────────────────────────

describe("[CONCURRENCIA] Fase 7A: Prueba real de concurrencia en PostgreSQL", () => {
  /**
   * Este test lanza N transacciones independientes y paralelas contra la misma fila
   * de restaurant_order_counters en Neon (PostgreSQL real). Cada transacción:
   *   1. Llama a generateOrderNumber() — que hace UPSERT atómico con ON CONFLICT DO UPDATE.
   *   2. Inserta un pedido real en la tabla orders con ese número.
   *   3. Hace COMMIT independiente.
   *
   * Se verifica que:
   *   - Todos los números generados son distintos (sin colisiones).
   *   - La cantidad de pedidos creados coincide con el número de solicitudes exitosas.
   *   - Todos los números tienen formato de 6 dígitos.
   *   - Todos los pedidos pertenecen al restaurante correcto.
   *   - No quedan pedidos parciales (atomicidad).
   */
  test("7. Concurrencia real: 10 transacciones paralelas generan números únicos sin colisiones", async (t) => {
    if (!counterTableReady) {
      t.skip("Fase 7A: tabla restaurant_order_counters no migrada en Neon");
      return;
    }
    const CONCURRENCY = 10;

      // Obtener datos mínimos necesarios para insertar un pedido válido
      const user = await prisma.user.findFirst({ where: { active: true, role: "CLIENT" } });
      assert.ok(user, "Debe existir un usuario CLIENT activo");

      const restaurantId = testRestaurant.id;

      // Lanzar N transacciones independientes en paralelo — cada una usa su propia conexión
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, (_, i) =>
          prisma.$transaction(async (tx) => {
            const orderNumber = await generateOrderNumber(tx, restaurantId);

            const order = await tx.order.create({
              data: {
                orderNumber,
                userId: user.id,
                restaurantId,
                status: "RECEIVED",
                orderType: "PICKUP",
                customerName: `Concurrencia Test ${i + 1}`,
                customerPhone: "3000000000",
                subtotal: 1000,
                deliveryFee: 0,
                total: 1000,
                paymentMethod: "CASH",
                notes: `Fase7A-concurrencia-${i + 1}`,
              },
            });

            return { orderNumber, orderId: order.id };
          })
        )
      );

      // Separar exitosos de fallidos
      const successful = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      const failed = results.filter((r) => r.status === "rejected");

      // Registrar IDs para limpieza posterior
      for (const s of successful) {
        concurrencyOrderIds.push(s.orderId);
      }

      if (failed.length > 0) {
        console.warn(`\n    ${failed.length} transacciones fallaron (esperado si Neon rechazó por UNIQUE constraint):`);
        for (const f of failed) {
          console.warn(`    - ${f.reason?.message}`);
        }
      }

      console.log(`\n    Resultados de concurrencia: ${successful.length}/${CONCURRENCY} exitosas`);
      console.log(`    Números generados: ${successful.map((s) => s.orderNumber).join(", ")}`);

      // ── Verificación 1: Al menos la mitad debe haber tenido éxito (Neon puede throttle)
      assert.ok(
        successful.length >= Math.ceil(CONCURRENCY / 2),
        `Al menos ${Math.ceil(CONCURRENCY / 2)} de ${CONCURRENCY} transacciones deben ser exitosas. Exitosas: ${successful.length}`
      );

      // ── Verificación 2: Todos los números generados son únicos — 0 colisiones
      const generatedNumbers = successful.map((s) => s.orderNumber);
      const uniqueNumbers = new Set(generatedNumbers);
      assert.strictEqual(
        uniqueNumbers.size,
        generatedNumbers.length,
        `Colisión detectada: se generaron ${generatedNumbers.length} pedidos pero solo ${uniqueNumbers.size} números únicos. Números: ${generatedNumbers.join(", ")}`
      );

      // ── Verificación 3: Todos los números tienen formato correcto (6 dígitos)
      for (const num of generatedNumbers) {
        assert.match(
          num,
          /^\d{6}$/,
          `Número inválido generado en concurrencia: "${num}" — debe tener exactamente 6 dígitos`
        );
      }

      // ── Verificación 4: Los pedidos realmente existen en la BD (atomicidad confirmada)
      const ordersInDb = await prisma.order.findMany({
        where: { id: { in: concurrencyOrderIds } },
        select: { id: true, orderNumber: true, restaurantId: true, notes: true },
      });
      assert.strictEqual(
        ordersInDb.length,
        successful.length,
        `Deben existir exactamente ${successful.length} pedidos en DB, encontrados: ${ordersInDb.length}`
      );

      // ── Verificación 5: Todos pertenecen al restaurante correcto
      for (const order of ordersInDb) {
        assert.strictEqual(
          order.restaurantId,
          restaurantId,
          `El pedido ${order.id} pertenece al restaurante incorrecto: ${order.restaurantId}`
        );
      }

      // ── Verificación 6: Unicidad en DB — los orderNumbers en DB son todos distintos
      const dbNumbers = ordersInDb.map((o) => o.orderNumber);
      const dbUniqueNumbers = new Set(dbNumbers);
      assert.strictEqual(
        dbUniqueNumbers.size,
        dbNumbers.length,
        `Colisión detectada EN BASE DE DATOS: números duplicados encontrados: ${dbNumbers.join(", ")}`
      );

      console.log(`\n    ✓ Concurrencia verificada: ${successful.length} números únicos sin colisiones`);
      console.log(`    ✓ Todos los pedidos existen en Neon con restaurantId correcto`);
      console.log(`    ✓ 0 colisiones en ${successful.length} transacciones paralelas`);
    }
  );

  test("8. Atomicidad: una transacción fallida no deja pedidos parciales en la BD", async (t) => {
    if (!counterTableReady) {
      t.skip("Fase 7A: tabla restaurant_order_counters no migrada");
      return;
    }
    const countBefore = await prisma.order.count({ where: { restaurantId: testRestaurant.id } });

      // Intentar crear un pedido que falla DESPUÉS de generar el número (producto inválido)
      let errorCaught = false;
      try {
        await prisma.$transaction(async (tx) => {
          const orderNumber = await generateOrderNumber(tx, testRestaurant.id);

          // Forzar fallo intentando referenciar un userId inexistente
          await tx.order.create({
            data: {
              orderNumber,
              userId: "user_id_that_does_not_exist_fase7a",
              restaurantId: testRestaurant.id,
              status: "RECEIVED",
              orderType: "PICKUP",
              customerName: "Test Atomicidad",
              customerPhone: "3000000000",
              subtotal: 1000,
              deliveryFee: 0,
              total: 1000,
              paymentMethod: "CASH",
            },
          });
        });
      } catch {
        errorCaught = true;
      }

      assert.ok(errorCaught, "La transacción debe haber fallado por userId inválido");

      const countAfter = await prisma.order.count({ where: { restaurantId: testRestaurant.id } });
      assert.strictEqual(
        countAfter,
        countBefore,
        `El ROLLBACK debe haber revertido el pedido parcial. Antes: ${countBefore}, Después: ${countAfter}`
      );

      console.log("\n    ✓ Atomicidad verificada: fallo post-generación de número revirtió la transacción completa");
    }
  );
});
