const express = require("express");
const router = express.Router();
const {
  createEquipmentHeader,
  getAllEquipmentHeaders,
  getEquipmentHeaderById,
} = require("../controller/EquipmentHeader");

// POST /api/equipment-headers - Create new equipment header
router.post("/", createEquipmentHeader);

// GET /api/equipment-headers - Get all equipment headers
router.get("/", getAllEquipmentHeaders);

// GET /api/equipment-headers/:id - Get equipment header by ID
router.get("/:id", getEquipmentHeaderById);

module.exports = router;
