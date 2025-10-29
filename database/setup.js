const { db } = require("./db");

// Create all required tables
const createTables = async () => {
  try {
    console.log("Setting up database tables...");

    // Create unique_header_all table
    const uniqueHeaderQuery = `
      CREATE TABLE IF NOT EXISTS unique_header_all (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        id_for VARCHAR(255) NOT NULL,
        prefix VARCHAR(10) NOT NULL,
        id_prefix VARCHAR(10) NOT NULL,
        last_id INT NOT NULL DEFAULT 0,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_table_id (table_name, id_for),
        INDEX idx_table_name (table_name),
        INDEX idx_id_for (id_for)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(uniqueHeaderQuery);
    console.log("✅ Table 'unique_header_all' ready");

    // Create road_ground_equipment_header_all table
    const equipmentHeaderQuery = `
      CREATE TABLE IF NOT EXISTS road_ground_equipment_header_all (
        id INT AUTO_INCREMENT PRIMARY KEY,
        eqp_id VARCHAR(255) NOT NULL UNIQUE,
        mobile VARCHAR(20) NOT NULL,
        eqp_type VARCHAR(255) NOT NULL,
        inserted_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_eqp_id (eqp_id),
        INDEX idx_inserted_on (inserted_on)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(equipmentHeaderQuery);
    console.log("✅ Table 'road_ground_equipment_header_all' ready");

    // Create equipment_route_lock_details_all table
    const equipmentRouteQuery = `
      CREATE TABLE IF NOT EXISTS equipment_route_lock_details_all (
        id INT AUTO_INCREMENT PRIMARY KEY,
        route_id VARCHAR(255) NOT NULL UNIQUE,
        eqp_id VARCHAR(255) NOT NULL,
        start_gps VARCHAR(255),
        end_gps VARCHAR(255),
        start_km DECIMAL(10, 3),
        start_chainage DECIMAL(10, 3),
        end_km DECIMAL(10, 3),
        end_chainage DECIMAL(10, 3),
        inserted_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_route_id (route_id),
        INDEX idx_eqp_id (eqp_id),
        INDEX idx_inserted_on (inserted_on),
        FOREIGN KEY (eqp_id) REFERENCES road_ground_equipment_header_all(eqp_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(equipmentRouteQuery);
    console.log("✅ Table 'equipment_route_lock_details_all' ready");

    // Create equipment_movement_details_all table
    const equipmentMovementQuery = `
      CREATE TABLE IF NOT EXISTS equipment_movement_details_all (
        id INT AUTO_INCREMENT PRIMARY KEY,
        route_id VARCHAR(255) NOT NULL,
        eqp_id VARCHAR(255) NOT NULL,
        cycle INT,
        current_data_col VARCHAR(50),
        current_data_count INT,
        start_gps VARCHAR(255),
        start_time DATETIME,
        end_gps VARCHAR(255),
        end_time DATETIME,
        group_no INT,
        group_inserted_on DATETIME,
        field_data1 LONGTEXT,
        field_data2 LONGTEXT,
        field_data3 LONGTEXT,
        field_data4 LONGTEXT,
        field_data5 LONGTEXT,
        field_data6 LONGTEXT,
        field_data7 LONGTEXT,
        field_data8 LONGTEXT,
        field_data9 LONGTEXT,
        field_data10 LONGTEXT,
        current_cycle_status ENUM('pending', 'live', 'completed') DEFAULT 'pending',
        inserted_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_route_id (route_id),
        INDEX idx_eqp_id (eqp_id),
        INDEX idx_cycle (cycle),
        INDEX idx_group_no (group_no),
        INDEX idx_current_cycle_status (current_cycle_status),
        INDEX idx_inserted_on (inserted_on),
        UNIQUE KEY unique_equipment_cycle (route_id, eqp_id, cycle),
        FOREIGN KEY (eqp_id) REFERENCES road_ground_equipment_header_all(eqp_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(equipmentMovementQuery);
    console.log("✅ Table 'equipment_movement_details_all' ready");

    console.log("✅ All tables set up successfully");
  } catch (error) {
    console.error("❌ Error setting up tables:", error);
    throw error;
  }
};

module.exports = {
  createTables,
};
