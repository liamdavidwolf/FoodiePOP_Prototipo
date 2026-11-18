/**
 * superadmin.routes.js
 * Rutas del panel SuperAdmin de FoodiePOP (Etapa 5C).
 *
 * Todas las rutas exigen:
 *  1. requireAuth  — sesión JWT válida.
 *  2. requireRole('SUPERADMIN') — rol global SUPERADMIN.
 *
 * Prefijo montado en: /api/v1/superadmin
 */
"use strict";

const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/superadmin.controller");

const router = express.Router();

// Seguridad global: cualquier ruta bajo /superadmin exige sesión + rol SUPERADMIN
router.use(requireAuth, requireRole("SUPERADMIN"));

// ─── Dashboard y Métricas Globales ───────────────────────────────────────────
router.get("/metrics", ctrl.getMetrics);
router.get("/stats", ctrl.getNetworkStats);

// ─── Restaurantes ─────────────────────────────────────────────────────────────
router.get("/restaurants", ctrl.listRestaurants);
router.post("/restaurants", ctrl.createRestaurant);
router.get("/restaurants/:restaurantId", ctrl.getRestaurantDetail);
router.patch("/restaurants/:restaurantId", ctrl.updateRestaurant);
router.patch("/restaurants/:restaurantId/status", ctrl.setRestaurantStatus);

// ─── Personal y Membresías de un restaurante ──────────────────────────────────
router.get("/restaurants/:restaurantId/staff", ctrl.listStaff);
router.post("/restaurants/:restaurantId/staff", ctrl.addStaff);
router.patch("/restaurants/:restaurantId/staff/:membershipId", ctrl.updateStaffMembership);

// Endpoints previos de membresías (compatibilidad de backward-compatibility)
router.get("/restaurants/:restaurantId/memberships", ctrl.listMemberships);
router.put("/restaurants/:restaurantId/memberships", ctrl.upsertMembership);
router.delete("/restaurants/:restaurantId/memberships/:userId", ctrl.revokeMembership);

// ─── Usuarios ─────────────────────────────────────────────────────────────────
router.get("/users", ctrl.listUsers);
router.get("/users/:userId", ctrl.getUserDetail);
router.patch("/users/:userId/role", ctrl.setUserRole);
router.patch("/users/:userId/active", ctrl.setUserActive);

// ─── Consulta Global de Pedidos (Solo Lectura) ─────────────────────────────────
router.get("/orders", ctrl.listOrders);
router.get("/orders/:orderId", ctrl.getOrderDetail);

module.exports = router;
