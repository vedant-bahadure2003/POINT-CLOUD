const express = require("express");
const router = express.Router();
const {
  createEquipmentMovement,
  getAllEquipmentMovements,
  getEquipmentMovementById,
  getEquipmentMovementsByEquipmentId,
  getEquipmentMovementsByGroupNo,
} = require("../controller/EquipmentMovement");

// POST /api/equipment-movements - Create new equipment movement
router.post("/", createEquipmentMovement);

// GET /api/equipment-movements - Get all equipment movements
router.get("/", getAllEquipmentMovements);

// GET /api/equipment-movements/:route_id - Get equipment movement by route_id
router.get("/:route_id", getEquipmentMovementById);

// GET /api/equipment-movements/equipment/:eqp_id - Get movements by equipment ID
router.get("/equipment/:eqp_id", getEquipmentMovementsByEquipmentId);

// GET /api/equipment-movements/group/:group_no - Get movements by group number
router.get("/group/:group_no", getEquipmentMovementsByGroupNo);

module.exports = router;
