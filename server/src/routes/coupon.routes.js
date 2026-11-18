const express = require("express");
const couponController = require("../controllers/coupon.controller");
const { requireAuth, requireRole, requireRestaurantAccess } = require("../middleware/auth");

const router = express.Router();

// Ruta pública / cliente para validación de cupón en checkout
// POST /api/v1/coupons/validate
router.post("/validate", couponController.validateCoupon);

// Rutas de administración de cupones (ADMIN y SUPERADMIN con permisos sobre el restaurante)
router.get(
  "/admin/restaurant/:restaurantId",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  couponController.getRestaurantCoupons
);

router.post(
  "/admin/restaurant/:restaurantId",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  couponController.createCoupon
);

router.patch(
  "/admin/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  couponController.updateCoupon
);

router.patch(
  "/admin/:id/active",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  couponController.toggleCouponActive
);

router.delete(
  "/admin/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  couponController.deleteCoupon
);

module.exports = router;

