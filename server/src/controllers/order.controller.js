const { body, param, validationResult } = require("express-validator");
const orderService = require("../services/order.service");

/** Helper — extrae errores de validación y responde 400 si los hay. */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0]?.msg || "Datos inválidos en el pedido.";
    res.status(400).json({
      error: firstError,
      details: errors.array(),
    });
    return false;
  }
  return true;
};

// ─── Reglas de validación ───────────────────────────────────────────────────

const createOrderRules = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("El pedido debe contener al menos un producto."),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("La cantidad de cada producto debe ser un número entero mayor a 0."),
  body("orderType")
    .optional()
    .isIn(["pickup", "delivery", "PICKUP", "DELIVERY"])
    .withMessage("Tipo de pedido no válido (debe ser pickup o delivery)."),
];

const getOrderRules = [
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Identificador de pedido requerido."),
];

const updateStatusRules = [
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Identificador de pedido requerido."),
  body("status")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("El nuevo estado es requerido."),
];

// ─── Controladores ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/orders
 * Crea un nuevo pedido para el usuario autenticado (extraído de req.user.id).
 */
const createOrder = [
  ...createOrderRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const {
        restaurantSlug,
        restaurantId,
        orderType,
        delivery,
        customer,
        items,
        paymentMethod,
        notes,
        couponCode,
      } = req.body;

      const order = await orderService.createOrder({
        userId: req.user.id, // SEGURIDAD: Usuario autenticado tomado exclusivamente de la sesión
        restaurantSlug,
        restaurantId,
        orderType,
        delivery,
        customer,
        items,
        paymentMethod,
        notes,
        couponCode,
      });

      res.status(201).json({
        data: {
          order,
          message: "Pedido creado exitosamente.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/orders
 * Retorna todos los pedidos del usuario autenticado actual.
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getCustomerOrders(req.user.id);
    res.json({
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/orders/:id
 * Consulta un pedido por ID o código de pedido.
 * Valida autorización: solo el dueño o administradores pueden consultarlo.
 */
const getOrderById = [
  ...getOrderRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const order = await orderService.getOrderById(req.params.id, req.user);
      res.json({
        data: {
          order,
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/orders/admin/restaurant/:restaurantId
 * Consulta pedidos de un restaurante específico (panel administrativo).
 */
const getRestaurantOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getRestaurantOrders(
      req.params.restaurantId,
      req.user
    );
    res.json({
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/orders/admin/restaurant/:restaurantId/metrics
 * Retorna las métricas en tiempo real del restaurante calculadas desde Neon.
 */
const getRestaurantMetrics = async (req, res, next) => {
  try {
    const metrics = await orderService.getRestaurantMetrics(
      req.params.restaurantId,
      req.user
    );
    res.json({
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/orders/admin/restaurant/:restaurantId/analytics
 * Retorna análisis comercial completo: productos estrella, rentabilidad y demanda temporal.
 */
const getRestaurantAnalytics = async (req, res, next) => {
  try {
    const analytics = await orderService.getRestaurantAnalytics(
      req.params.restaurantId,
      req.user
    );
    res.json({
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/orders/admin/restaurant/:restaurantId/goal
 * Consulta la meta mensual vigente y el estado de cumplimiento del restaurante.
 */
const getRestaurantGoal = async (req, res, next) => {
  try {
    const goal = await orderService.getRestaurantGoal(
      req.params.restaurantId,
      req.user
    );
    res.json({
      data: goal,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/orders/admin/restaurant/:restaurantId/goal
 * Configura o modifica la meta mensual de ventas en COP para el restaurante.
 */
const updateRestaurantGoal = async (req, res, next) => {
  try {
    const { monthlyGoal } = req.body;
    if (monthlyGoal === undefined || monthlyGoal === null) {
      return res.status(400).json({ error: "El campo 'monthlyGoal' es obligatorio." });
    }
    const updated = await orderService.updateRestaurantGoal(
      req.params.restaurantId,
      monthlyGoal,
      req.user
    );
    res.json({
      data: updated,
      message: "Meta mensual de ventas actualizada exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/orders/:id/status
 * Actualiza el estado de un pedido (requiere rol administrativo y transición válida).
 */
const updateOrderStatus = [
  ...updateStatusRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const order = await orderService.updateOrderStatus(
        req.params.id,
        req.body.status,
        req.user
      );
      res.json({
        data: {
          order,
          message: "Estado de pedido actualizado correctamente.",
        },
      });
    } catch (err) {
      next(err);
    }
  },
];

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getRestaurantOrders,
  getRestaurantMetrics,
  getRestaurantAnalytics,
  getRestaurantGoal,
  updateRestaurantGoal,
  updateOrderStatus,
};
