/**
 * Middleware centralizado de manejo de errores.
 * Mapea errores de Prisma a respuestas HTTP apropiadas.
 * No expone detalles internos en producción.
 */

const env = require("../config/env");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isDev = env.nodeEnv === "development";

  // ─── Errores conocidos de Prisma ──────────────────────────────────────
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Ya existe un registro con ese valor." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro no encontrado." });
  }
  // P1001: no puede conectar con el servidor de BD
  // P1000: autenticación fallida
  if (err.code === "P1001" || err.code === "P1000" || err.code?.startsWith("P1")) {
    console.error("[error] Prisma connection:", err.message);
    return res.status(503).json({
      error: "Base de datos no disponible.",
      hint: isDev ? "Verifica DATABASE_URL en server/.env" : undefined,
    });
  }

  // ─── Errores operacionales (lanzados intencionalmente) ────────────────
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  // ─── Error genérico ───────────────────────────────────────────────────
  const status = err.statusCode || err.status || 500;
  console.error("[error]", err.message);

  res.status(status).json({
    error: "Error interno del servidor.",
    ...(isDev && { detail: err.message }),
  });
};

module.exports = errorHandler;
