#!/usr/bin/env node
/**
 * FoodiePOP — Script de Backfill Idempotente de Membresías (Etapa 5B)
 *
 * Propósito:
 * Asignar a los usuarios con rol global ADMIN existentes su membresía correspondiente
 * sobre el restaurante oficial ("la-esquina-food") como OWNER / MANAGER.
 *
 * Garantías:
 * - Es 100% idempotente (usa upsert con clave compuesta unique [userId, restaurantId]).
 * - No modifica contraseñas, emails, IDs ni roles globales.
 * - No crea usuarios duplicados ni altera productos, pedidos ni categorías.
 * - Se puede ejecutar N veces de forma segura.
 *
 * Ejecución:
 *   node scripts/backfill-memberships.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../src/lib/prisma");

async function main() {
  console.log("=== INICIO DE BACKFILL DE MEMBRESÍAS FOODIEPOP ===");

  // 1. Obtener el restaurante La Esquina Food
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "la-esquina-food" },
  });

  if (!restaurant) {
    console.error("ERROR: No se encontró el restaurante 'la-esquina-food' en Neon.");
    process.exit(1);
  }

  console.log(`Restaurante destino: ${restaurant.name} (ID: ${restaurant.id}, Slug: ${restaurant.slug})`);

  // 2. Identificar todos los usuarios con rol ADMIN
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      active: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  console.log(`Usuarios con rol global ADMIN encontrados: ${admins.length}`);

  if (admins.length === 0) {
    console.log("No se encontraron usuarios administradores para migrar.");
    return;
  }

  // 3. Crear membresías idempotentes
  const results = [];
  for (const admin of admins) {
    const membership = await prisma.userRestaurantRole.upsert({
      where: {
        userId_restaurantId: {
          userId: admin.id,
          restaurantId: restaurant.id,
        },
      },
      update: {
        role: "OWNER",
        active: true,
      },
      create: {
        userId: admin.id,
        restaurantId: restaurant.id,
        role: "OWNER",
        active: true,
      },
      include: {
        restaurant: {
          select: { name: true, slug: true },
        },
      },
    });

    results.push({
      userId: admin.id,
      email: admin.email,
      name: admin.name,
      restaurant: membership.restaurant.name,
      localRole: membership.role,
      active: membership.active,
    });
  }

  console.log("✓ Backfill completado exitosamente. Membresías sincronizadas:");
  console.table(results);
}

main()
  .catch((err) => {
    console.error("Error durante el backfill:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
