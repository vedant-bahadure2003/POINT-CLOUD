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
 * Returns object with field_data1 through field_data10 and current column info
 */
const distributeDataAcrossFields = (dataObjects = []) => {
  const fieldData = {};
  let currentActiveColumn = 1; // Store only the column number
  let totalObjectsStored = 0;

  // Initialize all 10 field_data columns
  for (let i = 1; i <= TOTAL_FIELD_COLUMNS; i++) {
    fieldData[`field_data_${i}`] = null;
  }

  if (!Array.isArray(dataObjects) || dataObjects.length === 0) {
    return {
      fieldData,
      currentActiveColumn,
      totalObjectsStored: 0,
      isCapacityExceeded: false,
    };
  }

  let currentFieldIndex = 1;
  let objectsInCurrentField = 0;
  let currentFieldArray = [];

  for (const obj of dataObjects) {
    // If current field is full, move to next field
    if (objectsInCurrentField >= MAX_OBJECTS_PER_FIELD) {
      fieldData[`field_data_${currentFieldIndex}`] =
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
    totalObjectsStored++;
  }

  // Store remaining objects in current field
  if (
    currentFieldArray.length > 0 &&
    currentFieldIndex <= TOTAL_FIELD_COLUMNS
  ) {
    fieldData[`field_data_${currentFieldIndex}`] =
      JSON.stringify(currentFieldArray);
    currentActiveColumn = currentFieldIndex; // Store only the number
  }

  const isCapacityExceeded =
    totalObjectsStored > MAX_OBJECTS_PER_FIELD * TOTAL_FIELD_COLUMNS;

  return {
    fieldData,
    currentActiveColumn,
    totalObjectsStored,
    isCapacityExceeded,
  };
};

/**
 * Auto-generate group_no based on group_name
 * Returns a unique group_no for the given group_name, route_id, and eqp_id
 */
const getOrCreateGroupNo = async (group_name, route_id, eqp_id) => {
  try {
    // First, check if this group_name already exists for this route_id and eqp_id
    const existingGroupQuery = `
      SELECT DISTINCT group_no FROM equipment_movement_details_all 
      WHERE route_id = ? AND eqp_id = ? AND group_name = ?
      LIMIT 1
    `;
    const [existingGroupRows] = await db.execute(existingGroupQuery, [
      route_id,
      eqp_id,
      group_name,
    ]);

    if (existingGroupRows.length > 0) {
      // Group name already exists, return existing group_no
      console.log(
        `📋 Found existing group_no ${existingGroupRows[0].group_no} for group_name: ${group_name}`
      );
      return existingGroupRows[0].group_no;
    }

    // Group name doesn't exist, generate new group_no
    // Get the highest group_no for this route_id and eqp_id
    const maxGroupQuery = `
      SELECT MAX(group_no) as max_group_no FROM equipment_movement_details_all 
      WHERE route_id = ? AND eqp_id = ?
    `;
    const [maxGroupRows] = await db.execute(maxGroupQuery, [route_id, eqp_id]);

    const nextGroupNo = (maxGroupRows[0].max_group_no || 0) + 1;
    console.log(
      `🆕 Generated new group_no ${nextGroupNo} for group_name: ${group_name}`
    );

    return nextGroupNo;
  } catch (error) {
    console.error("❌ Error generating group_no:", error);
    throw error;
  }
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
 * Determine cycle status based on data objects and their type field
 */
const determineCycleStatus = (dataObjects, routeStartGPS, routeEndGPS) => {
  if (!dataObjects || !Array.isArray(dataObjects) || dataObjects.length === 0) {
    return 1; // pending
  }

  let hasStartType = false;
  let hasPendingType = false;
  let hasCompletedType = false;

  // Check type values in data objects
  for (const dataPoint of dataObjects) {
    const typeValue = parseInt(dataPoint.type);

    if (typeValue === 0) {
      hasStartType = true;
    } else if (typeValue === 1) {
      hasPendingType = true;
    } else if (typeValue === 2) {
      hasCompletedType = true;
    }
  }

  // Determine cycle status based on type values
  if (hasCompletedType) {
    return 2; // completed
  } else if (hasStartType || hasPendingType) {
    return 0; // live
  } else {
    return 1; // pending
  }
};

// Create new equipment movement record
const createEquipmentMovement = async (req, res) => {
  try {
    const {
      route_id,
      eqp_id,
      cycles, // Total number of cycles (like 6)
      cycle, // Specific cycle number to create/update (optional)
      current_data_col,
      current_data_count,
      group_name,
      group_inserted_on,
      current_cycle_status, // Status from frontend (0=live, 1=pending, 2=completed)
      dataObjects, // Current GPS tracking data with current_lat, current_long, speed, time, type
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

    if (!group_name) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Missing required field: group_name is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate cycles (optional, defaults to 6)
    const totalCyclesPerGroup = cycles ? parseInt(cycles) : 6; // Default to 6 cycles per group

    if (cycles && (isNaN(cycles) || cycles <= 0)) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "cycles must be a valid positive number if provided (defaults to 6)",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate cycle if provided
    if (cycle !== undefined && cycle !== null) {
      if (isNaN(cycle) || cycle <= 0) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              "cycle must be a valid positive number",
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      // Validate cycle is within bounds
      if (cycle > totalCyclesPerGroup) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `cycle cannot be greater than total cycles (${totalCyclesPerGroup})`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }
    }

    // Validate current_cycle_status
    if (current_cycle_status === undefined || current_cycle_status === null) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Missing required field: current_cycle_status is required",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate current_cycle_status values
    const validStatuses = [0, 1, 2]; // 0=live, 1=pending, 2=completed
    if (!validStatuses.includes(parseInt(current_cycle_status))) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "current_cycle_status must be one of: 0 (live), 1 (pending), 2 (completed)",
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
            "dataObjects must be a valid array containing lat, lon, speed, time, and type",
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Validate dataObjects structure
    for (let i = 0; i < dataObjects.length; i++) {
      const dataObj = dataObjects[i];

      // Validate required fields
      if (dataObj.lat === undefined || dataObj.lat === null) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain lat`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (dataObj.lon === undefined || dataObj.lon === null) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain lon`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (dataObj.speed === undefined || dataObj.speed === null) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain speed`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (!dataObj.time) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain time`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (dataObj.type === undefined || dataObj.type === null) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}] must contain type (0=start, 1=pending, 2=completed)`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      // Validate data types
      if (isNaN(parseFloat(dataObj.lat))) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}].lat must be a valid number`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (isNaN(parseFloat(dataObj.lon))) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}].lon must be a valid number`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (isNaN(parseFloat(dataObj.speed))) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}].speed must be a valid number`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      if (isNaN(Date.parse(dataObj.time))) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}].time must be a valid date/time`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }

      // Validate type is 0, 1, or 2
      const typeValue = parseInt(dataObj.type);
      if (![0, 1, 2].includes(typeValue)) {
        return res
          .status(400)
          .json(
            errorResponse(
              400,
              `dataObjects[${i}].type must be 0 (start), 1 (pending), or 2 (completed)`,
              API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
            )
          );
      }
    }

    // Validate numeric fields if provided
    if (
      current_data_col &&
      (isNaN(current_data_col) || current_data_col < 1 || current_data_col > 10)
    ) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "current_data_col must be a valid number between 1 and 10",
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

    // Validate group_name
    if (group_name && typeof group_name !== "string") {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "group_name must be a valid string",
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

    // Auto-generate group_no based on group_name
    let group_no;
    try {
      group_no = await getOrCreateGroupNo(group_name, route_id, eqp_id);
      console.log(
        `🔢 Auto-generated group_no: ${group_no} for group_name: ${group_name}`
      );
    } catch (error) {
      console.error("❌ Error auto-generating group_no:", error);
      return res
        .status(500)
        .json(
          errorResponse(
            500,
            "Error auto-generating group number",
            API_CODES.EQUIPMENT_MOVEMENT.INTERNAL_ERROR
          )
        );
    }

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
      "data objects with lat, lon, speed, time, type"
    );
    console.log(
      `🎯 Target cycle: ${
        cycle !== undefined ? `${cycle} (specified)` : "auto-determined"
      }`
    );
    const distributionResult = distributeDataAcrossFields(dataObjects);
    const fieldDataDistribution = distributionResult.fieldData;
    const activeColumn = distributionResult.currentActiveColumn;
    const totalStored = distributionResult.totalObjectsStored;

    console.log(
      "📊 Field data distribution:",
      Object.keys(fieldDataDistribution).filter(
        (key) => fieldDataDistribution[key] !== null
      )
    );
    console.log(
      `📍 Current active column: ${activeColumn}, Total objects stored: ${totalStored}`
    );

    if (distributionResult.isCapacityExceeded) {
      console.warn(
        "⚠️ Data capacity exceeded! Some objects may not be stored."
      );
    }

    // Check for existing cycles for this equipment and route
    const existingCyclesQuery = `
      SELECT cycle, current_cycle_status, group_no FROM equipment_movement_details_all 
      WHERE route_id = ? AND eqp_id = ? 
      ORDER BY group_no DESC, cycle DESC 
      LIMIT 1
    `;
    const [existingCycles] = await db.execute(existingCyclesQuery, [
      route_id,
      eqp_id,
    ]);

    let currentCycleNumber = 1;
    let shouldCreateNewCycle = true;
    let currentGroupNumber = 1;

    // If user provided a specific cycle number, use it directly
    if (cycle !== undefined && cycle !== null) {
      const specifiedCycle = parseInt(cycle);
      console.log(`🔍 User specified cycle: ${specifiedCycle}`);

      // Determine group number - use auto-generated group_no
      currentGroupNumber = group_no;

      // Check if this cycle already exists for the given route_id, eqp_id, and group_no
      const existingCycleQuery = `
        SELECT cycle, current_cycle_status, group_no FROM equipment_movement_details_all
        WHERE route_id = ? AND eqp_id = ? AND cycle = ? AND group_no = ?
        LIMIT 1
      `;
      const [existingCycleRows] = await db.execute(existingCycleQuery, [
        route_id,
        eqp_id,
        specifiedCycle,
        currentGroupNumber,
      ]);

      if (existingCycleRows.length > 0) {
        // Cycle exists, update it
        const existingCycle = existingCycleRows[0];
        currentCycleNumber = specifiedCycle;
        shouldCreateNewCycle = false;
        console.log(
          `🔄 Updating existing cycle ${specifiedCycle} in group ${currentGroupNumber}`
        );
      } else {
        // Cycle doesn't exist, create new one
        currentCycleNumber = specifiedCycle;
        shouldCreateNewCycle = true;
        console.log(
          `🆕 Creating new cycle ${specifiedCycle} in group ${currentGroupNumber}`
        );
      }
    }
    // If user wants to work with the auto-generated group_no, validate it
    else if (group_no) {
      console.log(
        `🔍 Using auto-generated group_no: ${group_no}, validating...`
      );

      // Check if the specified group already exists and is completed
      const specifiedGroupQuery = `
        SELECT cycle, current_cycle_status FROM equipment_movement_details_all 
        WHERE route_id = ? AND eqp_id = ? AND group_no = ?
        ORDER BY cycle DESC
        LIMIT 1
      `;
      const [specifiedGroupCycles] = await db.execute(specifiedGroupQuery, [
        route_id,
        eqp_id,
        group_no,
      ]);

      if (specifiedGroupCycles.length > 0) {
        const lastCycleInGroup = specifiedGroupCycles[0];

        console.log(
          `📊 Group ${group_no} last cycle: ${lastCycleInGroup.cycle}, status: ${lastCycleInGroup.current_cycle_status}`
        );

        // If group has completed all cycles, reject the request
        if (
          lastCycleInGroup.cycle >= totalCyclesPerGroup &&
          lastCycleInGroup.current_cycle_status === 2 // completed
        ) {
          return res
            .status(400)
            .json(
              errorResponse(
                400,
                `Group ${group_no} has already completed all ${totalCyclesPerGroup} cycles.`,
                API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
              )
            );
        }

        // If group exists but not completed, continue with that group
        currentGroupNumber = group_no;
        if (lastCycleInGroup.current_cycle_status === 2) {
          // completed
          currentCycleNumber = lastCycleInGroup.cycle + 1;
          shouldCreateNewCycle = true;
        } else {
          currentCycleNumber = lastCycleInGroup.cycle;
          shouldCreateNewCycle = false;
        }

        console.log(
          `✅ Using auto-generated group ${group_no}, cycle ${currentCycleNumber}, shouldCreate: ${shouldCreateNewCycle}`
        );
      } else {
        // New group specified, start with cycle 1
        currentGroupNumber = group_no;
        currentCycleNumber = 1;
        shouldCreateNewCycle = true;
        console.log(`🆕 Creating new group ${group_no} starting with cycle 1`);
      }
    } else if (existingCycles.length > 0) {
      // Auto-determine group logic (existing behavior)
      const lastCycle = existingCycles[0];
      currentCycleNumber = lastCycle.cycle;
      currentGroupNumber = lastCycle.group_no;

      console.log(
        `📋 Found existing cycle ${currentCycleNumber} in group ${currentGroupNumber} with status: ${lastCycle.current_cycle_status}`
      );

      // If last cycle is completed, determine next action
      if (lastCycle.current_cycle_status === 2) {
        // completed

        // If we've completed all cycles in current group, start new group
        if (currentCycleNumber >= totalCyclesPerGroup) {
          currentGroupNumber += 1;
          currentCycleNumber = 1;
          shouldCreateNewCycle = true;
          console.log(
            `🎉 All ${totalCyclesPerGroup} cycles completed in group ${
              currentGroupNumber - 1
            }. Starting new group ${currentGroupNumber} with cycle 1`
          );
        } else {
          // Move to next cycle in same group
          currentCycleNumber += 1;
          shouldCreateNewCycle = true;
          console.log(
            `✅ Last cycle completed, creating cycle ${currentCycleNumber} in group ${currentGroupNumber}`
          );
        }
      } else {
        // Update existing cycle with new GPS data
        shouldCreateNewCycle = false;
        console.log(
          `🔄 Updating existing cycle ${currentCycleNumber} in group ${currentGroupNumber} with new GPS data`
        );
      }
    } else {
      console.log(
        "🆕 No existing cycles found, creating first cycle in first group"
      );
    }

    // Validate cycle number within group bounds (only if cycle wasn't explicitly specified)
    if (
      currentCycleNumber > totalCyclesPerGroup &&
      shouldCreateNewCycle &&
      cycle === undefined
    ) {
      // This should not happen with the new logic, but keeping as safety check
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            `Invalid cycle number ${currentCycleNumber}. Maximum cycles per group is ${totalCyclesPerGroup}.`,
            API_CODES.EQUIPMENT_MOVEMENT.VALIDATION_ERROR
          )
        );
    }

    // Use the current_cycle_status provided from frontend
    console.log(
      `📍 Cycle ${currentCycleNumber} in group ${currentGroupNumber} status from frontend:`,
      current_cycle_status
    );
    console.log(`🎯 Route start GPS:`, routeData.start_gps);
    console.log(`🏁 Route end GPS:`, routeData.end_gps);
    console.log(
      `📊 Data objects type summary:`,
      dataObjects.map((obj) => `type: ${obj.type}`)
    );

    // Calculate group number for this cycle (use determined group number or provided one)
    const cycleGroupNo = currentGroupNumber;

    if (shouldCreateNewCycle) {
      // Create new cycle
      console.log(
        `🆕 Creating new cycle ${currentCycleNumber} in group ${cycleGroupNo}`
      );

      const insertQuery = `
        INSERT INTO equipment_movement_details_all 
        (route_id, eqp_id, cycle, current_data_col, current_data_count, start_gps, start_time, end_gps, end_time, group_no, group_name, group_inserted_on, field_data_1, field_data_2, field_data_3, field_data_4, field_data_5, field_data_6, field_data_7, field_data_8, field_data_9, field_data_10, current_cycle_status, inserted_on)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const groupInsertedOn = group_inserted_on
        ? new Date(group_inserted_on)
        : inserted_on;

      // Set start_time to current time when cycle starts
      const cycleStartTime = inserted_on;

      // Set end_time only if cycle is completed
      const cycleEndTime = current_cycle_status === 2 ? inserted_on : null; // 2 = completed

      console.log(
        `⏰ Cycle timing - Start: ${cycleStartTime}, End: ${
          cycleEndTime || "Not completed yet"
        }`
      );

      const insertParams = [
        route_id,
        eqp_id,
        currentCycleNumber,
        activeColumn, // Use the active column from distribution result
        totalStored, // Use total stored count instead of dataObjects.length
        routeData.start_gps || null,
        cycleStartTime, // Always set start_time when creating new cycle
        routeData.end_gps || null,
        cycleEndTime, // Set end_time only if cycle is completed
        cycleGroupNo,
        group_name || null,
        groupInsertedOn,
        fieldDataDistribution.field_data_1 || null,
        fieldDataDistribution.field_data_2 || null,
        fieldDataDistribution.field_data_3 || null,
        fieldDataDistribution.field_data_4 || null,
        fieldDataDistribution.field_data_5 || null,
        fieldDataDistribution.field_data_6 || null,
        fieldDataDistribution.field_data_7 || null,
        fieldDataDistribution.field_data_8 || null,
        fieldDataDistribution.field_data_9 || null,
        fieldDataDistribution.field_data_10 || null,
        parseInt(current_cycle_status),
        inserted_on,
      ];

      console.log(
        `📊 Creating cycle ${currentCycleNumber} with status: ${current_cycle_status}`
      );
      console.log("📋 Insert parameters:", {
        route_id,
        eqp_id,
        cycle: currentCycleNumber,
        current_data_col: activeColumn,
        current_data_count: totalStored,
        start_gps: routeData.start_gps,
        start_time: cycleStartTime,
        end_gps: routeData.end_gps,
        end_time: cycleEndTime,
        group_no: cycleGroupNo,
        status: current_cycle_status,
        field_data_1_length: fieldDataDistribution.field_data_1
          ? fieldDataDistribution.field_data_1.length
          : 0,
      });

      const [result] = await db.execute(insertQuery, insertParams);
      console.log("📈 Insert result:", result);

      if (result.affectedRows > 0) {
        console.log(
          `✅ Successfully created cycle ${currentCycleNumber} with ID: ${result.insertId}`
        );

        let nextCycleMessage = "";
        if (
          current_cycle_status === 2 && // completed
          currentCycleNumber < totalCyclesPerGroup
        ) {
          nextCycleMessage = ` Next cycle (${
            currentCycleNumber + 1
          }) will be created on next data submission.`;
        } else if (
          current_cycle_status === 2 && // completed
          currentCycleNumber >= totalCyclesPerGroup
        ) {
          nextCycleMessage = ` Group ${cycleGroupNo} completed! Next data submission will start group ${
            cycleGroupNo + 1
          } with cycle 1.`;
        }

        return res.status(201).json(
          successResponse(
            201,
            `Equipment movement cycle ${currentCycleNumber} in group ${cycleGroupNo} created successfully.${nextCycleMessage}`,
            {
              id: result.insertId,
              route_id,
              eqp_id,
              cycle: currentCycleNumber,
              status: current_cycle_status,
              group_no: cycleGroupNo,
              total_cycles: totalCyclesPerGroup,
              // remaining_cycles_in_group:
              //   totalCyclesPerGroup - currentCycleNumber,
              data_objects_saved: dataObjects.length,
              current_data_count: totalStored,
              current_data_col: activeColumn,
              can_create_next_cycle:
                current_cycle_status === 2 && // completed
                currentCycleNumber < totalCyclesPerGroup,
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
        SELECT field_data_1, field_data_2, field_data_3, field_data_4, field_data_5, 
               field_data_6, field_data_7, field_data_8, field_data_9, field_data_10,
               current_data_count, start_time, end_time, group_no
        FROM equipment_movement_details_all 
        WHERE route_id = ? AND eqp_id = ? AND cycle = ? AND group_no = ?
      `;

      const [existingDataRows] = await db.execute(getExistingDataQuery, [
        route_id,
        eqp_id,
        currentCycleNumber,
        currentGroupNumber,
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
        const fieldKey = `field_data_${i}`;
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

      console.log(`📦 Found ${allExistingGPSData.length} existing data points`);
      console.log(`➕ Adding ${dataObjects.length} new data points`); // Combine existing data with new data
      const combinedGPSData = [...allExistingGPSData, ...dataObjects];
      console.log(`📊 Total data points: ${combinedGPSData.length}`);

      // Redistribute combined data across field_data columns
      const combinedDistributionResult =
        distributeDataAcrossFields(combinedGPSData);
      const combinedFieldDataDistribution =
        combinedDistributionResult.fieldData;
      const combinedActiveColumn =
        combinedDistributionResult.currentActiveColumn;
      const combinedTotalStored = combinedDistributionResult.totalObjectsStored;

      console.log(
        `📍 Combined active column: ${combinedActiveColumn}, Total stored: ${combinedTotalStored}`
      );

      if (combinedDistributionResult.isCapacityExceeded) {
        console.warn(
          "⚠️ Combined data capacity exceeded! Some objects may not be stored."
        );
      }

      // Use the current_cycle_status provided from frontend
      console.log(`📍 Using status from frontend: ${current_cycle_status}`);

      // Get existing start_time to preserve it
      const existingStartTime = existingDataRows[0].start_time || inserted_on;

      // Set end_time only if cycle is being completed
      const cycleEndTime =
        current_cycle_status === 2 // completed
          ? inserted_on
          : existingDataRows[0].end_time;

      console.log(
        `⏰ Cycle timing - Start: ${existingStartTime} (preserved), End: ${
          cycleEndTime || "Not completed yet"
        }`
      );

      const updateQuery = `
        UPDATE equipment_movement_details_all 
        SET current_data_col = ?, current_data_count = ?, start_time = ?, end_time = ?, 
            field_data_1 = ?, field_data_2 = ?, field_data_3 = ?, field_data_4 = ?, field_data_5 = ?, 
            field_data_6 = ?, field_data_7 = ?, field_data_8 = ?, field_data_9 = ?, field_data_10 = ?, 
            current_cycle_status = ?, group_name = ?, inserted_on = ?
        WHERE route_id = ? AND eqp_id = ? AND cycle = ? AND group_no = ?
      `;

      const updateParams = [
        combinedActiveColumn, // Use combined active column
        combinedTotalStored, // Use combined total stored count
        existingStartTime, // Preserve existing start_time
        cycleEndTime, // Set end_time only when completed
        combinedFieldDataDistribution.field_data_1 || null,
        combinedFieldDataDistribution.field_data_2 || null,
        combinedFieldDataDistribution.field_data_3 || null,
        combinedFieldDataDistribution.field_data_4 || null,
        combinedFieldDataDistribution.field_data_5 || null,
        combinedFieldDataDistribution.field_data_6 || null,
        combinedFieldDataDistribution.field_data_7 || null,
        combinedFieldDataDistribution.field_data_8 || null,
        combinedFieldDataDistribution.field_data_9 || null,
        combinedFieldDataDistribution.field_data_10 || null,
        parseInt(current_cycle_status),
        group_name || null,
        inserted_on,
        route_id,
        eqp_id,
        currentCycleNumber,
        currentGroupNumber,
      ];

      console.log(
        `📊 Updating cycle ${currentCycleNumber} with status: ${current_cycle_status}`
      );
      console.log("📋 Update parameters:", {
        route_id,
        eqp_id,
        cycle: currentCycleNumber,
        current_data_col: combinedActiveColumn,
        current_data_count: combinedTotalStored,
        existing_data_points: allExistingGPSData.length,
        new_data_points: dataObjects.length,
        total_data_points: combinedGPSData.length,
        start_time: existingStartTime,
        end_time: cycleEndTime,
        status: current_cycle_status,
        field_data_1_length: combinedFieldDataDistribution.field_data_1
          ? combinedFieldDataDistribution.field_data_1.length
          : 0,
      });
      const [result] = await db.execute(updateQuery, updateParams);
      console.log("📈 Update result:", result);

      if (result.affectedRows > 0) {
        console.log(`✅ Successfully updated cycle ${currentCycleNumber}`);

        let nextCycleMessage = "";
        if (
          current_cycle_status === 2 && // completed
          currentCycleNumber < totalCyclesPerGroup
        ) {
          nextCycleMessage = ` Next cycle (${
            currentCycleNumber + 1
          }) will be created on next data submission.`;
        } else if (
          current_cycle_status === 2 && // completed
          currentCycleNumber >= totalCyclesPerGroup
        ) {
          nextCycleMessage = ` Group ${cycleGroupNo} completed! Next data submission will start group ${
            cycleGroupNo + 1
          } with cycle 1.`;
        }

        return res.status(200).json(
          successResponse(
            200,
            `Equipment movement cycle ${currentCycleNumber} in group ${cycleGroupNo} updated successfully.${nextCycleMessage}`,
            {
              route_id,
              eqp_id,
              cycle: currentCycleNumber,
              status: current_cycle_status,
              group_no: cycleGroupNo,
              total_cycles: totalCyclesPerGroup,
              // remaining_cycles_in_group:
              //   totalCyclesPerGroup - currentCycleNumber,
              existing_data_points: allExistingGPSData.length,
              new_data_points: dataObjects.length,
              total_data_points: combinedGPSData.length,
              current_data_count: combinedTotalStored,
              current_data_col: combinedActiveColumn,
              can_create_next_cycle:
                current_cycle_status === 2 && // completed
                currentCycleNumber < totalCyclesPerGroup,
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
