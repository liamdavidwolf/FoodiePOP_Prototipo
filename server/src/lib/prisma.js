/**
 * Singleton de PrismaClient.
 * Evita múltiples instancias en desarrollo con hot-reload (nodemon).
 */

const { PrismaClient } = require("@prisma/client");
const env = require("../config/env");

const globalForPrisma = global;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl,
      },
    },
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
