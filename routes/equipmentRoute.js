const express = require("express");
const router = express.Router();
const {
  createEquipmentRoute,
  getAllEquipmentRoutes,
  getEquipmentRouteById,
  getEquipmentRoutesByEquipmentId,
} = require("../controller/EquipmentRoute");

// POST /api/equipment-routes - Create new equipment route
router.post("/", createEquipmentRoute);

// GET /api/equipment-routes - Get all equipment routes
router.get("/", getAllEquipmentRoutes);

// GET /api/equipment-routes/:route_id - Get equipment route by route_id
router.get("/:route_id", getEquipmentRouteById);

// GET /api/equipment-routes/equipment/:eqp_id - Get routes by equipment ID
router.get("/equipment/:eqp_id", getEquipmentRoutesByEquipmentId);

module.exports = router;
