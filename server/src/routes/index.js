const express = require("express");
const menuRoutes = require("./menu.routes");
const authRoutes = require("./auth.routes");
const orderRoutes = require("./order.routes");
const superadminRoutes = require("./superadmin.routes");
const couponRoutes = require("./coupon.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", orderRoutes);
router.use("/superadmin", superadminRoutes);
router.use("/coupons", couponRoutes);

module.exports = router;
