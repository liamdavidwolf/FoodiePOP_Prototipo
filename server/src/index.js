const express = require("express");
const cors    = require("cors");
const cookieParser = require("cookie-parser");

const env          = require("./config/env");
const routes       = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const notFound     = require("./middleware/notFound");

const app = express();

// ─── Middleware global ────────────────────────────────────────────────────────
app.use(
  cors({
    origin:      env.clientUrl,
    credentials: true,
    methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status:    "ok",
    env:       env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ─── Rutas de la API ──────────────────────────────────────────────────────────
app.use("/api/v1", routes);

// ─── 404 y manejador de errores (deben ir al final, en este orden) ────────────
app.use(notFound);
app.use(errorHandler);

// ─── Arranque ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(env.port, () => {
    console.log(`\n[server] ✅  FoodiePOP API corriendo en http://localhost:${env.port}`);
    console.log(`[server]     Ambiente : ${env.nodeEnv}`);
    console.log(`[server]     CORS     : ${env.clientUrl}`);
    console.log(`[server]     DB       : ${env.databaseUrl ? "configurada" : "⚠  NO configurada"}\n`);
  });

  const prisma = require("./lib/prisma");

  const gracefulShutdown = async (signal) => {
    try {
      await prisma.$disconnect();
    } catch (_) {}
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

module.exports = app; // útil para tests
