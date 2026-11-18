#!/usr/bin/env node
/**
 * FoodiePOP — Script administrativo controlado para provisión de cuentas ADMIN / SUPERADMIN
 *
 * USO EXCLUSIVO DE OPERACIONES:
 * Este script solo puede ejecutarse en terminal por personal autorizado con acceso al servidor.
 * No expone endpoints HTTP ni permite auto-escalamiento de clientes.
 *
 * Ejecución:
 *   node scripts/create-admin.js <email> <password> <nombre> [ADMIN|SUPERADMIN]
 *
 * Ejemplo:
 *   node scripts/create-admin.js admin@laesquina.com SuperAdmin2025! "Administrador Principal" ADMIN
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const prisma = require("../src/lib/prisma");

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Uso: node scripts/create-admin.js <email> <password> <nombre> [ADMIN|SUPERADMIN]");
    process.exit(1);
  }

  const [emailRaw, password, name, roleArg, restaurantSlugArg, localRoleArg] = args;
  const email = emailRaw.trim().toLowerCase();
  const role = roleArg ? roleArg.toUpperCase() : "ADMIN";

  if (!["ADMIN", "SUPERADMIN"].includes(role)) {
    console.error("Rol inválido. Debe ser 'ADMIN' o 'SUPERADMIN'.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role,
      name: name.trim(),
      passwordHash,
      active: true,
    },
    create: {
      email,
      name: name.trim(),
      passwordHash,
      role,
      active: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  console.log("✓ Usuario administrativo configurado exitosamente:");
  console.log(JSON.stringify(user, null, 2));

  // Asignación opcional de membresía a un restaurante
  if (restaurantSlugArg && role === "ADMIN") {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlugArg },
    });
    if (!restaurant) {
      console.warn(`ADVERTENCIA: Restaurante '${restaurantSlugArg}' no encontrado. No se creó membresía.`);
    } else {
      const localRole = ["OWNER", "MANAGER", "KITCHEN"].includes(localRoleArg?.toUpperCase())
        ? localRoleArg.toUpperCase()
        : "MANAGER";

      const membership = await prisma.userRestaurantRole.upsert({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId: restaurant.id,
          },
        },
        update: { role: localRole, active: true },
        create: {
          userId: user.id,
          restaurantId: restaurant.id,
          role: localRole,
          active: true,
        },
      });
      console.log(`✓ Membresía vinculada: ${localRole} en ${restaurant.name} (${restaurant.slug})`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Error al aprovisionar administrador:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
