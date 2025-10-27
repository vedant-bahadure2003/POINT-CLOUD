// Debug script to test database connectivity and table structure
require("dotenv").config(); // Load environment variables
const { db } = require("./database/db");

const debugDatabase = async () => {
  try {
    console.log("🔍 Starting database debug...");

    // Test 1: Check database connection
    console.log("\n1️⃣ Testing database connection...");
    const [connectionTest] = await db.execute("SELECT 1 as test");
    console.log("✅ Database connection successful:", connectionTest);

    // Test 2: Check if equipment_movement_details_all table exists
    console.log(
      "\n2️⃣ Checking if equipment_movement_details_all table exists..."
    );
    const [tableExists] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'equipment_movement_details_all'
    `);
    console.log("📊 Table exists:", tableExists[0].count > 0);

    if (tableExists[0].count > 0) {
      // Test 3: Check table structure
      console.log("\n3️⃣ Checking table structure...");
      const [columns] = await db.execute(`
        DESCRIBE equipment_movement_details_all
      `);
      console.log(
        "📋 Table columns:",
        columns.map((col) => `${col.Field} (${col.Type})`)
      );

      // Test 4: Check if status column exists
      const hasStatusColumn = columns.find((col) => col.Field === "status");
      console.log("🏷️ Status column exists:", !!hasStatusColumn);

      if (!hasStatusColumn) {
        console.log("⚠️ Adding status column...");
        await db.execute(`
          ALTER TABLE equipment_movement_details_all 
          ADD COLUMN status ENUM('pending', 'live', 'completed') DEFAULT 'pending'
        `);
        console.log("✅ Status column added successfully");
      }
    } else {
      console.log("❌ Table does not exist. Creating tables...");
      const { createTables } = require("./database/setup");
      await createTables();
      console.log("✅ Tables created successfully");
    }

    // Test 5: Check prerequisite tables
    console.log("\n4️⃣ Checking prerequisite tables...");

    // Check equipment header table
    const [equipmentCount] = await db.execute(`
      SELECT COUNT(*) as count FROM road_ground_equipment_header_all
    `);
    console.log("👷 Equipment records:", equipmentCount[0].count);

    if (equipmentCount[0].count > 0) {
      const [sampleEquipment] = await db.execute(`
        SELECT eqp_id FROM road_ground_equipment_header_all LIMIT 1
      `);
      console.log("📝 Sample equipment ID:", sampleEquipment[0]?.eqp_id);
    }

    // Check route table
    const [routeCount] = await db.execute(`
      SELECT COUNT(*) as count FROM equipment_route_lock_details_all
    `);
    console.log("🛣️ Route records:", routeCount[0].count);

    if (routeCount[0].count > 0) {
      const [sampleRoute] = await db.execute(`
        SELECT route_id, start_gps, end_gps FROM equipment_route_lock_details_all LIMIT 1
      `);
      console.log("📍 Sample route:", {
        route_id: sampleRoute[0]?.route_id,
        start_gps: sampleRoute[0]?.start_gps,
        end_gps: sampleRoute[0]?.end_gps,
      });
    }

    // Test 6: Try a simple insert
    console.log("\n5️⃣ Testing simple insert...");
    if (equipmentCount[0].count > 0 && routeCount[0].count > 0) {
      const [equipment] = await db.execute(
        `SELECT eqp_id FROM road_ground_equipment_header_all LIMIT 1`
      );
      const [route] = await db.execute(
        `SELECT route_id FROM equipment_route_lock_details_all LIMIT 1`
      );

      const testData = {
        route_id: route[0].route_id,
        eqp_id: equipment[0].eqp_id,
        cycle: 999, // Test cycle number
        status: "pending",
        inserted_on: new Date(),
      };

      try {
        const [insertResult] = await db.execute(
          `
          INSERT INTO equipment_movement_details_all 
          (route_id, eqp_id, cycle, status, inserted_on)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            testData.route_id,
            testData.eqp_id,
            testData.cycle,
            testData.status,
            testData.inserted_on,
          ]
        );

        console.log(
          "✅ Test insert successful. Insert ID:",
          insertResult.insertId
        );

        // Clean up test data
        await db.execute(
          `DELETE FROM equipment_movement_details_all WHERE cycle = 999`
        );
        console.log("🧹 Test data cleaned up");
      } catch (insertError) {
        console.log("❌ Test insert failed:", insertError.message);
        console.log("🔍 Error details:", {
          code: insertError.code,
          errno: insertError.errno,
          sqlState: insertError.sqlState,
          sqlMessage: insertError.sqlMessage,
        });
      }
    } else {
      console.log("⚠️ Cannot test insert - missing prerequisite data");
      console.log("💡 You need to create equipment and route records first");
    }

    console.log("\n🎉 Database debug completed!");
  } catch (error) {
    console.error("❌ Debug failed:", error);
    console.error("🔍 Error details:", {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
    });
  } finally {
    process.exit(0);
  }
};

debugDatabase();
