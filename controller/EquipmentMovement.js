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

/**
 * Check if GPS coordinates match within a tolerance
 */
const isGPSMatch = (gps1, gps2, tolerance = 0.001) => {
  if (!gps1 || !gps2) return false;

  try {
    let coords1, coords2;

    // Handle different GPS formats
    if (typeof gps1 === "string") {
      if (gps1.includes(",")) {
        // Format: "28.7041,77.1025"
        const [lat, lng] = gps1.split(",");
        coords1 = { latitude: parseFloat(lat), longitude: parseFloat(lng) };
      } else {
        // Format: '{"latitude": 28.7041, "longitude": 77.1025}'
        coords1 = JSON.parse(gps1);
      }
    } else {
      coords1 = gps1;
    }

    if (typeof gps2 === "string") {
      if (gps2.includes(",")) {
        // Format: "28.7041,77.1025"
        const [lat, lng] = gps2.split(",");
        coords2 = { latitude: parseFloat(lat), longitude: parseFloat(lng) };
      } else {
        // Format: '{"latitude": 28.7041, "longitude": 77.1025}'
        coords2 = JSON.parse(gps2);
      }
    } else {
      coords2 = gps2;
    }

    const lat1 = parseFloat(coords1.latitude || coords1.lat);
    const lng1 = parseFloat(coords1.longitude || coords1.lng);
    const lat2 = parseFloat(coords2.latitude || coords2.lat);
    const lng2 = parseFloat(coords2.longitude || coords2.lng);

    console.log("🔍 GPS Comparison:", {
      gps1: { lat: lat1, lng: lng1 },
      gps2: { lat: lat2, lng: lng2 },
      lat_diff: Math.abs(lat1 - lat2),
      lng_diff: Math.abs(lng1 - lng2),
      tolerance,
      match:
        Math.abs(lat1 - lat2) <= tolerance &&
        Math.abs(lng1 - lng2) <= tolerance,
    });

    return (
      Math.abs(lat1 - lat2) <= tolerance && Math.abs(lng1 - lng2) <= tolerance
    );
  } catch (error) {
    console.error("Error parsing GPS coordinates:", error);
    console.error("GPS1:", gps1, "GPS2:", gps2);
    return false;
  }
};

/**
 * Determine cycle status based on GPS data for a specific cycle
 */
const determineCycleStatus = (dataObjects, routeStartGPS, routeEndGPS) => {
  if (!dataObjects || !Array.isArray(dataObjects) || dataObjects.length === 0) {
    return "pending";
  }

  let hasReachedStart = false;
  let hasReachedEnd = false;

  // Check each data object for start_gps, end_gps
  for (const dataPoint of dataObjects) {
    // Check if start_gps matches route start_gps
    if (dataPoint.start_gps) {
      if (isGPSMatch(dataPoint.start_gps, routeStartGPS)) {
        hasReachedStart = true;
      }
    }

    // Check if end_gps matches route end_gps
    if (dataPoint.end_gps) {
      if (isGPSMatch(dataPoint.end_gps, routeEndGPS)) {
        hasReachedEnd = true;
      }
    }
  }

  if (hasReachedEnd) {
    return "completed";
  } else if (hasReachedStart) {
    return "live";
  } else {
    return "pending";
  }
};

