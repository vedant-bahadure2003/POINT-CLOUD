require("dotenv").config();
const express = require("express");
const { connectDB, initialize } = require("./database/db");

const app = express();
const backend = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (if needed)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

backend.get("/", (req, res) => {
  res.send("backend api is running under /backend!");
});

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Point Cloud Backend API",
    status: "Server is running successfully",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "point_cloud_backend",
  });
});

// API Routes
app.use("/api/equipment-headers", require("./routes/equipmentHeader"));
app.use("/api/equipment-routes", require("./routes/equipmentRoute"));
app.use("/api/equipment-movements", require("./routes/equipmentMovement"));

// Additional routes
app.use("/backend", backend);
app.use("/", backend);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connection
    await connectDB();
    await initialize();

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Point Cloud Backend Server is running on port ${PORT}`);
      console.log(`📍 Server URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
