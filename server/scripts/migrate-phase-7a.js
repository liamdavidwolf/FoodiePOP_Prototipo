#!/usr/bin/env node
/**
 * FoodiePOP — Script Versionado de Migración DDL: Fase 7A
 *
 * Objetivo:
 * - Aplica la migración DDL para la numeración atómica por restaurante.
 * - Ejecuta las cuatro sentencias en orden estricto dentro de una transacción interactiva de Prisma.
 * - Si alguna sentencia falla, PostgreSQL efectúa ROLLBACK completo y la base de datos permanece intacta.
 * - Idempotente: seguro de re-ejecutar gracias a cláusulas IF NOT EXISTS y IF EXISTS.
 *
 * Ejecución (requiere autorización previa):
 *   node server/scripts/migrate-phase-7a.js
 */

"use strict";

const prisma = require("../src/lib/prisma");

const DDL_STATEMENTS = [
  {
    step: "1/4",
    name: 'Creación de tabla "restaurant_order_counters"',
    sql: `
      CREATE TABLE IF NOT EXISTS "restaurant_order_counters" (
          "id" TEXT NOT NULL,
          "restaurantId" TEXT NOT NULL,
          "lastNumber" BIGINT NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "restaurant_order_counters_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "restaurant_order_counters_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `,
  },
  {
    step: "2/4",
    name: 'Índice único en "restaurant_order_counters"("restaurantId")',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_order_counters_restaurantId_key"
      ON "restaurant_order_counters"("restaurantId");
    `,
  },
  {
    step: "3/4",
    name: 'Índice único compuesto en "orders"("restaurantId", "orderNumber")',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "orders_restaurantId_orderNumber_key"
      ON "orders"("restaurantId", "orderNumber");
    `,
  },
  {
    step: "4/4",
    name: 'Retiro de índice global previo "orders_orderNumber_key"',
    sql: `
      DROP INDEX IF EXISTS "orders_orderNumber_key";
    `,
  },
];

async function runMigration() {
  console.log("=== FoodiePOP — Migración DDL: Fase 7A ===\n");
  console.log("Iniciando transacción interactiva en PostgreSQL...");

  const startTime = Date.now();

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const { step, name, sql } of DDL_STATEMENTS) {
          console.log(`[${step}] Ejecutando: ${name}...`);
          await tx.$executeRawUnsafe(sql);
          console.log(`  ✓ Paso ${step} completado.`);
        }
      },
      {
        maxWait: 10000, // Tiempo máximo de espera para obtener conexión del pool (10s)
        timeout: 30000, // Tiempo máximo para ejecutar la transacción completa (30s)
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`\n✓ Migración completada exitosamente en ${elapsed}ms.`);
    console.log("✓ COMMIT confirmado por PostgreSQL en Neon. Esquema actualizado.");
  } catch (err) {
    console.error("\n✖ ERROR fatal durante la migración DDL:");
    console.error(`  Mensaje: ${err.message}`);
    console.error("  Estado: La migración no se completó. Si la transacción estaba en curso, PostgreSQL ejecutó ROLLBACK automático; si ocurrió un fallo previo de conexión o pool, ninguna transacción fue iniciada. Ningún cambio fue persistido en la base de datos.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMigration().then(() => {
    if (process.exitCode) {
      process.exit(process.exitCode);
    }
  });
}

module.exports = { runMigration, DDL_STATEMENTS };

