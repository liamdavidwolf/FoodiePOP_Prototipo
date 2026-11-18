const { verifyToken } = require("../utils/auth.utils");
const prisma = require("../lib/prisma");
const env = require("../config/env");

/**
 * Middleware que verifica la autenticación del usuario mediante cookie HttpOnly
 * o encabezado Authorization: Bearer <token>.
 */
async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.[env.cookieName];

    // Soporte complementario para encabezado Authorization (útil para pruebas de API)
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        error: "No autenticado. Inicia sesión para acceder a este recurso.",
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res.status(401).json({
        error: "Sesión inválida o expirada. Por favor, inicia sesión de nuevo.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({
        error: "Usuario no encontrado o cuenta suspendida.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware que verifica que el usuario autenticado tenga uno de los roles permitidos.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "No tienes los permisos requeridos para esta acción.",
      });
    }
    next();
  };
}

/**
 * Middleware que verifica que el usuario autenticado tenga membresía activa y rol operativo
 * suficiente para el restaurante solicitado.
 * - SUPERADMIN: Acceso universal global a cualquier restaurante (sin requerir membresía).
 * - ADMIN con membresía activa: Gestiona únicamente el restaurante asignado según roles permitidos.
 * - ADMIN sin membresía activa: Rechazado con 403.
 * - KITCHEN: Solo permitido si se incluye explícitamente en allowedLocalRoles.
 * - CLIENT: Rechazado con 403.
 */
function requireRestaurantAccess(allowedLocalRoles = ["OWNER", "MANAGER"]) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No autenticado." });
      }

      // Resolver identificador del restaurante (slug o ID)
      let restaurantIdentifier =
        req.params.slug ||
        req.params.restaurantId ||
        req.body?.restaurantSlug ||
        req.body?.restaurantId ||
        req.query?.restaurantId ||
        req.query?.slug;

      const targetId = req.params.productId || req.params.id;

      // Si la ruta opera sobre :id de producto, opción o pedido
      if (!restaurantIdentifier && targetId) {
        const maybeProduct = await prisma.product.findUnique({
          where: { id: targetId },
          select: { restaurantId: true },
        });
        if (maybeProduct) {
          restaurantIdentifier = maybeProduct.restaurantId;
        } else {
          const maybeOption = await prisma.productOption.findUnique({
            where: { id: targetId },
            select: { product: { select: { restaurantId: true } } },
          });
          if (maybeOption?.product) {
            restaurantIdentifier = maybeOption.product.restaurantId;
          } else {
            const maybeOrder = await prisma.order.findFirst({
              where: {
                OR: [{ id: targetId }, { orderNumber: targetId }],
              },
              select: { restaurantId: true },
            });
            if (maybeOrder) {
              restaurantIdentifier = maybeOrder.restaurantId;
            } else {
              const maybeCoupon = await prisma.coupon.findUnique({
                where: { id: targetId },
                select: { restaurantId: true },
              });
              if (maybeCoupon) {
                restaurantIdentifier = maybeCoupon.restaurantId;
              } else {
                const maybeCategory = await prisma.category.findUnique({
                  where: { id: targetId },
                  select: { restaurantId: true },
                });
                if (maybeCategory) {
                  restaurantIdentifier = maybeCategory.restaurantId;
                }
              }
            }
          }
        }
      }

      // SUPERADMIN posee acceso irrestricto sin necesidad de membresía local
      if (req.user.role === "SUPERADMIN") {
        if (restaurantIdentifier) {
          const restaurant = await prisma.restaurant.findFirst({
            where: {
              OR: [
                { id: restaurantIdentifier },
                { slug: restaurantIdentifier },
              ],
            },
            select: { id: true, slug: true, name: true, active: true },
          });
          if (restaurant) {
            req.restaurant = restaurant;
          } else {
            return res.status(404).json({ error: "Restaurante no encontrado." });
          }
        } else if (targetId) {
          return res.status(404).json({ error: "Recurso no encontrado." });
        }
        return next();
      }

      if (req.user.role !== "ADMIN") {
        return res.status(403).json({
          error: "No tienes permisos de administración.",
        });
      }

      if (!restaurantIdentifier) {
        if (targetId) {
          return res.status(404).json({ error: "Recurso no encontrado." });
        }
        return res.status(400).json({
          error: "Identificador de restaurante no especificado.",
        });
      }

      const restaurant = await prisma.restaurant.findFirst({
        where: {
          OR: [
            { id: restaurantIdentifier },
            { slug: restaurantIdentifier },
          ],
        },
        select: { id: true, slug: true, name: true, active: true },
      });

      if (!restaurant) {
        return res.status(403).json({
          error: "No tienes una membresía activa para administrar este restaurante.",
        });
      }

      const membership = await prisma.userRestaurantRole.findUnique({
        where: {
          userId_restaurantId: {
            userId: req.user.id,
            restaurantId: restaurant.id,
          },
        },
      });

      if (!membership || !membership.active) {
        return res.status(403).json({
          error: "No tienes una membresía activa para administrar este restaurante.",
        });
      }

      if (!allowedLocalRoles.includes(membership.role)) {
        return res.status(403).json({
          error: `Tu rol operativo (${membership.role}) no tiene permisos para realizar esta acción.`,
        });
      }

      req.restaurant = restaurant;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireRestaurantAccess,
};
