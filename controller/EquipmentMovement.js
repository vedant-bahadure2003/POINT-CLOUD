const { db } = require("../database/db");

// Create new equipment movement record
const createEquipmentMovement = async (req, res) => {
  try {
    const {
      route_id,
      eqp_id,
      cycle,
      current_cycle,
      start_gps,
      start_time,
      end_gps,
      end_time,
      group_no,
      group_inserted_on,
      other_details,
    } = req.body;

    // Validate required fields
    if (!route_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: route_id is required",
      });
    }

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
    if (cycle && isNaN(cycle)) {
      return res.status(400).json({
        success: false,
        message: "cycle must be a valid number",
      });
    }

    if (current_cycle && isNaN(current_cycle)) {
      return res.status(400).json({
        success: false,
        message: "current_cycle must be a valid number",
      });
    }

    if (group_no && isNaN(group_no)) {
      return res.status(400).json({
        success: false,
        message: "group_no must be a valid number",
      });
    }

    // Validate time fields if provided
    if (
      start_time &&
      !(start_time instanceof Date) &&
      isNaN(Date.parse(start_time))
    ) {
      return res.status(400).json({
        success: false,
        message: "start_time must be a valid date/time",
      });
    }

    if (
      end_time &&
      !(end_time instanceof Date) &&
      isNaN(Date.parse(end_time))
    ) {
      return res.status(400).json({
        success: false,
        message: "end_time must be a valid date/time",
      });
    }

    if (
      group_inserted_on &&
      !(group_inserted_on instanceof Date) &&
      isNaN(Date.parse(group_inserted_on))
    ) {
      return res.status(400).json({
        success: false,
        message: "group_inserted_on must be a valid date/time",
      });
    }

    // Current timestamp for inserted_on
    const inserted_on = new Date();

    // Insert query
    const insertQuery = `
      INSERT INTO equipment_movement_details_all 
      (route_id, eqp_id, cycle, current_cycle, start_gps, start_time, end_gps, end_time, group_no, group_inserted_on, other_details, inserted_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      route_id,
      eqp_id,
      cycle || null,
      current_cycle || null,
      start_gps || null,
      start_time ? new Date(start_time) : null,
      end_gps || null,
      end_time ? new Date(end_time) : null,
      group_no || null,
      group_inserted_on ? new Date(group_inserted_on) : null,
      other_details || null,
      inserted_on,
    ]);

    // Check if insertion was successful
    if (result.affectedRows > 0) {
      return res.status(201).json({
        success: true,
        message: "Equipment movement created successfully",
        data: {
          id: result.insertId,
          route_id,
          eqp_id,
          cycle: cycle || null,
          current_cycle: current_cycle || null,
          start_gps: start_gps || null,
          start_time: start_time ? new Date(start_time) : null,
          end_gps: end_gps || null,
          end_time: end_time ? new Date(end_time) : null,
          group_no: group_no || null,
          group_inserted_on: group_inserted_on
            ? new Date(group_inserted_on)
            : null,
          other_details: other_details || null,
          inserted_on,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to create equipment movement",
      });
    }
  } catch (error) {
    console.error("Error creating equipment movement:", error);

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Equipment movement with this ID already exists",
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

// Get all equipment movements
const getAllEquipmentMovements = async (req, res) => {
  try {
    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery);

    return res.status(200).json({
      success: true,
      message: "Equipment movements retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment movements:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get equipment movement by route_id
const getEquipmentMovementById = async (req, res) => {
  try {
    const { route_id } = req.params;

    if (!route_id) {
      return res.status(400).json({
        success: false,
        message: "route_id parameter is required",
      });
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE route_id = ?
    `;
    const [rows] = await db.execute(selectQuery, [route_id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Equipment movement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Equipment movement retrieved successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching equipment movement by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get equipment movements by eqp_id
const getEquipmentMovementsByEquipmentId = async (req, res) => {
  try {
    const { eqp_id } = req.params;

    if (!eqp_id) {
      return res.status(400).json({
        success: false,
        message: "eqp_id parameter is required",
      });
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE eqp_id = ?
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery, [eqp_id]);

    return res.status(200).json({
      success: true,
      message: "Equipment movements retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment movements by equipment ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get equipment movements by group_no
const getEquipmentMovementsByGroupNo = async (req, res) => {
  try {
    const { group_no } = req.params;

    if (!group_no) {
      return res.status(400).json({
        success: false,
        message: "group_no parameter is required",
      });
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE group_no = ?
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery, [group_no]);

    return res.status(200).json({
      success: true,
      message: "Equipment movements retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment movements by group number:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createEquipmentMovement,
  getAllEquipmentMovements,
  getEquipmentMovementById,
  getEquipmentMovementsByEquipmentId,
  getEquipmentMovementsByGroupNo,
};
