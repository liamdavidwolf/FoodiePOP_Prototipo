const express = require("express");
const menuController = require("../controllers/menu.controller");
const { requireAuth, requireRole, requireRestaurantAccess } = require("../middleware/auth");

const router = express.Router();

// GET /api/v1/menu/restaurant/:slug
router.get("/restaurant/:slug", menuController.getRestaurant);

// GET /api/v1/menu/restaurant/:slug/categories
router.get("/restaurant/:slug/categories", menuController.getCategories);

// GET /api/v1/menu/restaurant/:slug/products
router.get("/restaurant/:slug/products", menuController.getProducts);

// GET /api/v1/menu/restaurant/:slug/full (alias del menú completo)
router.get("/restaurant/:slug/full", menuController.getProducts);

// Rutas de administración de catálogo
router.get(
  "/restaurant/:slug/admin-products",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.getAdminProducts
);

router.post(
  "/restaurant/:slug/products",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.createProduct
);

router.patch(
  "/products/:id/availability",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.updateProductAvailability
);

router.patch(
  "/products/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.updateProduct
);

router.post(
  "/products/:id/options",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.createProductOption
);

router.patch(
  "/options/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.updateProductOption
);

router.delete(
  "/options/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.deleteProductOption
);

// ─── Rutas de administración de categorías ───────────────────────────────────

router.get(
  "/restaurant/:slug/admin-categories",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.getAdminCategories
);

router.post(
  "/restaurant/:slug/categories",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.createCategory
);

router.patch(
  "/categories/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.updateCategory
);

router.patch(
  "/categories/:id/availability",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.updateCategoryAvailability
);

router.delete(
  "/categories/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERADMIN"),
  requireRestaurantAccess(["OWNER", "MANAGER"]),
  menuController.deleteCategory
);

module.exports = router;
