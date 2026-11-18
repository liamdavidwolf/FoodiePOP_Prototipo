/**
 * superadmin.controller.js
 * Controladores HTTP para el módulo SuperAdmin de FoodiePOP (Etapa 5C).
 * Todas las rutas están protegidas por requireAuth + requireRole('SUPERADMIN').
 */
"use strict";

const { body, param, query, validationResult } = require("express-validator");
const service = require("../services/superadmin.service");

// ─── Helper de validación ─────────────────────────────────────────────────────

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = errors.array()[0];
    const first =
      err?.msg && err.msg !== "Invalid value"
        ? err.msg
        : `El campo '${err?.path || err?.param || "desconocido"}' tiene un valor no válido.`;
    res.status(400).json({ error: first, details: errors.array() });
    return false;
  }
  return true;
};

// ─── 1. Dashboard y Métricas ──────────────────────────────────────────────────

/**
 * GET /api/v1/superadmin/metrics
 * Métricas globales del sistema con evolución diaria y filtros por período.
 */
const getMetrics = [
  query("period").optional().isInt({ min: 1, max: 365 }).withMessage("El período debe ser un entero entre 1 y 365 días.").toInt(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await service.getMetrics({ period: req.query.period });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/superadmin/stats
 * Resumen de red (compatibilidad con endpoints anteriores).
 */
const getNetworkStats = async (req, res, next) => {
  try {
    const stats = await service.getNetworkStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
};

// ─── 2. Gestión de Restaurantes ───────────────────────────────────────────────

/**
 * GET /api/v1/superadmin/restaurants
 * Lista todos los restaurantes con conteos, ventas totales y paginación.
 */
const listRestaurants = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().isString().trim(),
  query("active").optional().isBoolean().toBoolean(),
  query("status").optional().isIn(["OPEN", "CLOSED", "PAUSED"]).withMessage("Estado no válido."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.listRestaurants({
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        active: req.query.active,
        status: req.query.status,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
];

/**
 * POST /api/v1/superadmin/restaurants
 * Crea un nuevo restaurante con slug validado.
 */
const createRestaurant = [
  body("slug").isString().trim().notEmpty().withMessage("El slug es requerido."),
  body("name").isString().trim().notEmpty().withMessage("El nombre es requerido."),
  body("description").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("phone").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("address").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("deliveryFee").optional({ nullable: true }).isInt({ min: 0 }).withMessage("El costo de domicilio debe ser un entero no negativo."),
  body("schedule").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("logoUrl").optional({ nullable: true, checkFalsy: true }).isURL().withMessage("logoUrl debe ser una URL válida."),
  body("bannerUrl").optional({ nullable: true, checkFalsy: true }).isURL().withMessage("bannerUrl debe ser una URL válida."),
  body("status").optional({ nullable: true, checkFalsy: true }).isIn(["OPEN", "CLOSED", "PAUSED"]).withMessage("Estado no válido."),
  body("owner").optional({ nullable: true }),
  body("owner.email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("El correo del administrador debe ser un email válido."),
  body("owner.name").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("owner.password").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const restaurant = await service.createRestaurant(req.body);
      res.status(201).json({ data: restaurant });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/superadmin/restaurants/:restaurantId
 * Detalle completo del restaurante (por ID o Slug).
 */
const getRestaurantDetail = [
  param("restaurantId").isString().notEmpty().withMessage("Identificador de restaurante requerido."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const restaurant = await service.getRestaurantDetail(req.params.restaurantId);
      res.json({ data: restaurant });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/superadmin/restaurants/:restaurantId
 * Actualiza campos editables y estado de un restaurante.
 */
const updateRestaurant = [
  param("restaurantId").isString().notEmpty().withMessage("Identificador de restaurante requerido."),
  body("name").optional().isString().trim().notEmpty().withMessage("El nombre no puede estar vacío."),
  body("description").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("phone").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("address").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("deliveryFee").optional({ nullable: true }).isInt({ min: 0 }).withMessage("El costo de domicilio debe ser un entero no negativo."),
  body("schedule").optional({ nullable: true, checkFalsy: true }).isString().trim(),
  body("logoUrl").optional({ nullable: true, checkFalsy: true }).isURL().withMessage("logoUrl debe ser una URL válida."),
  body("bannerUrl").optional({ nullable: true, checkFalsy: true }).isURL().withMessage("bannerUrl debe ser una URL válida."),
  body("status").optional({ nullable: true, checkFalsy: true }).isIn(["OPEN", "CLOSED", "PAUSED"]).withMessage("Estado no válido."),
  body("active").optional({ nullable: true }).isBoolean().withMessage("active debe ser booleano."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const restaurant = await service.updateRestaurant(req.params.restaurantId, req.body);
      res.json({ data: restaurant });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/superadmin/restaurants/:restaurantId/status
 * Cambia el estado operativo y/o visibilidad de un restaurante.
 */
const setRestaurantStatus = [
  param("restaurantId").isString().notEmpty(),
  body("status").optional().isIn(["OPEN", "CLOSED", "PAUSED"]).withMessage("Estado no válido."),
  body("active").optional().isBoolean().withMessage("active debe ser boolean."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const restaurant = await service.setRestaurantStatus(req.params.restaurantId, req.body);
      res.json({ data: restaurant });
    } catch (err) {
      next(err);
    }
  },
];

// ─── 3. Personal y Membresías ─────────────────────────────────────────────────

/**
 * GET /api/v1/superadmin/restaurants/:restaurantId/staff
 * Lista el personal asignado a un restaurante.
 */
const listStaff = [
  param("restaurantId").isString().notEmpty(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.listStaff(req.params.restaurantId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * POST /api/v1/superadmin/restaurants/:restaurantId/staff
 * Asigna un usuario existente a un restaurante con un rol local.
 */
const addStaff = [
  param("restaurantId").isString().notEmpty(),
  body("userId").optional().isString().notEmpty(),
  body("email").optional().isEmail().withMessage("Email inválido."),
  body("role").isIn(["OWNER", "MANAGER", "KITCHEN"]).withMessage("Rol local no válido (debe ser OWNER, MANAGER o KITCHEN)."),
  body("active").optional().isBoolean(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    if (!req.body.userId && !req.body.email) {
      return res.status(400).json({ error: "Debe proporcionar userId o email del usuario a asignar." });
    }
    try {
      const result = await service.addStaff(req.params.restaurantId, req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/superadmin/restaurants/:restaurantId/staff/:membershipId
 * Modifica el rol local y/o estado de activación de una membresía.
 */
const updateStaffMembership = [
  param("restaurantId").isString().notEmpty(),
  param("membershipId").isString().notEmpty(),
  body("role").optional().isIn(["OWNER", "MANAGER", "KITCHEN"]).withMessage("Rol local no válido."),
  body("active").optional().isBoolean().withMessage("active debe ser booleano."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.updateStaffMembership(
        req.params.restaurantId,
        req.params.membershipId,
        req.body
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

// Compatibilidad con endpoints anteriores /memberships
const listMemberships = [
  param("restaurantId").isString().notEmpty(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.listMemberships(req.params.restaurantId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

const upsertMembership = [
  param("restaurantId").isString().notEmpty(),
  body("userId").isString().notEmpty().withMessage("userId es requerido."),
  body("role").isIn(["OWNER", "MANAGER", "KITCHEN"]).withMessage("Rol local no válido."),
  body("active").optional().isBoolean(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.upsertMembership({
        userId: req.body.userId,
        restaurantId: req.params.restaurantId,
        role: req.body.role,
        active: req.body.active,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

const revokeMembership = [
  param("restaurantId").isString().notEmpty(),
  param("userId").isString().notEmpty(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.revokeMembership(req.params.userId, req.params.restaurantId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
];

// ─── 4. Gestión Global de Usuarios ───────────────────────────────────────────

/**
 * GET /api/v1/superadmin/users
 * Lista usuarios con membresías asociadas, filtros y paginación.
 */
const listUsers = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional().isString().trim(),
  query("role").optional().isIn(["CLIENT", "ADMIN", "SUPERADMIN"]),
  query("active").optional().isBoolean().toBoolean(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.listUsers({
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
        role: req.query.role,
        active: req.query.active,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/superadmin/users/:userId
 * Detalle completo de un usuario con membresías y pedidos recientes.
 */
const getUserDetail = [
  param("userId").isString().notEmpty().withMessage("Identificador de usuario requerido."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const user = await service.getUserDetail(req.params.userId);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/superadmin/users/:userId/role
 * Cambia el rol global de un usuario.
 */
const setUserRole = [
  param("userId").isString().notEmpty(),
  body("role").isIn(["CLIENT", "ADMIN", "SUPERADMIN"]).withMessage("Rol no válido."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const user = await service.setUserRole(req.params.userId, req.body.role, req.user.id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/superadmin/users/:userId/active
 * Activa o suspende la cuenta de un usuario.
 */
const setUserActive = [
  param("userId").isString().notEmpty(),
  body("active").isBoolean().withMessage("active debe ser boolean."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const user = await service.setUserActive(req.params.userId, req.body.active, req.user.id);
      res.json({ data: user });
    } catch (err) {
      next(err);
    }
  },
];

// ─── 5. Consulta Global de Pedidos ───────────────────────────────────────────

/**
 * GET /api/v1/superadmin/orders
 * Consulta global de pedidos de todos los restaurantes con filtros y paginación.
 */
const listOrders = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("restaurantId").optional().isString().trim(),
  query("status").optional().isIn([
    "RECEIVED", "CONFIRMED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED", "CANCELLED",
    "received", "confirmed", "preparing", "ready", "on_the_way", "delivered", "cancelled"
  ]).withMessage("Estado no válido."),
  query("startDate").optional().isISO8601().withMessage("startDate debe ser formato ISO8601 válido."),
  query("endDate").optional().isISO8601().withMessage("endDate debe ser formato ISO8601 válido."),
  query("search").optional().isString().trim(),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const result = await service.listOrders({
        page: req.query.page,
        limit: req.query.limit,
        restaurantId: req.query.restaurantId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/superadmin/orders/:orderId
 * Consulta de solo lectura del detalle completo de un pedido.
 */
const getOrderDetail = [
  param("orderId").isString().notEmpty().withMessage("Identificador de pedido requerido."),
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const order = await service.getOrderDetail(req.params.orderId);
      res.json({ data: order });
    } catch (err) {
      next(err);
    }
  },
];

module.exports = {
  // Dashboard & Métricas
  getMetrics,
  getNetworkStats,

  // Restaurantes
  listRestaurants,
  createRestaurant,
  getRestaurantDetail,
  updateRestaurant,
  setRestaurantStatus,

  // Staff & Membresías
  listStaff,
  addStaff,
  updateStaffMembership,
  listMemberships,
  upsertMembership,
  revokeMembership,

  // Usuarios
  listUsers,
  getUserDetail,
  setUserRole,
  setUserActive,

  // Pedidos
  listOrders,
  getOrderDetail,
};
