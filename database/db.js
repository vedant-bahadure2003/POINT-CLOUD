const mysql = require("mysql2");

// Validate required environment variables
console.log("Database configuration:", {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || "default",
  ssl: process.env.DB_SSL_ENABLED === "true" ? "enabled" : "disabled",
  password: process.env.DB_PASSWORD ? "[HIDDEN]" : "NOT SET",
});
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
}

const fs = require("fs");

// Create database connection pool using environment variables
const poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Add port if specified in environment
if (process.env.DB_PORT) {
  poolConfig.port = parseInt(process.env.DB_PORT);
}

// Add SSL configuration if enabled in environment
if (process.env.DB_SSL_ENABLED === "true") {
  poolConfig.ssl = {
    ca: fs.readFileSync(process.env.DB_SSL_CA_PATH || "./certs/ca.pem"),
  };
}

const pool = mysql.createPool(poolConfig);

const db = pool.promise();

const connectDB = async () => {
  try {
    // Test the connection
    const connection = await db.getConnection();
    console.log("MySQL Database connected successfully");
    connection.release();
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err;
  }
};

const initialize = async () => {
  try {
    console.log("Initializing application...");

    // Setup all database tables
    const { createTables } = require("./setup");
    await createTables();

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Error during initialization:", error);
    throw error;
  }
};
module.exports = {
  connectDB,
  initialize,
  db,
};
