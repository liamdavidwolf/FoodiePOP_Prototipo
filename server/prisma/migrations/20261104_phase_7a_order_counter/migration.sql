-- ─── FoodiePOP — Migración Fase 7A: Numeración Atómica por Restaurante ─────────
-- Fecha: 2026-11-04
-- Objetivo:
-- 1. Crear la tabla `restaurant_order_counters` con clave foránea en CASCADE.
-- 2. Restricción única en `restaurantId` para garantizar locking a nivel de fila y atomicidad en PostgreSQL.
-- 3. Crear el índice único compuesto en `orders(restaurantId, orderNumber)` permitiendo números independientes por restaurante.
-- 4. Retirar de forma segura la restricción única global previa `orders_orderNumber_key`.

BEGIN;

-- 1. Crear tabla de contadores de pedido por restaurante
CREATE TABLE IF NOT EXISTS "restaurant_order_counters" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "lastNumber" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_order_counters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "restaurant_order_counters_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Restricción única en restaurantId para permitir upsert atómico (ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_order_counters_restaurantId_key" ON "restaurant_order_counters"("restaurantId");

-- 3. Crear índice único compuesto en orders(restaurantId, orderNumber)
-- Esto permite que dos restaurantes compartan el mismo orderNumber (ej. '000001') sin colisión
CREATE UNIQUE INDEX IF NOT EXISTS "orders_restaurantId_orderNumber_key" ON "orders"("restaurantId", "orderNumber");

-- 4. Retirar de forma segura la restricción única global previa en orders(orderNumber)
-- Solo se retira una vez que el índice compuesto orders_restaurantId_orderNumber_key está asegurado
DROP INDEX IF EXISTS "orders_orderNumber_key";

COMMIT;

