/**
 * Servicio del menú.
 * Toda la lógica de acceso a datos vive aquí — los controladores no llaman a Prisma directamente.
 * Los campos internos (cost, sold, etc.) se excluyen explícitamente con `select`.
 */

const prisma = require("../lib/prisma");

// ─── Campos públicos del restaurante ─────────────────────────────────────────
const RESTAURANT_PUBLIC_SELECT = {
  id:          true,
  slug:        true,
  name:        true,
  description: true,
  logoUrl:     true,
  bannerUrl:   true,
  status:      true,
  schedule:    true,
  phone:       true,
  deliveryFee: true,
  // Excluidos intencionalmente: address, active, createdAt, updatedAt
};

// ─── Campos públicos de producto ──────────────────────────────────────────────
const PRODUCT_PUBLIC_SELECT = {
  id:          true,
  name:        true,
  description: true,
  price:       true,
  imageUrl:    true,
  available:   true,
  position:    true,
  // Excluidos: cost, sold, active, createdAt, updatedAt, restaurantId, categoryId
};

// ─── Campos públicos de opción ───────────────────────────────────────────────
const OPTION_PUBLIC_SELECT = {
  id:    true,
  name:  true,
  price: true,
  // Excluidos: cost, active, createdAt, updatedAt, productId
};

/**
 * Retorna los datos públicos de un restaurante por su slug.
 * @returns {object|null}
 */
const getRestaurantBySlug = async (slug) => {
  return prisma.restaurant.findUnique({
    where:  { slug, active: true },
    select: RESTAURANT_PUBLIC_SELECT,
  });
};

/**
 * Retorna las categorías activas de un restaurante.
 * @returns {Array|null}
 */
const getCategoriesBySlug = async (slug) => {
  const restaurant = await prisma.restaurant.findUnique({
    where:  { slug, active: true },
    select: { id: true },
  });
  if (!restaurant) return null;

  return prisma.category.findMany({
    where:   { restaurantId: restaurant.id, active: true },
    orderBy: { position: "asc" },
    select:  { id: true, name: true, description: true, position: true },
  });
};

/**
 * Retorna el menú completo: categorías con sus productos activos y opciones disponibles.
 * Es el endpoint principal para renderizar el menú del cliente.
 * @returns {Array|null}
 */
const getMenuBySlug = async (slug) => {
  const restaurant = await prisma.restaurant.findUnique({
    where:  { slug, active: true },
    select: { id: true },
  });
  if (!restaurant) return null;

  return prisma.category.findMany({
    where:   { restaurantId: restaurant.id, active: true },
    orderBy: { position: "asc" },
    select: {
      id:       true,
      name:     true,
      position: true,
      products: {
        where:   { restaurantId: restaurant.id, active: true },
        orderBy: { position: "asc" },
        select: {
          ...PRODUCT_PUBLIC_SELECT,
          options: {
            where:   { active: true },
            orderBy: { name: "asc" },
            select:  OPTION_PUBLIC_SELECT,
          },
        },
      },
    },
  });
};

/**
 * Retorna todos los productos con datos de costos y ventas para el panel de administración.
 * Aislamiento multi-restaurante: Valida membresía activa sobre el restaurante solicitado.
 */
const getAdminProductsBySlug = async (slug, requestingUser) => {
  // Búsqueda admin: NO filtramos por active:true — un restaurante inactivo/pausado
  // también necesita ser gestionado por su OWNER desde el panel de administración.
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, slug: true, name: true },
  });

  if (!restaurant) {
    const err = new Error("Restaurante no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: restaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para acceder al catálogo administrativo de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para acceder al catálogo administrativo.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  return prisma.product.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      category: {
        select: { id: true, name: true },
      },
      options: {
        select: { id: true, name: true, price: true, cost: true, active: true },
      },
    },
    orderBy: { position: "asc" },
  });
};

/**
 * Alterna o actualiza la disponibilidad de un producto en tiempo real.
 * Aislamiento multi-restaurante: Valida membresía activa sobre el restaurante del producto.
 */
