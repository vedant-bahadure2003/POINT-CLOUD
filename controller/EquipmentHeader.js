const { db } = require("../database/db");
const { uniqueIdGenerateBulk } = require("../database/uniqueHeader");

// Create new equipment header record
const createEquipmentHeader = async (req, res) => {
  try {
    const { mobile, roller } = req.body;

    // Validate required fields
    if (!mobile || !roller) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: mobile and roller are required",
      });
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
      INSERT INTO road_ground_equipment_header_all (eqp_id, mobile, roller, inserted_on)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      eqp_id,
      mobile,
      roller,
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
          roller,
          inserted_on,
        },
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Failed to create equipment header",
      });
    }
  } catch (error) {
    console.error("Error creating equipment header:", error);

    // Handle duplicate entry error
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Equipment with this ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all equipment headers
const getAllEquipmentHeaders = async (req, res) => {
  try {
    const selectQuery =
      "SELECT * FROM road_ground_equipment_header_all ORDER BY inserted_on DESC";
    const [rows] = await db.execute(selectQuery);

    return res.status(200).json({
      success: true,
      message: "Equipment headers retrieved successfully",
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error("Error fetching equipment headers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
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
      return res.status(404).json({
        success: false,
        message: "Equipment header not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Equipment header retrieved successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching equipment header:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createEquipmentHeader,
  getAllEquipmentHeaders,
  getEquipmentHeaderById,
};
