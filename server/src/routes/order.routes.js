const express = require("express");
const orderController = require("../controllers/order.controller");
const { requireAuth, requireRole, requireRestaurantAccess } = require("../middleware/auth");

const router = express.Router();

// Todas las rutas de pedidos requieren autenticación previa
router.use(requireAuth);

// Rutas de cliente
router.post("/", orderController.createOrder);
router.get("/", orderController.getMyOrders);
router.get("/:id", orderController.getOrderById);

// Rutas administrativas
router.get(
  "/admin/restaurant/:restaurantId",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER", "KITCHEN"]),
  orderController.getRestaurantOrders
);

router.get(
  "/admin/restaurant/:restaurantId/metrics",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  orderController.getRestaurantMetrics
);

router.get(
  "/admin/restaurant/:restaurantId/analytics",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  orderController.getRestaurantAnalytics
);

router.get(
  "/admin/restaurant/:restaurantId/goal",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  orderController.getRestaurantGoal
);

router.patch(
  "/admin/restaurant/:restaurantId/goal",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  orderController.updateRestaurantGoal
);

router.patch(
  "/:id/status",
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER", "KITCHEN"]),
  orderController.updateOrderStatus
);

module.exports = router;