const toggleProductAvailability = async (productId, available, requestingUser) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { restaurant: true },
  });
  if (!product) {
    const err = new Error("Producto no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: product.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para modificar productos de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para modificar la disponibilidad de productos.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data:  { available: typeof available === "boolean" ? available : !product.available },
  });

  return updated;
};

/**
 * Crea un nuevo producto en el catálogo del restaurante.
 * Aislamiento multi-restaurante: Valida membresía activa OWNER/MANAGER.
 */
const createProduct = async (restaurantSlugOrId, data, requestingUser) => {
  // Admin: NO filtramos por active:true — se pueden crear productos en restaurantes pausados/inactivos
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug: restaurantSlugOrId }, { id: restaurantSlugOrId }],
    },
    select: { id: true, slug: true },
  });

  if (!restaurant) {
    const err = new Error("Restaurante no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: restaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para administrar productos de este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para crear productos.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  // Validación de nombre
  if (!data?.name || typeof data.name !== "string" || !data.name.trim()) {
    const err = new Error("El nombre del producto es obligatorio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
  const cleanName = data.name.trim();

  // Validación de precio
  if (data?.price === undefined || data?.price === null || data?.price === "") {
    const err = new Error("El precio de venta es obligatorio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
  const priceNum = Number(data.price);
  if (!Number.isInteger(priceNum) || priceNum <= 0) {
    const err = new Error("El precio de venta debe ser un número entero mayor a 0 (COP).");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  // Validación de costo
  let costNum = null;
  if (data?.cost !== undefined && data?.cost !== null && data?.cost !== "") {
    costNum = Number(data.cost);
    if (!Number.isInteger(costNum) || costNum < 0) {
      const err = new Error("El costo de producción debe ser un número entero mayor o igual a 0 (COP).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
  }

  // Validación de categoría
  if (!data?.categoryId || typeof data.categoryId !== "string") {
    const err = new Error("La categoría es obligatoria.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const category = await prisma.category.findFirst({
    where: {
      id: data.categoryId,
      restaurantId: restaurant.id,
    },
  });

  if (!category) {
    const err = new Error("La categoría seleccionada no existe o no pertenece a este restaurante.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  // Verificar nombre duplicado en el mismo restaurante
  const existing = await prisma.product.findUnique({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: cleanName,
      },
    },
  });

  if (existing) {
    const err = new Error(`Ya existe un producto con el nombre '${cleanName}' en este restaurante.`);
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  const created = await prisma.product.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: cleanName,
      description: data.description && typeof data.description === "string" ? data.description.trim() : null,
      price: priceNum,
      cost: costNum,
      imageUrl: data.imageUrl && typeof data.imageUrl === "string" ? data.imageUrl.trim() : null,
      available: typeof data.available === "boolean" ? data.available : true,
      active: typeof data.active === "boolean" ? data.active : true,
    },
    include: {
      category: { select: { id: true, name: true } },
      options: { select: { id: true, name: true, price: true, cost: true, active: true } },
    },
  });

  return created;
};

/**
 * Modifica los datos de un producto existente.
 * Aislamiento multi-restaurante: Valida membresía activa OWNER/MANAGER.
 */
const updateProduct = async (productId, data, requestingUser) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { restaurant: true },
  });

  if (!product) {
    const err = new Error("Producto no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: product.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para modificar productos de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para modificar productos.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const updateData = {};

  if (data?.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      const err = new Error("El nombre del producto no puede estar vacío.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    const cleanName = data.name.trim();
    if (cleanName !== product.name) {
      const existing = await prisma.product.findUnique({
        where: {
          restaurantId_name: {
            restaurantId: product.restaurantId,
            name: cleanName,
          },
        },
      });
      if (existing) {
        const err = new Error(`Ya existe un producto con el nombre '${cleanName}' en este restaurante.`);
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
      }
      updateData.name = cleanName;
    }
  }

  if (data?.price !== undefined) {
    const priceNum = Number(data.price);
    if (!Number.isInteger(priceNum) || priceNum <= 0) {
      const err = new Error("El precio de venta debe ser un número entero mayor a 0 (COP).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.price = priceNum;
  }

  if (data?.cost !== undefined) {
    if (data.cost === null || data.cost === "") {
      updateData.cost = null;
    } else {
      const costNum = Number(data.cost);
      if (!Number.isInteger(costNum) || costNum < 0) {
        const err = new Error("El costo de producción debe ser un número entero mayor o igual a 0 (COP).");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      updateData.cost = costNum;
    }
  }

  if (data?.categoryId !== undefined) {
    const category = await prisma.category.findFirst({
      where: {
        id: data.categoryId,
        restaurantId: product.restaurantId,
      },
    });
    if (!category) {
      const err = new Error("La categoría seleccionada no existe o no pertenece a este restaurante.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.categoryId = category.id;
  }

  if (data?.description !== undefined) {
    updateData.description = typeof data.description === "string" ? data.description.trim() : null;
  }

  if (data?.imageUrl !== undefined) {
    updateData.imageUrl = typeof data.imageUrl === "string" ? data.imageUrl.trim() : null;
  }

  if (data?.available !== undefined) {
    if (typeof data.available !== "boolean") {
      const err = new Error("El campo 'available' debe ser booleano.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.available = data.available;
  }

  if (data?.active !== undefined) {
    if (typeof data.active !== "boolean") {
      const err = new Error("El campo 'active' debe ser booleano.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.active = data.active;
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: {
      category: { select: { id: true, name: true } },
      options: { select: { id: true, name: true, price: true, cost: true, active: true } },
    },
  });

  return updated;
};

/**
 * Crea una nueva opción / adicional para un producto.
 * Aislamiento multi-restaurante: Valida membresía activa OWNER/MANAGER.
 */
const createProductOption = async (productId, data, requestingUser) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { restaurant: true },
  });

  if (!product) {
    const err = new Error("Producto no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: product.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para administrar adicionales de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para crear adicionales.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  if (!data?.name || typeof data.name !== "string" || !data.name.trim()) {
    const err = new Error("El nombre del adicional es obligatorio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
  const cleanName = data.name.trim();

  if (data?.price === undefined || data?.price === null || data?.price === "") {
    const err = new Error("El precio adicional es obligatorio.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
  const priceNum = Number(data.price);
  if (!Number.isInteger(priceNum) || priceNum < 0) {
    const err = new Error("El precio adicional debe ser un número entero mayor o igual a 0 (COP).");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  let costNum = null;
  if (data?.cost !== undefined && data?.cost !== null && data?.cost !== "") {
    costNum = Number(data.cost);
    if (!Number.isInteger(costNum) || costNum < 0) {
      const err = new Error("El costo de producción del adicional debe ser un número entero mayor o igual a 0 (COP).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
  }

  const existing = await prisma.productOption.findUnique({
    where: {
      productId_name: {
        productId: product.id,
        name: cleanName,
      },
    },
  });

  if (existing) {
    const err = new Error(`Ya existe un adicional con el nombre '${cleanName}' para este producto.`);
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  return prisma.productOption.create({
    data: {
      productId: product.id,
      name: cleanName,
      price: priceNum,
      cost: costNum,
      active: typeof data.active === "boolean" ? data.active : true,
    },
    select: {
      id: true,
      productId: true,
      name: true,
      price: true,
      cost: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Modifica una opción / adicional existente.
 * Aislamiento multi-restaurante: Valida membresía activa OWNER/MANAGER.
 */
const updateProductOption = async (optionId, data, requestingUser) => {
  const option = await prisma.productOption.findUnique({
    where: { id: optionId },
    include: { product: true },
  });

  if (!option) {
    const err = new Error("Opción adicional no encontrada.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: option.product.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para modificar adicionales de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para modificar adicionales.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const updateData = {};

  if (data?.name !== undefined) {
    if (typeof data.name !== "string" || !data.name.trim()) {
      const err = new Error("El nombre del adicional no puede estar vacío.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    const cleanName = data.name.trim();
    if (cleanName !== option.name) {
      const existing = await prisma.productOption.findUnique({
        where: {
          productId_name: {
            productId: option.productId,
            name: cleanName,
          },
        },
      });
      if (existing) {
        const err = new Error(`Ya existe un adicional con el nombre '${cleanName}' para este producto.`);
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
      }
      updateData.name = cleanName;
    }
  }

  if (data?.price !== undefined) {
    const priceNum = Number(data.price);
    if (!Number.isInteger(priceNum) || priceNum < 0) {
      const err = new Error("El precio adicional debe ser un número entero mayor o igual a 0 (COP).");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.price = priceNum;
  }

  if (data?.cost !== undefined) {
    if (data.cost === null || data.cost === "") {
      updateData.cost = null;
    } else {
      const costNum = Number(data.cost);
      if (!Number.isInteger(costNum) || costNum < 0) {
        const err = new Error("El costo de producción del adicional debe ser un número entero mayor o igual a 0 (COP).");
        err.statusCode = 400;
        err.isOperational = true;
        throw err;
      }
      updateData.cost = costNum;
    }
  }

  if (data?.active !== undefined) {
    if (typeof data.active !== "boolean") {
      const err = new Error("El campo 'active' debe ser booleano.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.active = data.active;
  }

  return prisma.productOption.update({
    where: { id: optionId },
    data: updateData,
    select: {
      id: true,
      productId: true,
      name: true,
      price: true,
      cost: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Elimina una opción adicional.
 * Aislamiento multi-restaurante: Valida membresía activa OWNER/MANAGER.
 */
const deleteProductOption = async (optionId, requestingUser) => {
  const option = await prisma.productOption.findUnique({
    where: { id: optionId },
    include: { product: true },
  });

  if (!option) {
    const err = new Error("Opción adicional no encontrada.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: option.product.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para eliminar adicionales de otro restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para eliminar adicionales.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  await prisma.productOption.delete({
    where: { id: optionId },
  });

  return { id: optionId, message: "Adicional eliminado correctamente." };
};

// ─── Gestión Administrativa de Categorías ────────────────────────────────────

/**
 * Retorna todas las categorías del restaurante (activas e inactivas) con el conteo
 * de productos asociados para el panel administrativo.
 */
const getAdminCategoriesBySlug = async (slug, requestingUser) => {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
    select: { id: true, slug: true, name: true, active: true },
  });

  if (!restaurant) {
    const err = new Error("Restaurante no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: restaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para acceder a las categorías de este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER", "KITCHEN"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para consultar categorías administrativas.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    position: c.position,
    active: c.active,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    productsCount: c._count.products,
  }));
};

/**
 * Crea una nueva categoría en el restaurante.
 * Valida unicidad de nombre por restaurante y permisos OWNER/MANAGER.
 */
const createCategory = async (slug, data, requestingUser) => {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
    select: { id: true, slug: true, name: true, active: true },
  });

  if (!restaurant) {
    const err = new Error("Restaurante no encontrado.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: restaurant.id,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para crear categorías en este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para crear categorías.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  if (!data?.name || typeof data.name !== "string" || data.name.trim().length < 2) {
    const err = new Error("El nombre de la categoría es obligatorio y debe tener al menos 2 caracteres.");
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const cleanName = data.name.trim().slice(0, 100);

  const existing = await prisma.category.findUnique({
    where: {
      restaurantId_name: {
        restaurantId: restaurant.id,
        name: cleanName,
      },
    },
  });

  if (existing) {
    const err = new Error(`Ya existe una categoría con el nombre '${cleanName}' en este restaurante.`);
    err.statusCode = 409;
    err.isOperational = true;
    throw err;
  }

  let positionNum = 0;
  if (data.position !== undefined && data.position !== null && data.position !== "") {
    const parsedPos = Number(data.position);
    if (!Number.isInteger(parsedPos) || parsedPos < 0) {
      const err = new Error("La posición de la categoría debe ser un número entero mayor o igual a 0.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    positionNum = parsedPos;
  } else {
    const highestPos = await prisma.category.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    positionNum = (highestPos?.position ?? -1) + 1;
  }

  const created = await prisma.category.create({
    data: {
      restaurantId: restaurant.id,
      name: cleanName,
      description: data.description && typeof data.description === "string" ? data.description.trim().slice(0, 255) : null,
      imageUrl: data.imageUrl && typeof data.imageUrl === "string" ? data.imageUrl.trim() : null,
      position: positionNum,
      active: typeof data.active === "boolean" ? data.active : true,
    },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return {
    ...created,
    productsCount: created._count.products,
  };
};

/**
 * Modifica los datos de una categoría existente.
 */
const updateCategory = async (categoryId, data, requestingUser) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    const err = new Error("Categoría no encontrada.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: category.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para modificar categorías de este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para editar categorías.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  const updateData = {};

  if (data.name !== undefined) {
    if (typeof data.name !== "string" || data.name.trim().length < 2) {
      const err = new Error("El nombre de la categoría debe tener al menos 2 caracteres.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    const cleanName = data.name.trim().slice(0, 100);
    if (cleanName !== category.name) {
      const duplicate = await prisma.category.findUnique({
        where: {
          restaurantId_name: {
            restaurantId: category.restaurantId,
            name: cleanName,
          },
        },
      });

      if (duplicate && duplicate.id !== category.id) {
        const err = new Error(`Ya existe una categoría con el nombre '${cleanName}' en este restaurante.`);
        err.statusCode = 409;
        err.isOperational = true;
        throw err;
      }
      updateData.name = cleanName;
    }
  }

  if (data.description !== undefined) {
    updateData.description = data.description ? String(data.description).trim().slice(0, 255) : null;
  }

  if (data.imageUrl !== undefined) {
    updateData.imageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;
  }

  if (data.position !== undefined && data.position !== null && data.position !== "") {
    const parsedPos = Number(data.position);
    if (!Number.isInteger(parsedPos) || parsedPos < 0) {
      const err = new Error("La posición de la categoría debe ser un número entero mayor o igual a 0.");
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    updateData.position = parsedPos;
  }

  if (data.active !== undefined) {
    updateData.active = Boolean(data.active);
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: updateData,
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return {
    ...updated,
    productsCount: updated._count.products,
  };
};

/**
 * Activa o desactiva rápidamente la disponibilidad de una categoría.
 */
const toggleCategoryAvailability = async (categoryId, active, requestingUser) => {
  return updateCategory(categoryId, { active }, requestingUser);
};

/**
 * Elimina una categoría únicamente cuando no tiene productos asociados (Regla 6).
 */
const deleteCategory = async (categoryId, requestingUser) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) {
    const err = new Error("Categoría no encontrada.");
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  if (requestingUser && requestingUser.role !== "SUPERADMIN") {
    const membership = await prisma.userRestaurantRole.findUnique({
      where: {
        userId_restaurantId: {
          userId: requestingUser.id,
          restaurantId: category.restaurantId,
        },
      },
    });

    if (!membership || !membership.active) {
      const err = new Error("No tienes autorización para eliminar categorías de este restaurante.");
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }

    if (!["OWNER", "MANAGER"].includes(membership.role)) {
      const err = new Error(`Tu rol operativo (${membership.role}) no tiene permisos para eliminar categorías.`);
      err.statusCode = 403;
      err.isOperational = true;
      throw err;
    }
  }

  if (category._count.products > 0) {
    const err = new Error(
      `No es posible eliminar la categoría '${category.name}' porque tiene ${category._count.products} producto(s) asociado(s). Reasigna o elimina los productos antes de borrarla, o desactiva la categoría.`
    );
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });

  return {
    id: categoryId,
    message: "Categoría eliminada exitosamente.",
    action: "deleted",
  };
};

module.exports = {
  getRestaurantBySlug,
  getCategoriesBySlug,
  getMenuBySlug,
  getAdminProductsBySlug,
  toggleProductAvailability,
  createProduct,
  updateProduct,
  createProductOption,
  updateProductOption,
  deleteProductOption,
  getAdminCategoriesBySlug,
  createCategory,
  updateCategory,
  toggleCategoryAvailability,
  deleteCategory,
};
