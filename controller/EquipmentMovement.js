const { db } = require("../database/db");
const {
  successResponse,
  errorResponse,
  API_CODES,
} = require("../utils/responseHandler");

// Constants
const MAX_CYCLES_PER_GROUP = 6;
const MAX_OBJECTS_PER_FIELD = 200;
const TOTAL_FIELD_COLUMNS = 10;

/**
 * Distribute cycles across groups (max 6 per group)
 * Returns array of group configurations
 */
const distributeCyclesAcrossGroups = (totalCycles, startGroupNo = 1) => {
  const groups = [];
  let remainingCycles = totalCycles;
  let currentGroupNo = startGroupNo;

  while (remainingCycles > 0) {
    const cyclesForThisGroup = Math.min(remainingCycles, MAX_CYCLES_PER_GROUP);
    groups.push({
      group_no: currentGroupNo,
      cycle_count: cyclesForThisGroup,
      cycles: Array.from({ length: cyclesForThisGroup }, (_, i) => i + 1),
    });
    remainingCycles -= cyclesForThisGroup;
    currentGroupNo++;
  }

  return groups;
};

/**
 * Distribute data objects across field_data columns (max 200 per column)
 * Returns object with field_data1 through field_data10
 */
const distributeDataAcrossFields = (dataObjects = []) => {
  const fieldData = {};

  // Initialize all 10 field_data columns
  for (let i = 1; i <= TOTAL_FIELD_COLUMNS; i++) {
    fieldData[`field_data${i}`] = null;
  }

  if (!Array.isArray(dataObjects) || dataObjects.length === 0) {
    return fieldData;
  }

  let currentFieldIndex = 1;
  let objectsInCurrentField = 0;
  let currentFieldArray = [];

  for (const obj of dataObjects) {
    // If current field is full, move to next field
    if (objectsInCurrentField >= MAX_OBJECTS_PER_FIELD) {
      fieldData[`field_data${currentFieldIndex}`] =
        JSON.stringify(currentFieldArray);
      currentFieldIndex++;
      currentFieldArray = [];
      objectsInCurrentField = 0;

      // Stop if we've filled all 10 columns
      if (currentFieldIndex > TOTAL_FIELD_COLUMNS) {
        console.warn(
          "Data exceeds capacity: more than " +
            MAX_OBJECTS_PER_FIELD * TOTAL_FIELD_COLUMNS +
            " objects"
        );
        break;
      }
    }

    currentFieldArray.push(obj);
    objectsInCurrentField++;
  }

  // Store remaining objects in current field
  if (
    currentFieldArray.length > 0 &&
    currentFieldIndex <= TOTAL_FIELD_COLUMNS
  ) {
    fieldData[`field_data${currentFieldIndex}`] =
      JSON.stringify(currentFieldArray);
  }

  return fieldData;
};

// Create new equipment movement record
const createEquipmentMovement = async (req, res) => {
  try {
    const {
      route_id,
      eqp_id,
      cycles,
      current_data_col,
      current_data_count,
      start_time,
      end_time,
      group_no,
      group_inserted_on,
      dataObjects,
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

    // Validate cycles
    if (!cycles || isNaN(cycles) || cycles <= 0) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "cycles must be a valid positive number",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate dataObjects
    if (!dataObjects || !Array.isArray(dataObjects)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "dataObjects must be a valid array containing time and GPS data",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate numeric fields if provided
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

    // Validate group_no if provided
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

    // Validate group_inserted_on if provided
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

    // Fetch route data from equipment_route_lock_details_all table
    let routeData = null;
    try {
      const routeQuery = `
        SELECT start_gps, end_gps 
        FROM equipment_route_lock_details_all 
        WHERE route_id = ?
      `;
      const [routeRows] = await db.execute(routeQuery, [route_id]);

      if (routeRows.length === 0) {
        return res
          .status(404)
          .json(
            errorResponse(
              404,
              "Route not found for the provided route_id",
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      routeData = routeRows[0];
    } catch (error) {
      console.error("Error fetching route data:", error);
      return res
        .status(500)
        .json(
          errorResponse(
            500,
            "Error fetching route data",
            API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR
          )
        );
    }

    // Distribute data objects across field_data columns
    const fieldDataDistribution = distributeDataAcrossFields(dataObjects);

    // Distribute cycles across groups (max 6 cycles per group)
    const totalCycles = parseInt(cycles);
    const startingGroupNo = group_no || 1;
    const groupsToCreate = distributeCyclesAcrossGroups(
      totalCycles,
      startingGroupNo
    );

    // Build insert query for all 10 field_data columns
    const insertQuery = `
      INSERT INTO equipment_movement_details_all 
      (route_id, eqp_id, cycle, current_data_col, current_data_count, start_gps, start_time, end_gps, end_time, group_no, group_inserted_on, field_data1, field_data2, field_data3, field_data4, field_data5, field_data6, field_data7, field_data8, field_data9, field_data10, inserted_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertedRecords = [];
    let recordsInsertedCount = 0;

    try {
      // Create one row for each cycle
      for (const groupConfig of groupsToCreate) {
        for (const cycleNum of groupConfig.cycles) {
          const groupInsertedOn = group_inserted_on
            ? new Date(group_inserted_on)
            : inserted_on;

          const [result] = await db.execute(insertQuery, [
            route_id,
            eqp_id,
            cycleNum,
            current_data_col || null,
            current_data_count || null,
            routeData.start_gps || null, // From route table
            start_time ? new Date(start_time) : null,
            routeData.end_gps || null, // From route table
            end_time ? new Date(end_time) : null,
            groupConfig.group_no,
            groupInsertedOn,
            fieldDataDistribution.field_data1 || null,
            fieldDataDistribution.field_data2 || null,
            fieldDataDistribution.field_data3 || null,
            fieldDataDistribution.field_data4 || null,
            fieldDataDistribution.field_data5 || null,
            fieldDataDistribution.field_data6 || null,
            fieldDataDistribution.field_data7 || null,
            fieldDataDistribution.field_data8 || null,
            fieldDataDistribution.field_data9 || null,
            fieldDataDistribution.field_data10 || null,
            inserted_on,
          ]);

          if (result.affectedRows > 0) {
            recordsInsertedCount++;
            insertedRecords.push({
              id: result.insertId,
              route_id,
              eqp_id,
              cycle: cycleNum,
              group_no: groupConfig.group_no,
              group_inserted_on: groupInsertedOn,
              inserted_on,
            });
          }
        }
      }

      if (recordsInsertedCount > 0) {
        return res.status(201).json(
          successResponse(
            201,
            `Equipment movement created successfully - ${recordsInsertedCount} record(s) inserted`,
            {
              total_records_inserted: recordsInsertedCount,
              total_cycles: totalCycles,
              total_groups: groupsToCreate.length,
              groups_created: groupsToCreate,
              records: insertedRecords,
            },
            API_CODES.EQUIPMENT_MOVEMENT.CREATE_SUCCESS
          )
        );
      } else {
        return res
          .status(500)
          .json(
            errorResponse(
              500,
              "Failed to create equipment movement records",
              API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR
            )
          );
      }
    } catch (error) {
      console.error("Error inserting equipment movement records:", error);
      throw error;
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
