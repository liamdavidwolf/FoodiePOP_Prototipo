const { param, validationResult } = require("express-validator");
const menuService = require("../services/menu.service");

/** Helper — extrae errores de validación y responde 400 si los hay. */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: "Parámetro inválido.", details: errors.array() });
    return false;
  }
  return true;
};

/** Validaciones reutilizables para :slug */
const slugRules = [
  param("slug")
    .isString()
    .trim()
    .notEmpty()
    .matches(/^[a-z0-9-]+$/)
    .withMessage("El slug solo puede contener letras minúsculas, números y guiones."),
];

// ─── Controladores ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/menu/restaurant/:slug
 * Retorna los datos públicos del restaurante.
 */
const getRestaurant = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.getRestaurantBySlug(req.params.slug);
      if (!data) return res.status(404).json({ error: "Restaurante no encontrado." });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/menu/restaurant/:slug/categories
 * Retorna las categorías activas del restaurante.
 */
const getCategories = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.getCategoriesBySlug(req.params.slug);
      if (!data) return res.status(404).json({ error: "Restaurante no encontrado." });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/menu/restaurant/:slug/products
 * Retorna categorías con sus productos activos y adicionales disponibles.
 * Omite campos internos (cost, sold, etc.).
 */
const getProducts = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.getMenuBySlug(req.params.slug);
      if (!data) return res.status(404).json({ error: "Restaurante no encontrado." });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/menu/restaurant/:slug/admin-products
 * Retorna todos los productos del catálogo con costos y ventas (Panel Admin).
 */
const getAdminProducts = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.getAdminProductsBySlug(req.params.slug, req.user);
      if (!data) return res.status(404).json({ error: "Restaurante no encontrado." });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/menu/products/:id/availability
 * Alterna o actualiza la disponibilidad de un producto en tiempo real.
 */
const updateProductAvailability = async (req, res, next) => {
  try {
    const { available } = req.body;
    if (typeof available !== "boolean") {
      return res.status(400).json({ error: "El campo 'available' es requerido y debe ser booleano." });
    }
    const data = await menuService.toggleProductAvailability(
      req.params.id,
      available,
      req.user
    );
    res.json({
      data,
      message: `Producto marcado como ${data.available ? "disponible" : "no disponible"}.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/menu/restaurant/:slug/products
 * Crea un nuevo producto en el catálogo del restaurante.
 */
const createProduct = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.createProduct(req.params.slug, req.body, req.user);
      res.status(201).json({
        data,
        message: "Producto creado exitosamente.",
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/menu/products/:id
 * Actualiza los datos de un producto existente.
 */
const updateProduct = async (req, res, next) => {
  try {
    const data = await menuService.updateProduct(req.params.id, req.body, req.user);
    res.json({
      data,
      message: "Producto actualizado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/menu/products/:id/options
 * Agrega un nuevo adicional / opción a un producto.
 */
const createProductOption = async (req, res, next) => {
  try {
    const data = await menuService.createProductOption(req.params.id, req.body, req.user);
    res.status(201).json({
      data,
      message: "Adicional creado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/menu/options/:id
 * Actualiza un adicional existente (nombre, precio, costo, activo).
 */
const updateProductOption = async (req, res, next) => {
  try {
    const data = await menuService.updateProductOption(req.params.id, req.body, req.user);
    res.json({
      data,
      message: "Adicional actualizado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/menu/options/:id
 * Elimina un adicional.
 */
const deleteProductOption = async (req, res, next) => {
  try {
    const data = await menuService.deleteProductOption(req.params.id, req.user);
    res.json({
      data,
      message: "Adicional eliminado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/menu/restaurant/:slug/admin-categories
 * Retorna todas las categorías del restaurante para administración.
 */
const getAdminCategories = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.getAdminCategoriesBySlug(req.params.slug, req.user);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * POST /api/v1/menu/restaurant/:slug/categories
 * Crea una nueva categoría en el restaurante.
 */
const createCategory = [
  ...slugRules,
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const data = await menuService.createCategory(req.params.slug, req.body, req.user);
      res.status(201).json({
        data,
        message: "Categoría creada exitosamente.",
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * PATCH /api/v1/menu/categories/:id
 * Actualiza los datos de una categoría.
 */
const updateCategory = async (req, res, next) => {
  try {
    const data = await menuService.updateCategory(req.params.id, req.body, req.user);
    res.json({
      data,
      message: "Categoría actualizada exitosamente.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/menu/categories/:id/availability
 * Alterna la disponibilidad (activa/inactiva) de una categoría.
 */
const updateCategoryAvailability = async (req, res, next) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "El campo 'active' debe ser booleano (true/false)." });
    }
    const data = await menuService.toggleCategoryAvailability(req.params.id, active, req.user);
    res.json({
      data,
      message: `Categoría ${data.active ? "activada" : "desactivada"} exitosamente.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/menu/categories/:id
 * Elimina una categoría si no tiene productos asociados.
 */
const deleteCategory = async (req, res, next) => {
  try {
    const data = await menuService.deleteCategory(req.params.id, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRestaurant,
  getCategories,
  getProducts,
  getAdminProducts,
  updateProductAvailability,
  createProduct,
  updateProduct,
  createProductOption,
  updateProductOption,
  deleteProductOption,
  getAdminCategories,
  createCategory,
  updateCategory,
  updateCategoryAvailability,
  deleteCategory,
};
