const { db } = require("../database/db");
const { uniqueIdGenerateBulk } = require("../database/uniqueHeader");

// Create new equipment route record
const createEquipmentRoute = async (req, res) => {
  try {
    const {
      eqp_id,
      start_gps,
      end_gps,
      start_km,
      start_chainage,
      end_km,
      end_chainage,
    } = req.body;

    // Validate required fields
    if (!eqp_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: eqp_id is required",
      });
    }

    // Validate GPS coordinates if provided
    if (start_gps && typeof start_gps !== "string") {
      return res.status(400).json({
        success: false,
        message: "start_gps must be a valid string",
      });
    }

    if (end_gps && typeof end_gps !== "string") {
      return res.status(400).json({
        success: false,
        message: "end_gps must be a valid string",
      });
    }

    // Validate numeric fields if provided
    if (start_km && isNaN(start_km)) {
      return res.status(400).json({
        success: false,
        message: "start_km must be a valid number",
      });
    }

    if (end_km && isNaN(end_km)) {
      return res.status(400).json({
        success: false,
        message: "end_km must be a valid number",
      });
    }

    if (start_chainage && isNaN(start_chainage)) {
      return res.status(400).json({
        success: false,
        message: "start_chainage must be a valid number",
      });
    }

    if (end_chainage && isNaN(end_chainage)) {
      return res.status(400).json({
        success: false,
        message: "end_chainage must be a valid number",
      });
    }

    // Generate unique route ID with ROT prefix
    const route_id = await uniqueIdGenerateBulk(
      "ROT",
      "equipment_route_lock_details_all",
      "route_id"
    );

    // Current timestamp for inserted_on
    const inserted_on = new Date();

    // Insert query
    const insertQuery = `
      INSERT INTO equipment_route_lock_details_all 
      (route_id, eqp_id, start_gps, end_gps, start_km, start_chainage, end_km, end_chainage, inserted_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      route_id,
      eqp_id,
      start_gps || null,
      end_gps || null,
      start_km || null,
      start_chainage || null,
      end_km || null,
      end_chainage || null,
      inserted_on,
    ]);

    // Check if insertion was successful
    if (result.affectedRows > 0) {
      return res.status(201).json({
        success: true,
        message: "Equipment route created successfully",
        data: {
          id: result.insertId,
          route_id,
          eqp_id,
          start_gps: start_gps || null,
          end_gps: end_gps || null,
          start_km: start_km || null,
          start_chainage: start_chainage || null,
          end_km: end_km || null,
          end_chainage: end_chainage || null,
          inserted_on,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to create equipment route",
      });
    }
  } catch (error) {
    console.error("Error creating equipment route:", error);

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Equipment route with this ID already exists",
      });
    }

    // Handle foreign key constraint error
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        message: "Invalid eqp_id: Equipment does not exist",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all equipment routes
const getAllEquipmentRoutes = async (req, res) => {
  try {
    const selectQuery = `
      SELECT * FROM equipment_route_lock_details_all 
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery);

    return res.status(200).json({
      success: true,
      message: "Equipment routes retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment routes:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get equipment route by route_id
const getEquipmentRouteById = async (req, res) => {
  try {
    const { route_id } = req.params;

    if (!route_id) {
      return res.status(400).json({
        success: false,
        message: "route_id parameter is required",
      });
    }

    const selectQuery = `
      SELECT * FROM equipment_route_lock_details_all 
      WHERE route_id = ?
    `;
    const [rows] = await db.execute(selectQuery, [route_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment route not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Equipment route retrieved successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching equipment route by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get equipment routes by eqp_id
const getEquipmentRoutesByEquipmentId = async (req, res) => {
  try {
    const { eqp_id } = req.params;

    if (!eqp_id) {
      return res.status(400).json({
        success: false,
        message: "eqp_id parameter is required",
      });
    }

    const selectQuery = `
      SELECT * FROM equipment_route_lock_details_all 
      WHERE eqp_id = ?
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery, [eqp_id]);

    return res.status(200).json({
      success: true,
      message: "Equipment routes retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment routes by equipment ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createEquipmentRoute,
  getAllEquipmentRoutes,
  getEquipmentRouteById,
  getEquipmentRoutesByEquipmentId,
};
