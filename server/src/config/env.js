/**
 * Carga y valida las variables de entorno del servidor.
 * Emite advertencias si faltan variables críticas pero NO detiene el proceso,
 * para que el servidor pueda arrancar aunque la BD no esté disponible todavía.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), override: true });
require("dotenv").config({ override: true });

const env = {
  port:        parseInt(process.env.PORT, 10) || 3001,
  nodeEnv:     process.env.NODE_ENV || "development",
  clientUrl:   process.env.CLIENT_URL || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret:   process.env.JWT_SECRET || "foodiepop-dev-secret-super-secure-key-2025",
  cookieName:  "foodiepop_token",
};

if (!env.databaseUrl) {
  console.warn(
    "[config] ⚠  DATABASE_URL no está configurada. " +
    "Las operaciones de base de datos fallarán. " +
    "Crea server/.env copiando server/.env.example."
  );
}

if (env.nodeEnv === "production" && !process.env.JWT_SECRET) {
  console.warn(
    "[config] ⚠  JWT_SECRET no está configurada en producción. " +
    "Se está utilizando una clave por defecto no recomendada."
  );
}

module.exports = env;
