const { body, validationResult } = require("express-validator");
const authService = require("../services/auth.service");
const { setAuthCookie, clearAuthCookie } = require("../utils/auth.utils");

/** Helper — extrae errores de validación y responde 400 si los hay. */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0]?.msg || "Datos inválidos.";
    res.status(400).json({
      error: firstError,
      details: errors.array(),
    });
    return false;
  }
  return true;
};

// ─── Reglas de validación ───────────────────────────────────────────────────

const registerRules = [
  body("name")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("El nombre es requerido.")
    .isLength({ min: 2, max: 100 })
    .withMessage("El nombre debe tener entre 2 y 100 caracteres."),
  body("email")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("El correo electrónico es requerido.")
    .isEmail()
    .withMessage("El formato del correo electrónico no es válido."),
  body("password")
    .isString()
    .notEmpty()
    .withMessage("La contraseña es requerida.")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener al menos 8 caracteres.")
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage("La contraseña debe contener al menos una letra y un número."),
  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 7, max: 20 })
    .withMessage("El teléfono debe tener entre 7 y 20 caracteres."),
];

const loginRules = [
  body("email")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("El correo electrónico es requerido.")
    .isEmail()
    .withMessage("El formato del correo electrónico no es válido."),
  body("password")
    .isString()
    .notEmpty()
    .withMessage("La contraseña es requerida."),
];

// ─── Controladores ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Registra un nuevo cliente y establece la cookie de sesión.
 */
const register = [
  ...registerRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { name, email, password, phone } = req.body;
      const { user, token } = await authService.registerClient({
        name,
        email,
        password,
        phone,
      });

      // Establecer sesión mediante cookie HttpOnly
      setAuthCookie(res, token);

      res.status(201).json({
        data: {
          user,
          message: "Registro exitoso.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * POST /api/v1/auth/login
 * Autentica al usuario y establece la cookie de sesión.
 */
const login = [
  ...loginRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { email, password } = req.body;
      const { user, token } = await authService.loginUser({ email, password });

      // Establecer sesión mediante cookie HttpOnly
      setAuthCookie(res, token);

      res.json({
        data: {
          user,
          message: "Inicio de sesión exitoso.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/auth/me
 * Retorna los datos del usuario autenticado actual.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    res.json({
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/auth/logout
 * Cierra la sesión eliminando la cookie HttpOnly.
 */
const logout = (_req, res) => {
  clearAuthCookie(res);
  res.json({
    data: {
      message: "Sesión cerrada correctamente.",
    },
  });
};

module.exports = {
  registerRules,
  loginRules,
  register,
  login,
  getMe,
  logout,
};
