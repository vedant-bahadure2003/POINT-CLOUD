const { db } = require("../database/db");

const { uniqueIdGenerateBulk } = require("../database/uniqueHeader");

const {
  successResponse,

  errorResponse,

  API_CODES,
} = require("../utils/responseHandler");

// Create new equipment route record

const createEquipmentRoute = async (req, res) => {
  try {
    const {
      eqp_id,

      route_name,

      start_gps,

      end_gps,

      start_km,

      start_chainage,

      end_km,

      end_chainage,
    } = req.body;

    // Validate required fields

    if (!eqp_id) {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "Missing required field: eqp_id is required",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    // Validate route_name if provided

    if (route_name && typeof route_name !== "string") {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "route_name must be a valid string",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
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

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
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

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    // Validate numeric fields if provided

    if (start_km && isNaN(start_km)) {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "start_km must be a valid number",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    if (end_km && isNaN(end_km)) {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "end_km must be a valid number",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    // if (start_chainage && isNaN(start_chainage)) {

    //   return res

    //     .status(400)

    //     .json(

    //       errorResponse(

    //         400,

    //         "start_chainage must be a valid number",

    //         API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR

    //       )

    //     );

    // }

    // if (end_chainage && isNaN(end_chainage)) {

    //   return res

    //     .status(400)

    //     .json(

    //       errorResponse(

    //         400,

    //         "end_chainage must be a valid number",

    //         API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR

    //       )

    //     );

    // }

    // Generate unique route ID with ROT prefix

    const route_id = await uniqueIdGenerateBulk(
      "ROT",

      "equipment_route_lock_details_all",

      "route_id"
    );

    // Debug logging
    console.log("Input parameters:", {
      route_id,
      eqp_id,
      route_name,
      start_gps,
      end_gps,
      start_km,
      start_chainage,
      end_km,
      end_chainage,
    });

    // Sanitize parameters
    const params = [
      route_id,
      eqp_id,
      route_name || null,
      start_gps || null,
      end_gps || null,
      start_km !== undefined ? Number(start_km) : null,
      start_chainage ? JSON.stringify(start_chainage) : null,
      end_km !== undefined ? Number(end_km) : null,
      end_chainage ? JSON.stringify(end_chainage) : null,
    ];

    // Validate all parameters are present
    if (!params.every((param) => param !== undefined)) {
      throw new Error("Missing required parameters");
    }

    // Insert query - remove extra newlines
    const insertQuery = `
      INSERT INTO equipment_route_lock_details_all 
      (route_id, eqp_id, route_name, start_gps, end_gps, start_km, start_chainage, end_km, end_chainage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await db.execute(insertQuery, params);

    // Check if insertion was successful

    if (result.affectedRows > 0) {
      const responseData = {
        id: result.insertId,

        route_id,

        eqp_id,

        route_name: route_name || null,

        start_gps: start_gps || null,

        end_gps: end_gps || null,

        start_km: start_km || null,

        start_chainage: start_chainage || null,

        end_km: end_km || null,

        end_chainage: end_chainage || null,
      };

      return res

        .status(201)

        .json(
          successResponse(
            201,

            "Equipment route created successfully",

            responseData,

            API_CODES.EQUIPMENT_ROUTE.CREATE_SUCCESS
          )
        );
    } else {
      return res

        .status(500)

        .json(
          errorResponse(
            500,

            "Failed to create equipment route",

            API_CODES.EQUIPMENT_ROUTE.INTERNAL_ERROR
          )
        );
    }
  } catch (error) {
    console.error("Error creating equipment route:", error);

    // Handle duplicate entry error

    if (error.code === "ER_DUP_ENTRY") {
      return res

        .status(409)

        .json(
          errorResponse(
            409,

            "Equipment route with this ID already exists",

            API_CODES.EQUIPMENT_ROUTE.DUPLICATE_ERROR
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

            API_CODES.EQUIPMENT_ROUTE.FOREIGN_KEY_ERROR
          )
        );
    }

    return res

      .status(500)

      .json(
        errorResponse(
          500,

          "Internal server error",

          API_CODES.EQUIPMENT_ROUTE.INTERNAL_ERROR,

          error.message
        )
      );
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

    return res

      .status(200)

      .json(
        successResponse(
          200,

          "Equipment routes retrieved successfully",

          rows,

          API_CODES.EQUIPMENT_ROUTE.GET_ALL_SUCCESS,

          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment routes:", error);

    return res

      .status(500)

      .json(
        errorResponse(
          500,

          "Internal server error",

          API_CODES.EQUIPMENT_ROUTE.INTERNAL_ERROR,

          error.message
        )
      );
  }
};

// Get equipment route by route_id

const getEquipmentRouteById = async (req, res) => {
  try {
    const { route_id } = req.params;

    if (!route_id) {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "route_id parameter is required",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    const selectQuery = `

      SELECT * FROM equipment_route_lock_details_all 

      WHERE route_id = ?

    `;

    const [rows] = await db.execute(selectQuery, [route_id]);

    if (rows.length === 0) {
      return res

        .status(404)

        .json(
          errorResponse(
            404,

            "Equipment route not found",

            API_CODES.EQUIPMENT_ROUTE.GET_ERROR
          )
        );
    }

    return res

      .status(200)

      .json(
        successResponse(
          200,

          "Equipment route retrieved successfully",

          rows[0],

          API_CODES.EQUIPMENT_ROUTE.GET_SUCCESS
        )
      );
  } catch (error) {
    console.error("Error fetching equipment route by ID:", error);

    return res

      .status(500)

      .json(
        errorResponse(
          500,

          "Internal server error",

          API_CODES.EQUIPMENT_ROUTE.INTERNAL_ERROR,

          error.message
        )
      );
  }
};

// Get equipment routes by eqp_id

const getEquipmentRoutesByEquipmentId = async (req, res) => {
  try {
    const { eqp_id } = req.params;

    if (!eqp_id) {
      return res

        .status(400)

        .json(
          errorResponse(
            400,

            "eqp_id parameter is required",

            API_CODES.EQUIPMENT_ROUTE.VALIDATION_ERROR
          )
        );
    }

    const selectQuery = `

      SELECT * FROM equipment_route_lock_details_all 

      WHERE eqp_id = ?

      ORDER BY inserted_on DESC

    `;

    const [rows] = await db.execute(selectQuery, [eqp_id]);

    return res

      .status(200)

      .json(
        successResponse(
          200,

          "Equipment routes retrieved successfully",

          rows,

          API_CODES.EQUIPMENT_ROUTE.GET_SUCCESS,

          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment routes by equipment ID:", error);

    return res

      .status(500)

      .json(
        errorResponse(
          500,

          "Internal server error",

          API_CODES.EQUIPMENT_ROUTE.INTERNAL_ERROR,

          error.message
        )
      );
  }
};

module.exports = {
  createEquipmentRoute,

  getAllEquipmentRoutes,

  getEquipmentRouteById,

  getEquipmentRoutesByEquipmentId,
};
