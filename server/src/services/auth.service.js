const prisma = require("../lib/prisma");
const { hashPassword, comparePassword, generateToken } = require("../utils/auth.utils");

// Dummy hash para evitar ataques de temporización (timing attacks) si el correo no existe
const TIMING_SAFE_DUMMY_HASH =
  "$2a$12$e8xL2P5kC2hC9vJ5vK9QeeN91wE2vO7kL20lH41yD72gQ13mH8P.e";

/**
 * Normaliza una dirección de correo electrónico (minúsculas, trim).
 */
function normalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Registra un nuevo usuario cliente.
 * GARANTÍA DE SEGURIDAD: Siempre asigna el rol CLIENT, ignorando cualquier rol
 * (previene escalamiento de privilegios).
 */
async function registerClient({ name, email, password, phone }) {
  const cleanEmail = normalizeEmail(email);

  // Verificar si el correo ya existe
  const existingUser = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (existingUser) {
    const error = new Error("El correo electrónico ya está registrado.");
    error.statusCode = 409;
    error.isOperational = true;
    throw error;
  }

  // Hash de la contraseña con bcrypt (12 salt rounds)
  const passwordHash = await hashPassword(password);

  // Creación del usuario con rol CLIENT forzado
  const newUser = await prisma.user.create({
    data: {
      email: cleanEmail,
      passwordHash,
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      role: "CLIENT", // Forzado intencionalmente en servidor
      active: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  const token = generateToken({
    userId: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  return { user: newUser, token };
}

/**
 * Inicia sesión con correo y contraseña.
 * Devuelve error genérico "Credenciales inválidas" sin revelar si el usuario
 * existe o no, protegiendo contra enumeración de cuentas.
 */
async function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
    include: {
      memberships: {
        where: { active: true },
        select: {
          id: true,
          role: true,
          restaurantId: true,
          restaurant: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
      },
    },
  });

  if (!user || !user.active) {
    // Ejecutar comparación dummy para mitigar enumeración por timing
    await comparePassword(password, TIMING_SAFE_DUMMY_HASH);
    const error = new Error("Credenciales inválidas. Verifica tu correo y contraseña.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error("Credenciales inválidas. Verifica tu correo y contraseña.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    memberships: user.memberships || [],
  };

  const token = generateToken({
    userId: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  });

  return { user: safeUser, token };
}

/**
 * Obtiene los datos del usuario actual por su ID.
 */
async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      active: true,
      memberships: {
        where: { active: true },
        select: {
          id: true,
          role: true,
          restaurantId: true,
          restaurant: {
            select: { id: true, name: true, slug: true, status: true },
          },
        },
      },
    },
  });

  if (!user || !user.active) {
    const error = new Error("Usuario no encontrado o cuenta inactiva.");
    error.statusCode = 401;
    error.isOperational = true;
    throw error;
  }

  const { active, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  normalizeEmail,
  registerClient,
  loginUser,
  getCurrentUser,
};