// Create new equipment movement record
const createEquipmentMovement = async (req, res) => {
  try {
    const {
      route_id,
      eqp_id,
      cycles, // Total number of cycles (like 6)
      current_data_col,
      current_data_count,
      start_time,
      end_time,
      group_no,
      group_inserted_on,
      dataObjects, // GPS tracking data for the current cycle
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

    // Validate dataObjects (GPS tracking data)
    if (!dataObjects || !Array.isArray(dataObjects)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "dataObjects must be a valid array containing start_gps, start_time, end_gps, end_time",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate dataObjects structure
    for (let i = 0; i < dataObjects.length; i++) {
      const dataObj = dataObjects[i];
      if (!dataObj.start_gps && !dataObj.end_gps) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain at least start_gps or end_gps`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }
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
            "current_data_count must be a valid number (optional - will be auto-calculated if not provided)",
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
      console.log("🔍 Fetching route data for route_id:", route_id);
      const routeQuery = `
        SELECT start_gps, end_gps 
        FROM equipment_route_lock_details_all 
        WHERE route_id = ?
      `;
      console.log("📝 Route query:", routeQuery);
      const [routeRows] = await db.execute(routeQuery, [route_id]);
      console.log("📊 Route query result:", routeRows);

      if (routeRows.length === 0) {
        console.log("❌ Route not found for route_id:", route_id);
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
      console.log("✅ Route data found:", routeData);
    } catch (error) {
      console.error("❌ Error fetching route data:", error);
      console.error("❌ Error details:", {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
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

    // Distribute GPS data across field_data columns
    console.log(
      "📦 Processing movement data:",
      dataObjects.length,
      "data objects"
    );
    const fieldDataDistribution = distributeDataAcrossFields(dataObjects);
    console.log(
      "📊 Field data distribution:",
      Object.keys(fieldDataDistribution).filter(
        (key) => fieldDataDistribution[key] !== null
      )
    );

    // Check for existing cycles for this equipment and route
    const existingCyclesQuery = `
      SELECT cycle, status FROM equipment_movement_details_all 
      WHERE route_id = ? AND eqp_id = ? 
      ORDER BY cycle DESC 
      LIMIT 1
    `;
    const [existingCycles] = await db.execute(existingCyclesQuery, [
      route_id,
      eqp_id,
    ]);

    let currentCycleNumber = 1;
    let shouldCreateNewCycle = true;

    if (existingCycles.length > 0) {
      const lastCycle = existingCycles[0];
      currentCycleNumber = lastCycle.cycle;

      console.log(
        `📋 Found existing cycle ${currentCycleNumber} with status: ${lastCycle.status}`
      );

      // If last cycle is completed, create next cycle
      if (lastCycle.status === "completed") {
        currentCycleNumber += 1;
        shouldCreateNewCycle = true;
        console.log(
          `✅ Last cycle completed, creating cycle ${currentCycleNumber}`
        );
      } else {
        // Update existing cycle with new GPS data
        shouldCreateNewCycle = false;
        console.log(
          `🔄 Updating existing cycle ${currentCycleNumber} with new GPS data`
        );
      }
    } else {
      console.log("🆕 No existing cycles found, creating first cycle");
    }

    // Validate we haven't exceeded total cycles
    const totalCycles = parseInt(cycles);
    if (currentCycleNumber > totalCycles) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            `All ${totalCycles} cycles have been completed. Cannot create more cycles.`,
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Determine cycle status based on GPS data
    const cycleStatus = determineCycleStatus(
      dataObjects,
      routeData.start_gps,
      routeData.end_gps
    );
    console.log(
      `📍 Cycle ${currentCycleNumber} status determined:`,
      cycleStatus
    );
    console.log(`🎯 Route start GPS:`, routeData.start_gps);
    console.log(`🏁 Route end GPS:`, routeData.end_gps);

    // Calculate group number for this cycle (6 cycles per group)
    const cycleGroupNo =
      group_no || Math.ceil(currentCycleNumber / MAX_CYCLES_PER_GROUP);

    if (shouldCreateNewCycle) {
      // Create new cycle
      console.log(
        `🆕 Creating new cycle ${currentCycleNumber} in group ${cycleGroupNo}`
      );

      const insertQuery = `
        INSERT INTO equipment_movement_details_all 
        (route_id, eqp_id, cycle, current_data_col, current_data_count, start_gps, start_time, end_gps, end_time, group_no, group_inserted_on, field_data1, field_data2, field_data3, field_data4, field_data5, field_data6, field_data7, field_data8, field_data9, field_data10, status, inserted_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const groupInsertedOn = group_inserted_on
        ? new Date(group_inserted_on)
        : inserted_on;

      const insertParams = [
        route_id,
        eqp_id,
        currentCycleNumber,
        current_data_col || null,
        dataObjects.length, // Use actual count of objects in dataObjects array
        routeData.start_gps || null,
        start_time ? new Date(start_time) : null,
        routeData.end_gps || null,
        end_time ? new Date(end_time) : null,
        cycleGroupNo,
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
        cycleStatus,
        inserted_on,
      ];

      console.log(
        `📊 Creating cycle ${currentCycleNumber} with status: ${cycleStatus}`
      );
      console.log("📋 Insert parameters:", {
        route_id,
        eqp_id,
        cycle: currentCycleNumber,
        current_data_col,
        current_data_count: dataObjects.length, // Actual count of objects
        start_gps: routeData.start_gps,
        start_time,
        end_gps: routeData.end_gps,
        end_time,
        group_no: cycleGroupNo,
        status: cycleStatus,
        field_data1_length: fieldDataDistribution.field_data1
          ? fieldDataDistribution.field_data1.length
          : 0,
      });

      const [result] = await db.execute(insertQuery, insertParams);
      console.log("📈 Insert result:", result);

      if (result.affectedRows > 0) {
        console.log(
          `✅ Successfully created cycle ${currentCycleNumber} with ID: ${result.insertId}`
        );

        let nextCycleMessage = "";
        if (cycleStatus === "completed" && currentCycleNumber < totalCycles) {
          nextCycleMessage = ` Next cycle (${
            currentCycleNumber + 1
          }) will be created on next data submission.`;
        }

        return res.status(201).json(
          successResponse(
            201,
            `Equipment movement cycle ${currentCycleNumber} created successfully.${nextCycleMessage}`,
            {
              id: result.insertId,
              route_id,
              eqp_id,
              cycle: currentCycleNumber,
              status: cycleStatus,
              group_no: cycleGroupNo,
              total_cycles: totalCycles,
              remaining_cycles: totalCycles - currentCycleNumber,
              data_objects_saved: dataObjects.length,
              current_data_count: dataObjects.length,
              can_create_next:
                cycleStatus === "completed" && currentCycleNumber < totalCycles,
              created_on: inserted_on,
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
              "Failed to create equipment movement cycle",
              API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR
            )
          );
      }
    } else {
      // Update existing cycle with new GPS data (append to existing data)
      console.log(
        `🔄 Updating existing cycle ${currentCycleNumber} with new GPS data`
      );

      // First, get existing data from the cycle
      const getExistingDataQuery = `
        SELECT field_data1, field_data2, field_data3, field_data4, field_data5, 
               field_data6, field_data7, field_data8, field_data9, field_data10,
               current_data_count
        FROM equipment_movement_details_all 
        WHERE route_id = ? AND eqp_id = ? AND cycle = ?
      `;

      const [existingDataRows] = await db.execute(getExistingDataQuery, [
        route_id,
        eqp_id,
        currentCycleNumber,
      ]);

      if (existingDataRows.length === 0) {
        return res
          .status(404)
          .json(
            errorResponse(
              404,
              "Equipment movement cycle not found for update",
              API_CODES.EQUIPMENT_MOVEMENT.GET_ERROR
            )
          );
      }

      const existingData = existingDataRows[0];
      console.log("📊 Existing cycle data found");

      // Combine existing GPS data with new GPS data
      const allExistingGPSData = [];

      // Extract existing GPS data from all field_data columns
      for (let i = 1; i <= TOTAL_FIELD_COLUMNS; i++) {
        const fieldKey = `field_data${i}`;
        if (existingData[fieldKey]) {
          try {
            const parsedData = JSON.parse(existingData[fieldKey]);
            if (Array.isArray(parsedData)) {
              allExistingGPSData.push(...parsedData);
            }
          } catch (error) {
            console.error(`Error parsing ${fieldKey}:`, error);
          }
        }
      }

      console.log(
        `📦 Found ${allExistingGPSData.length} existing GPS data points`
      );
      console.log(`➕ Adding ${dataObjects.length} new GPS data points`);

      // Combine existing data with new data
      const combinedGPSData = [...allExistingGPSData, ...dataObjects];
      console.log(`📊 Total GPS data points: ${combinedGPSData.length}`);

      // Redistribute combined data across field_data columns
      const combinedFieldDataDistribution =
        distributeDataAcrossFields(combinedGPSData);

      // Calculate new data count - total number of objects in dataObjects arrays
      const newDataCount = combinedGPSData.length;

      // Determine cycle status based on all GPS data (existing + new)
      const updatedCycleStatus = determineCycleStatus(
        combinedGPSData,
        routeData.start_gps,
        routeData.end_gps
      );

      const updateQuery = `
        UPDATE equipment_movement_details_all 
        SET current_data_col = ?, current_data_count = ?, start_time = ?, end_time = ?, 
            field_data1 = ?, field_data2 = ?, field_data3 = ?, field_data4 = ?, field_data5 = ?, 
            field_data6 = ?, field_data7 = ?, field_data8 = ?, field_data9 = ?, field_data10 = ?, 
            status = ?, inserted_on = ?
        WHERE route_id = ? AND eqp_id = ? AND cycle = ?
      `;

      const updateParams = [
        current_data_col || null,
        newDataCount,
        start_time ? new Date(start_time) : null,
        end_time ? new Date(end_time) : null,
        combinedFieldDataDistribution.field_data1 || null,
        combinedFieldDataDistribution.field_data2 || null,
        combinedFieldDataDistribution.field_data3 || null,
        combinedFieldDataDistribution.field_data4 || null,
        combinedFieldDataDistribution.field_data5 || null,
        combinedFieldDataDistribution.field_data6 || null,
        combinedFieldDataDistribution.field_data7 || null,
        combinedFieldDataDistribution.field_data8 || null,
        combinedFieldDataDistribution.field_data9 || null,
        combinedFieldDataDistribution.field_data10 || null,
        updatedCycleStatus,
        inserted_on,
        route_id,
        eqp_id,
        currentCycleNumber,
      ];

      console.log(
        `📊 Updating cycle ${currentCycleNumber} with status: ${updatedCycleStatus}`
      );
      console.log("📋 Update parameters:", {
        route_id,
        eqp_id,
        cycle: currentCycleNumber,
        current_data_col,
        current_data_count: newDataCount,
        existing_gps_points: allExistingGPSData.length,
        new_gps_points: dataObjects.length,
        total_gps_points: combinedGPSData.length,
        start_time,
        end_time,
        status: updatedCycleStatus,
        field_data1_length: combinedFieldDataDistribution.field_data1
          ? combinedFieldDataDistribution.field_data1.length
          : 0,
      });

      const [result] = await db.execute(updateQuery, updateParams);
      console.log("📈 Update result:", result);

      if (result.affectedRows > 0) {
        console.log(`✅ Successfully updated cycle ${currentCycleNumber}`);

        let nextCycleMessage = "";
        if (
          updatedCycleStatus === "completed" &&
          currentCycleNumber < totalCycles
        ) {
          nextCycleMessage = ` Next cycle (${
            currentCycleNumber + 1
          }) will be created on next data submission.`;
        }

        return res.status(200).json(
          successResponse(
            200,
            `Equipment movement cycle ${currentCycleNumber} updated successfully.${nextCycleMessage}`,
            {
              route_id,
              eqp_id,
              cycle: currentCycleNumber,
              status: updatedCycleStatus,
              group_no: cycleGroupNo,
              total_cycles: totalCycles,
              remaining_cycles: totalCycles - currentCycleNumber,
              existing_data_points: allExistingGPSData.length,
              new_data_points: dataObjects.length,
              total_data_points: combinedGPSData.length,
              current_data_count: newDataCount,
              can_create_next:
                updatedCycleStatus === "completed" &&
                currentCycleNumber < totalCycles,
              updated_on: inserted_on,
            },
            API_CODES.EQUIPMENT_MOVEMENT.CREATE_SUCCESS
          )
        );
      } else {
        return res
          .status(404)
          .json(
            errorResponse(
              404,
              "Equipment movement cycle not found for update",
              API_CODES.EQUIPMENT_MOVEMENT.GET_ERROR
            )
          );
      }
    }
  } catch (error) {
    console.error("❌ Main error creating equipment movement:", error);
    console.error("❌ Main error details:", {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack,
    });

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      console.log("❌ Duplicate entry error detected");
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
      console.log("❌ Foreign key constraint error detected");
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

    // Handle unknown column error
    if (error.code === "ER_BAD_FIELD_ERROR") {
      console.log("❌ Unknown column error detected");
      return res
        .status(500)
        .json(
          errorResponse(
            500,
            "Database schema error: " + error.sqlMessage,
            API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR,
            error.message
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
