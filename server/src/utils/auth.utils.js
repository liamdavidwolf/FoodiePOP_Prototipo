const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const BCRYPT_SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "7d";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/**
 * Hashea una contraseña usando bcrypt con 12 salt rounds.
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra su hash bcrypt.
 */
async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Genera un token JWT para la sesión del usuario.
 */
function generateToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifica un token JWT.
 */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Configura la cookie HttpOnly segura con el token de sesión.
 */
function setAuthCookie(res, token) {
  const isProduction = env.nodeEnv === "production";
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

/**
 * Elimina la cookie HttpOnly de sesión al hacer logout.
 */
function clearAuthCookie(res) {
  const isProduction = env.nodeEnv === "production";
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
};
