const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const env = require("../config/env");

const router = express.Router();

// Rate limiter para el inicio de sesión: máximo 10 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === "test" ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.",
  },
});

router.post("/register", authController.register);
router.post("/login", loginLimiter, authController.login);
router.get("/me", requireAuth, authController.getMe);
router.post("/logout", authController.logout);

module.exports = router;
