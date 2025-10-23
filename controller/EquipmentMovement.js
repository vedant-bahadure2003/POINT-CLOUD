const { db } = require("../database/db");
const {
  successResponse,
  errorResponse,
  API_CODES,
} = require("../utils/responseHandler");

// Create new equipment movement record
const createEquipmentMovement = async (req, res) => {
  try {
    const {
      route_id,
      eqp_id,
      cycle,
      current_data_col,
      current_data_count,
      start_gps,
      start_time,
      end_gps,
      end_time,
      group_no,
      group_inserted_on,
      field_data1,
      field_data2,
      field_data3,
      field_data4,
      field_data5,
    } = req.body;

    // Validate required fields
    if (!route_id) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Missing required field: route_id is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (!eqp_id) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Missing required field: eqp_id is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate GPS coordinates if provided
    if (start_gps && typeof start_gps !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "start_gps must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (end_gps && typeof end_gps !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "end_gps must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate numeric fields if provided
    if (cycle && isNaN(cycle)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "cycle must be a valid number",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (current_data_col && typeof current_data_col !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "current_data_col must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (current_data_count && isNaN(current_data_count)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "current_data_count must be a valid number",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (group_no && isNaN(group_no)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "group_no must be a valid number",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate field_data fields if provided
    if (field_data1 && typeof field_data1 !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "field_data1 must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (field_data2 && typeof field_data2 !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "field_data2 must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (field_data3 && typeof field_data3 !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "field_data3 must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (field_data4 && typeof field_data4 !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "field_data4 must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (field_data5 && typeof field_data5 !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "field_data5 must be a valid string",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate time fields if provided
    if (
      start_time &&
      !(start_time instanceof Date) &&
      isNaN(Date.parse(start_time))
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "start_time must be a valid date/time",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (
      end_time &&
      !(end_time instanceof Date) &&
      isNaN(Date.parse(end_time))
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "end_time must be a valid date/time",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (
      group_inserted_on &&
      !(group_inserted_on instanceof Date) &&
      isNaN(Date.parse(group_inserted_on))
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "group_inserted_on must be a valid date/time",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Current timestamp for inserted_on
    const inserted_on = new Date();

    // Insert query
    const insertQuery = `
      INSERT INTO equipment_movement_details_all 
      (route_id, eqp_id, cycle, current_data_col, current_data_count, start_gps, start_time, end_gps, end_time, group_no, group_inserted_on, field_data1, field_data2, field_data3, field_data4, field_data5, inserted_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      route_id,
      eqp_id,
      cycle || null,
      current_data_col || null,
      current_data_count || null,
      start_gps || null,
      start_time ? new Date(start_time) : null,
      end_gps || null,
      end_time ? new Date(end_time) : null,
      group_no || null,
      group_inserted_on ? new Date(group_inserted_on) : null,
      field_data1 || null,
      field_data2 || null,
      field_data3 || null,
      field_data4 || null,
      field_data5 || null,
      inserted_on,
    ]);

    // Check if insertion was successful
    if (result.affectedRows > 0) {
      const responseData = {
        id: result.insertId,
        route_id,
        eqp_id,
        cycle: cycle || null,
        current_data_col: current_data_col || null,
        current_data_count: current_data_count || null,
        start_gps: start_gps || null,
        start_time: start_time ? new Date(start_time) : null,
        end_gps: end_gps || null,
        end_time: end_time ? new Date(end_time) : null,
        group_no: group_no || null,
        group_inserted_on: group_inserted_on
          ? new Date(group_inserted_on)
          : null,
        field_data1: field_data1 || null,
        field_data2: field_data2 || null,
        field_data3: field_data3 || null,
        field_data4: field_data4 || null,
        field_data5: field_data5 || null,
        inserted_on,
      };

      return res
        .status(201)
        .json(
          successResponse(
            201,
            "Equipment movement created successfully",
            responseData,
            API_CODES.EQUIPMENT_MOVEMENT.CREATE_SUCCESS
          )
        );
    } else {
      return res
        .status(500)
        .json(
          errorResponse(
            500,
            "Failed to create equipment movement",
            API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR
          )
        );
    }
  } catch (error) {
    console.error("Error creating equipment movement:", error);

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json(
          errorResponse(
            409,
            "Equipment movement with this ID already exists",
            API_CODES.EQUIPMENT_MOVEMENT.DUPLICATE_ERROR
          )
        );
    }

    // Handle foreign key constraint error
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Invalid eqp_id: Equipment does not exist",
            API_CODES.EQUIPMENT_MOVEMENT.FOREIGN_KEY_ERROR
          )
        );
    }

    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
          error.message
        )
      );
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

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment movements retrieved successfully",
          rows,
          API_CODES.EQUIPMENT_MOVEMENT.GET_SUCCESS,
          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment movements:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

// Get equipment movement by route_id
const getEquipmentMovementById = async (req, res) => {
  try {
    const { route_id } = req.params;

    if (!route_id) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "route_id parameter is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE route_id = ?
    `;
    const [rows] = await db.execute(selectQuery, [route_id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json(
          errorResponse(
            404,
            "Equipment movement not found",
            API_CODES.EQUIPMENT_MOVEMENT.GET_ERROR
          )
        );
    }

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment movement retrieved successfully",
          rows[0],
          API_CODES.EQUIPMENT_MOVEMENT.GET_SUCCESS
        )
      );
  } catch (error) {
    console.error("Error fetching equipment movement by ID:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

// Get equipment movements by eqp_id and route_id (both required)
const getEquipmentMovementsByEquipmentId = async (req, res) => {
  try {
    const { eqp_id, route_id } = req.params; // Get both from URL parameters

    if (!eqp_id) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "eqp_id parameter is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    if (!route_id) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "route_id parameter is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE eqp_id = ? AND route_id = ?
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery, [eqp_id, route_id]);

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment movements retrieved successfully",
          rows,
          API_CODES.EQUIPMENT_MOVEMENT.GET_SUCCESS,
          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment movements by equipment ID:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

// Get equipment movements by group_no
const getEquipmentMovementsByGroupNo = async (req, res) => {
  try {
    const { group_no } = req.params;

    if (!group_no) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "group_no parameter is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    const selectQuery = `
      SELECT * FROM equipment_movement_details_all 
      WHERE group_no = ?
      ORDER BY inserted_on DESC
    `;
    const [rows] = await db.execute(selectQuery, [group_no]);

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment movements retrieved successfully",
          rows,
          API_CODES.EQUIPMENT_MOVEMENT.GET_SUCCESS,
          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment movements by group number:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

module.exports = {
  createEquipmentMovement,
  getAllEquipmentMovements,
  getEquipmentMovementById,
  getEquipmentMovementsByEquipmentId,
  getEquipmentMovementsByGroupNo,
};
