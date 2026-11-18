/**
 * FoodiePOP — Seed inicial (idempotente)
 *
 * Ejecutar: node prisma/seed.js
 *           npm run db:seed (desde server/)
 *
 * Idempotencia: usa upsert con restricciones únicas del schema.
 * Ejecutarlo varias veces NO duplica restaurante ni productos.
 *
 * Datos migrados de: src/data/data.js (clientMenu + admin products)
 * combinados con descripciones e imágenes del menú cliente.
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ─── Datos del restaurante de prueba ────────────────────────────────────────

const RESTAURANT = {
  slug: "la-esquina-food",
  name: "La Esquina Food",
  description:
    "Comida deliciosa, preparada al momento con los mejores ingredientes.",
  logoUrl:
    "https://ui-avatars.com/api/?name=LE&background=e85d3f&color=fff&size=150",
  bannerUrl:
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  status: "OPEN",
  schedule: "Lunes a Domingo - 11:00 AM a 10:00 PM",
  phone: null,
  address: null,
  deliveryFee: 4000,
};

// ─── Categorías (orden de aparición en el menú) ─────────────────────────────

const CATEGORIES = [
  { name: "Hamburguesas", position: 0 },
  { name: "Entradas",     position: 1 },
  { name: "Pastas",       position: 2 },
  { name: "Pizzas",       position: 3 },
  { name: "Bebidas",      position: 4 },
  { name: "Postres",      position: 5 },
];

// ─── Productos (migrados de src/data/data.js) ────────────────────────────────
// categoryName → coincide exactamente con CATEGORIES[].name

const PRODUCTS = [
  // ── Hamburguesas ────────────────────────────────────────────────────────
  {
    categoryName: "Hamburguesas",
    name: "Classic Burger",
    description:
      "Carne artesanal de 150g, queso cheddar, tomate, lechuga fresca y salsa de la casa.",
    price: 22000,
    cost: 8500,
    sold: 148,
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [
      { name: "Queso extra",           price: 3000, cost: 800  },
      { name: "Tocino",                price: 4000, cost: 1500 },
      { name: "Cebolla caramelizada",  price: 2000, cost: 500  },
    ],
  },
  {
    categoryName: "Hamburguesas",
    name: "Double Smash",
    description:
      "Doble carne tipo smash, doble queso cheddar, tocino ahumado y salsa BBQ.",
    price: 28000,
    cost: 12000,
    sold: 87,
    imageUrl:
      "https://images.unsplash.com/photo-1594212202206-b1836171f845?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 1,
    options: [
      { name: "Queso extra",  price: 3000, cost: 800  },
      { name: "Tocino extra", price: 4000, cost: 1500 },
    ],
  },
  // ── Entradas ─────────────────────────────────────────────────────────────
  {
    categoryName: "Entradas",
    name: "Papas Especiales",
    description:
      "Papas a la francesa crocantes con queso fundido y trocitos de tocino.",
    price: 12000,
    cost: 4000,
    sold: 203,
    imageUrl:
      "https://images.unsplash.com/photo-1576107232684-1279f3908581?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [],
  },
  {
    categoryName: "Entradas",
    name: "Aros de Cebolla",
    description: "Aros de cebolla apanados con salsa ranch.",
    price: 10000,
    cost: 3500,
    sold: 95,
    imageUrl:
      "https://images.unsplash.com/photo-1639024470295-883dfb2eb4b2?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 1,
    options: [],
  },
  // ── Pastas ──────────────────────────────────────────────────────────────
  {
    categoryName: "Pastas",
    name: "Pasta Alfredo",
    description:
      "Pasta fettuccine con cremosa salsa alfredo, queso parmesano y hierbas frescas.",
    price: 26000,
    cost: 10500,
    sold: 96,
    imageUrl:
      "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [
      { name: "Pollo grillado", price: 5000, cost: 2000 },
      { name: "Camarones",      price: 8000, cost: 4000 },
    ],
  },
  // ── Pizzas ──────────────────────────────────────────────────────────────
  {
    categoryName: "Pizzas",
    name: "Pizza Pepperoni",
    description:
      "Pizza clásica con abundante pepperoni, mozzarella y salsa de tomate artesanal.",
    price: 30000,
    cost: 12500,
    sold: 132,
    imageUrl:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [
      { name: "Borde relleno", price: 5000, cost: 2000 },
      { name: "Extra queso",   price: 3000, cost: 1000 },
    ],
  },
  // ── Bebidas ─────────────────────────────────────────────────────────────
  {
    categoryName: "Bebidas",
    name: "Coca-Cola",
    description: "400 ml.",
    price: 5000,
    cost: 2000,
    sold: 320,
    imageUrl:
      "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [],
  },
  {
    categoryName: "Bebidas",
    name: "Limonada Natural",
    description: "Limonada natural en agua o leche.",
    price: 7000,
    cost: 2500,
    sold: 210,
    imageUrl:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 1,
    options: [
      { name: "En leche (Cerezada)", price: 2000, cost: 500 },
    ],
  },
  // ── Postres ─────────────────────────────────────────────────────────────
  {
    categoryName: "Postres",
    name: "Brownie con Helado",
    description:
      "Brownie de chocolate tibio acompañado de helado de vainilla y salsa de caramelo.",
    price: 12000,
    cost: 4000,
    sold: 75,
    imageUrl:
      "https://images.unsplash.com/photo-1607920591413-4ec007e70023?auto=format&fit=crop&w=400&q=80",
    available: true,
    position: 0,
    options: [
      { name: "Doble helado", price: 3000, cost: 1200 },
    ],
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("[seed] ▶  Iniciando seed...\n");

  // 1. Upsert restaurante
  const restaurant = await prisma.restaurant.upsert({
    where:  { slug: RESTAURANT.slug },
    update: {}, // no sobreescribir si ya existe
    create: RESTAURANT,
  });
  console.log(`[seed] ✔  Restaurante: ${restaurant.name} (${restaurant.id})`);

  // 2. Upsert categorías
  const categoryMap = {}; // name → Category record
  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: {
        restaurantId_name: { restaurantId: restaurant.id, name: cat.name },
      },
      update: { position: cat.position },
      create: {
        restaurantId: restaurant.id,
        name:         cat.name,
        position:     cat.position,
      },
    });
    categoryMap[cat.name] = record;
    console.log(`[seed] ✔  Categoría: ${cat.name}`);
  }

  // 3. Upsert productos y opciones
  console.log("");
  for (const prod of PRODUCTS) {
    const { categoryName, options, ...productData } = prod;
    const category = categoryMap[categoryName];

    const product = await prisma.product.upsert({
      where: {
        restaurantId_name: { restaurantId: restaurant.id, name: productData.name },
      },
      update: {
        price:     productData.price,
        cost:      productData.cost,
        imageUrl:  productData.imageUrl,
        available: productData.available,
        position:  productData.position,
      },
      create: {
        ...productData,
        restaurantId: restaurant.id,
        categoryId:   category.id,
      },
    });

    // Upsert opciones
    for (const opt of options) {
      await prisma.productOption.upsert({
        where: {
          productId_name: { productId: product.id, name: opt.name },
        },
        update: { price: opt.price, cost: opt.cost ?? null },
        create: {
          productId: product.id,
          name:      opt.name,
          price:     opt.price,
          cost:      opt.cost ?? null,
        },
      });
    }

    console.log(
      `[seed] ✔  Producto: ${product.name} — $${productData.price.toLocaleString("es-CO")} COP` +
      (options.length ? ` (${options.length} adicional(es))` : "")
    );
  }

  console.log("\n[seed] ✅  Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("[seed] ❌  Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
