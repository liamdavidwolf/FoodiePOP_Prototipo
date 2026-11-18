#!/usr/bin/env node
/**
 * FoodiePOP — Script Idempotente de Inicialización de Contadores de Pedidos (Fase 7A)
 *
 * Objetivo:
 * - Inicializa la entidad RestaurantOrderCounter para cada restaurante existente en la base de datos.
 * - Examina todos los pedidos históricos de cada sede para determinar si existen números puramente numéricos.
 * - Si existen números puramente numéricos, toma el valor máximo como punto de partida.
 * - Si los pedidos históricos tienen prefijos (ej. "FP-1001"), no colisionan con el nuevo formato "000001",
 *   por lo que el contador se inicializa en 0 para que el próximo pedido sea 000001.
 * - Jamás disminuye un contador ya existente.
 * - Es 100% idempotente (puede ejecutarse múltiples veces de forma segura).
 *
 * Ejecución:
 *   node server/scripts/init-order-counters.js
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const prisma = require("../src/lib/prisma");

async function initCounters() {
  console.log("=== FoodiePOP — Inicialización Idempotente de Contadores (Fase 7A) ===\n");

  // 1. Obtener todos los restaurantes registrados
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, slug: true, name: true, active: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Se encontraron ${restaurants.length} restaurantes para auditar e inicializar:\n`);

  let initializedCount = 0;
  let skippedCount = 0;

  for (const rest of restaurants) {
    // 2. Consultar pedidos históricos del restaurante
    const orders = await prisma.order.findMany({
      where: { restaurantId: rest.id },
      select: { orderNumber: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    console.log(`• Restaurante: "${rest.name}" (slug: /${rest.slug}) — ID: ${rest.id}`);
    console.log(`  Total pedidos históricos: ${orders.length}`);

    // 3. Inspeccionar formatos existentes
    let maxNumeric = 0n;
    const historicalFormats = new Set();

    for (const o of orders) {
      const numStr = String(o.orderNumber).trim();
      if (/^\d+$/.test(numStr)) {
        historicalFormats.add("NUMERIC");
        try {
          const val = BigInt(numStr);
          if (val > maxNumeric) {
            maxNumeric = val;
          }
        } catch {
          // ignore parsing error
        }
      } else {
        const prefix = numStr.split("-")[0] || "OTHER";
        historicalFormats.add(prefix);
      }
    }

    console.log(`  Formatos históricos detectados: [${Array.from(historicalFormats).join(", ") || "Ninguno"}]`);
    console.log(`  Máximo numérico histórico encontrado: ${maxNumeric.toString()}`);

    // 4. Consultar contador actual si ya existe
    let currentCounter = null;
    try {
      currentCounter = await prisma.restaurantOrderCounter.findUnique({
        where: { restaurantId: rest.id },
      });
    } catch (err) {
      console.error(`  [ERROR] No se pudo consultar la tabla restaurant_order_counters: ${err.message}`);
      console.error(`  Asegúrate de que la migración SQL de Fase 7A haya sido aplicada en la base de datos.`);
      process.exit(1);
    }

    if (currentCounter) {
      console.log(`  Contador existente en DB: lastNumber = ${currentCounter.lastNumber.toString()}`);
      // Regla: Jamás disminuir un contador existente
      if (currentCounter.lastNumber >= maxNumeric) {
        console.log(`  ✓ Conservando contador existente (${currentCounter.lastNumber.toString()}). No requiere actualización.\n`);
        skippedCount++;
        continue;
      }
    }

    // 5. Determinar valor seguro de inicialización
    const safeLastNumber = currentCounter && currentCounter.lastNumber > maxNumeric
      ? currentCounter.lastNumber
      : maxNumeric;

    // 6. Upsert atómico del contador
    const result = await prisma.restaurantOrderCounter.upsert({
      where: { restaurantId: rest.id },
      create: {
        restaurantId: rest.id,
        lastNumber: safeLastNumber,
      },
      update: {
        lastNumber: safeLastNumber,
      },
    });

    console.log(`  ✓ Contador configurado: lastNumber = ${result.lastNumber.toString()} (Próximo pedido será: ${(result.lastNumber + 1n).toString().padStart(6, "0")})\n`);
    initializedCount++;
  }

  console.log(`=== Resumen de Inicialización ===`);
  console.log(`Restaurantes procesados: ${restaurants.length}`);
  console.log(`Contadores inicializados/actualizados: ${initializedCount}`);
  console.log(`Contadores conservados sin cambios: ${skippedCount}\n`);

  await prisma.$disconnect();
}

if (require.main === module) {
  initCounters().catch((err) => {
    console.error("Error fatal durante la inicialización de contadores:", err);
    prisma.$disconnect();
    process.exit(1);
  });
}

module.exports = { initCounters };

