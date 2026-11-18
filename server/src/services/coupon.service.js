const prisma = require("../lib/prisma");

/**
 * Validador de formato de código de cupón:
 * - Alfanumérico con guiones o guiones bajos opcionales.
 * - Longitud entre 3 y 30 caracteres.
 */
function isValidCouponCode(code) {
  if (typeof code !== "string") return false;
  const trimmed = code.trim();
  return /^[A-Z0-9_-]{3,30}$/i.test(trimmed);
}

/**
 * Normaliza y valida los datos de un cupón antes de guardarlos.
 */
function sanitizeCouponData(data, isUpdate = false) {
  const result = {};

  if (!isUpdate || data.code !== undefined) {
    if (!data.code || typeof data.code !== "string" || !isValidCouponCode(data.code)) {
      const err = new Error("El código del cupón debe tener entre 3 y 30 caracteres alfanuméricos (letras, números, guión o guión bajo).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    result.code = data.code.trim().toUpperCase();
  }

  if (!isUpdate || data.description !== undefined) {
    result.description = data.description ? String(data.description).trim().slice(0, 255) : null;
  }

  if (!isUpdate || data.discountType !== undefined) {
    const validTypes = ["PERCENTAGE", "FIXED"];
    const type = String(data.discountType).toUpperCase();
    if (!validTypes.includes(type)) {
      const err = new Error("El tipo de descuento debe ser PERCENTAGE (porcentaje) o FIXED (valor fijo).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    result.discountType = type;
  }

  if (!isUpdate || data.discountValue !== undefined) {
    const val = Number(data.discountValue);
    if (!Number.isFinite(val) || val <= 0) {
      const err = new Error("El valor del descuento debe ser un número positivo mayor a 0.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }

    const typeToCheck = result.discountType || data.discountType;
    if (typeToCheck === "PERCENTAGE" && val > 100) {
      const err = new Error("El porcentaje de descuento no puede ser mayor al 100%.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    result.discountValue = Math.round(val);
  }

  if (data.minimumOrderAmount !== undefined) {
    if (data.minimumOrderAmount === null || data.minimumOrderAmount === "") {
      result.minimumOrderAmount = 0;
    } else {
      const minAmount = Number(data.minimumOrderAmount);
      if (!Number.isFinite(minAmount) || minAmount < 0) {
        const err = new Error("El monto mínimo de compra no puede ser negativo.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      result.minimumOrderAmount = Math.round(minAmount);
    }
  } else if (!isUpdate) {
    result.minimumOrderAmount = 0;
  }

  if (data.maximumDiscount !== undefined) {
    if (data.maximumDiscount === null || data.maximumDiscount === "") {
      result.maximumDiscount = null;
    } else {
      const maxDisc = Number(data.maximumDiscount);
      if (!Number.isFinite(maxDisc) || maxDisc <= 0) {
        const err = new Error("El descuento máximo debe ser un valor numérico mayor a 0 o nulo.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      result.maximumDiscount = Math.round(maxDisc);
    }
  }

  // startDate en base de datos es non-nullable (DateTime @default(now()))
  if (data.startDate !== undefined && data.startDate !== null && data.startDate !== "") {
    const d = new Date(data.startDate);
    if (isNaN(d.getTime())) {
      const err = new Error("Fecha de inicio inválida.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    result.startDate = d;
  } else if (!isUpdate) {
    // Para cupón nuevo sin fecha específica, inicia inmediatamente
    result.startDate = new Date();
  }

  if (data.endDate !== undefined) {
    if (!data.endDate) {
      result.endDate = null;
    } else {
      const d = new Date(data.endDate);
      if (isNaN(d.getTime())) {
        const err = new Error("Fecha de vencimiento inválida.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      result.endDate = d;
    }
  }

  const effectiveStart = result.startDate !== undefined ? result.startDate : data.startDate;
  const effectiveEnd = result.endDate !== undefined ? result.endDate : data.endDate;
  if (effectiveStart && effectiveEnd && new Date(effectiveEnd) < new Date(effectiveStart)) {
    const err = new Error("La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (data.usageLimit !== undefined) {
    if (data.usageLimit === null || data.usageLimit === "") {
      result.usageLimit = null;
    } else {
      const limit = Number(data.usageLimit);
      if (!Number.isInteger(limit) || limit <= 0) {
        const err = new Error("El límite de usos debe ser un número entero mayor a 0 o nulo.");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      result.usageLimit = limit;
    }
  }

  if (data.active !== undefined) {
    result.active = Boolean(data.active);
  } else if (!isUpdate) {
    result.active = true;
  }

  return result;
}

/**
 * Resuelve un restaurante por ID o slug.
 */
async function resolveRestaurant(identifier) {
  if (!identifier) {
    const err = new Error("Identificador o slug de restaurante requerido.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ id: identifier }, { slug: identifier }],
    },
    select: { id: true, slug: true, name: true, active: true },
  });

  if (!restaurant) {
    const err = new Error("Restaurante no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  return restaurant;
}

/**
 * Consulta todos los cupones configurados para un restaurante.
 */
async function getRestaurantCoupons(restaurantIdentifier) {
  const restaurant = await resolveRestaurant(restaurantIdentifier);

  const coupons = await prisma.coupon.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      restaurantId: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minimumOrderAmount: true,
      maximumDiscount: true,
      startDate: true,
      endDate: true,
      usageLimit: true,
      usageCount: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { orders: true },
      },
    },
  });

  return coupons.map((c) => ({
    ...c,
    ordersCount: c._count.orders,
  }));
}

/**
 * Crea un nuevo cupón para un restaurante.
 */
async function createCoupon(restaurantIdentifier, couponData) {
  const restaurant = await resolveRestaurant(restaurantIdentifier);
  const sanitized = sanitizeCouponData(couponData, false);

  // Verificar unicidad del código para este restaurante
  const existing = await prisma.coupon.findUnique({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: sanitized.code,
      },
    },
  });

  if (existing) {
    const err = new Error(`Ya existe un cupón con el código "${sanitized.code}" para este restaurante.`);
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  const { restaurantId: _discard, ...cleanData } = sanitized;

  const coupon = await prisma.coupon.create({
    data: {
      ...cleanData,
      restaurant: {
        connect: { id: restaurant.id },
      },
    },
  });

  return coupon;
}

/**
 * Actualiza los datos de un cupón existente.
 */
async function updateCoupon(couponId, couponData) {
  const existing = await prisma.coupon.findUnique({
    where: { id: couponId },
  });

  if (!existing) {
    const err = new Error("Cupón no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const sanitized = sanitizeCouponData(
    {
      ...existing,
      ...couponData,
    },
    true
  );

  // Si se cambia el código, validar que no colisione con otro cupón del mismo restaurante
  if (sanitized.code && sanitized.code !== existing.code) {
    const duplicate = await prisma.coupon.findUnique({
      where: {
        restaurantId_code: {
          restaurantId: existing.restaurantId,
          code: sanitized.code,
        },
      },
    });

    if (duplicate && duplicate.id !== existing.id) {
      const err = new Error(`Ya existe un cupón con el código "${sanitized.code}" para este restaurante.`);
      err.statusCode = 409;
      err.isOperational = true;
      throw err;
    }
  }

  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data: sanitized,
  });

  return updated;
}

/**
 * Activa o desactiva rápidamente un cupón.
 */
async function toggleCouponActive(couponId, active) {
  const existing = await prisma.coupon.findUnique({
    where: { id: couponId },
  });

  if (!existing) {
    const err = new Error("Cupón no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const updated = await prisma.coupon.update({
    where: { id: couponId },
    data: { active: Boolean(active) },
  });

  return updated;
}

/**
 * Elimina o desactiva un cupón según historial de uso:
 * - Si no tiene usos registrados ni órdenes asociadas: eliminación física.
 * - Si tiene historial de uso: desactivación lógica para preservar la integridad referencial.
 */
async function deleteCoupon(couponId) {
  const existing = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });

  if (!existing) {
    const err = new Error("Cupón no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const hasHistory = existing.usageCount > 0 || existing._count.orders > 0;

  if (hasHistory) {
    const deactivated = await prisma.coupon.update({
      where: { id: couponId },
      data: { active: false },
    });

    return {
      message: "El cupón posee historial de pedidos y fue desactivado para proteger los registros históricos.",
      action: "deactivated",
      coupon: deactivated,
    };
  }

  await prisma.coupon.delete({
    where: { id: couponId },
  });

  return {
    message: "Cupón eliminado exitosamente.",
    action: "deleted",
  };
}

/**
 * Valida un cupón para el proceso de checkout y calcula el descuento exacto
 * sin alterar la base de datos (pre-validación de checkout).
 */
async function validateCouponForCheckout({ restaurantSlugOrId, code, subtotal }) {
  if (!code || typeof code !== "string" || !code.trim()) {
    const err = new Error("Código de cupón requerido.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const restaurant = await resolveRestaurant(restaurantSlugOrId);
  const normalizedCode = code.trim().toUpperCase();

  const coupon = await prisma.coupon.findUnique({
    where: {
      restaurantId_code: {
        restaurantId: restaurant.id,
        code: normalizedCode,
      },
    },
  });

  if (!coupon) {
    const err = new Error(`El cupón "${normalizedCode}" no existe o no pertenece a este restaurante.`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (!coupon.active) {
    const err = new Error(`El cupón "${coupon.code}" está inactivo.`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const now = new Date();

  if (coupon.startDate && now < new Date(coupon.startDate)) {
    const err = new Error(`El cupón "${coupon.code}" aún no está vigente.`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (coupon.endDate && now > new Date(coupon.endDate)) {
    const err = new Error(`El cupón "${coupon.code}" ha expirado.`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const currentSubtotal = Number(subtotal) || 0;

  if (coupon.minimumOrderAmount && currentSubtotal < coupon.minimumOrderAmount) {
    const err = new Error(
      `El pedido no alcanza la compra mínima de $${coupon.minimumOrderAmount.toLocaleString("es-CO")} para usar este cupón.`
    );
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    const err = new Error(`El cupón "${coupon.code}" ha alcanzado su límite de usos disponibles.`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = Math.round((currentSubtotal * coupon.discountValue) / 100);
    if (coupon.maximumDiscount !== null && coupon.maximumDiscount !== undefined && coupon.maximumDiscount > 0) {
      discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
    }
  } else if (coupon.discountType === "FIXED") {
    discountAmount = Math.min(coupon.discountValue, currentSubtotal);
  }

  discountAmount = Math.max(0, Math.min(discountAmount, currentSubtotal));
  const newSubtotal = Math.max(0, currentSubtotal - discountAmount);

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrderAmount: coupon.minimumOrderAmount,
      maximumDiscount: coupon.maximumDiscount,
    },
    discount: discountAmount,
    newSubtotal,
  };
}

module.exports = {
  getRestaurantCoupons,
  createCoupon,
  updateCoupon,
  toggleCouponActive,
  deleteCoupon,
  validateCouponForCheckout,
};

