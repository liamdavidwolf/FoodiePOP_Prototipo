const couponService = require("../services/coupon.service");

/**
 * GET /api/v1/coupons/admin/restaurant/:restaurantId
 * Obtiene todos los cupones configurados para un restaurante.
 */
async function getRestaurantCoupons(req, res, next) {
  try {
    const restaurantIdentifier = req.params.restaurantId || req.params.slug;
    const coupons = await couponService.getRestaurantCoupons(restaurantIdentifier);
    res.json({
      data: coupons,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/coupons/admin/restaurant/:restaurantId
 * Crea un nuevo cupón para el restaurante.
 */
async function createCoupon(req, res, next) {
  try {
    const restaurantIdentifier = req.params.restaurantId || req.params.slug;
    const coupon = await couponService.createCoupon(restaurantIdentifier, req.body);
    res.status(201).json({
      data: coupon,
      message: "Cupón creado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/coupons/admin/:id
 * Actualiza los parámetros de un cupón existente.
 */
async function updateCoupon(req, res, next) {
  try {
    const coupon = await couponService.updateCoupon(req.params.id, req.body);
    res.json({
      data: coupon,
      message: "Cupón actualizado exitosamente.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/coupons/admin/:id/active
 * Activa o desactiva rápidamente un cupón.
 */
async function toggleCouponActive(req, res, next) {
  try {
    const { active } = req.body;
    const coupon = await couponService.toggleCouponActive(req.params.id, active);
    res.json({
      data: coupon,
      message: `Cupón ${coupon.active ? "activado" : "desactivado"} exitosamente.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/coupons/admin/:id
 * Elimina o desactiva el cupón según si tiene historial de usos.
 */
async function deleteCoupon(req, res, next) {
  try {
    const result = await couponService.deleteCoupon(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/coupons/validate
 * Pre-valida un código de cupón para el checkout y calcula el descuento.
 */
async function validateCoupon(req, res, next) {
  try {
    const { restaurantSlug, restaurantId, code, subtotal } = req.body;
    const restaurantSlugOrId = restaurantId || restaurantSlug;
    const result = await couponService.validateCouponForCheckout({
      restaurantSlugOrId,
      code,
      subtotal,
    });
    res.json({
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRestaurantCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponActive,
  deleteCoupon,
  validateCoupon,
};

