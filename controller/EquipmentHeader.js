const { db } = require("../database/db");
const { uniqueIdGenerateBulk } = require("../database/uniqueHeader");
const {
  successResponse,
  errorResponse,
  API_CODES,
} = require("../utils/responseHandler");

// Create new equipment header record
const createEquipmentHeader = async (req, res) => {
  try {
    const { mobile, eq_type } = req.body;

    // Validate required fields
    if (!mobile || !eq_type) {
      return res
        .status(400)
        .json(
          errorResponse(
            400,
            "Missing required fields: mobile and eq_type are required",
            API_CODES.EQUIPMENT_HEADER.VALIDATION_ERROR
          )
        );
    }

    // Generate unique equipment ID with EQP prefix
    const eqp_id = await uniqueIdGenerateBulk(
      "EQP",
      "road_ground_equipment_header_all",
      "eqp_id"
    );

    // Current timestamp for inserted_on
    const inserted_on = new Date();

    // Insert query
    const insertQuery = `
      INSERT INTO road_ground_equipment_header_all (eqp_id, mobile, eq_type, inserted_on)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      eqp_id,
      mobile,
      eq_type,
      inserted_on,
    ]);

    // Check if insertion was successful
    if (result.affectedRows > 0) {
      return res.status(201).json({
        success: true,
        message: "Equipment header created successfully",
        data: {
          id: result.insertId,
          eqp_id,
          mobile,
          eq_type,
          inserted_on,
        },
      });
    } else {
      return res
        .status(500)
        .json(
          errorResponse(
            500,
            "Failed to create equipment header",
            API_CODES.EQUIPMENT_HEADER.INTERNAL_ERROR
          )
        );
    }
  } catch (error) {
    console.error("Error creating equipment header:", error);

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json(
          errorResponse(
            409,
            "Equipment with this ID already exists",
            API_CODES.EQUIPMENT_HEADER.INTERNAL_ERROR
          )
        );
    }

    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_HEADER.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

// Get all equipment headers
const getAllEquipmentHeaders = async (req, res) => {
  try {
    const selectQuery =
      "SELECT * FROM road_ground_equipment_header_all ORDER BY inserted_on DESC";
    const [rows] = await db.execute(selectQuery);

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment headers retrieved successfully",
          rows,
          API_CODES.EQUIPMENT_HEADER.GET_SUCCESS,
          rows.length
        )
      );
  } catch (error) {
    console.error("Error fetching equipment headers:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_HEADER.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

// Get equipment header by ID
const getEquipmentHeaderById = async (req, res) => {
  try {
    const { id } = req.params;

    const selectQuery =
      "SELECT * FROM road_ground_equipment_header_all WHERE eqp_id = ?";
    const [rows] = await db.execute(selectQuery, [id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json(
          errorResponse(
            404,
            "Equipment header not found",
            API_CODES.EQUIPMENT_HEADER.GET_ERROR
          )
        );
    }

    return res
      .status(200)
      .json(
        successResponse(
          200,
          "Equipment header retrieved successfully",
          rows[0],
          API_CODES.EQUIPMENT_HEADER.GET_SUCCESS
        )
      );
  } catch (error) {
    console.error("Error fetching equipment header:", error);
    return res
      .status(500)
      .json(
        errorResponse(
          500,
          "Internal server error",
          API_CODES.EQUIPMENT_HEADER.INTERNAL_ERROR,
          error.message
        )
      );
  }
};

module.exports = {
  createEquipmentHeader,
  getAllEquipmentHeaders,
  getEquipmentHeaderById,
};
