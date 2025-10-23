// Utility functions for standardized API responses

/**
 * Generate standardized success response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {any} data - Response data
 * @param {string} apiCode - API response code
 * @param {number} count - Count of records (optional)
 */
const successResponse = (
  statusCode,
  message,
  data = null,
  apiCode = null,
  count = null
) => {
  const response = {
    status_code: statusCode,
    message: message,
    api_response_code: apiCode || `API-SUCCESS-${statusCode}`,
  };

  if (data !== null) {
    response.data = data;
  }

  if (count !== null) {
    response.count = count;
  }

  return response;
};

/**
 * Generate standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} apiCode - API response code
 * @param {any} details - Additional error details (optional)
 */
const errorResponse = (statusCode, message, apiCode = null, details = null) => {
  const response = {
    status_code: statusCode,
    message: message,
    api_response_code: apiCode || `API-ERROR-${statusCode}`,
  };

  if (details && process.env.NODE_ENV === "development") {
    response.details = details;
  }

  return response;
};

/**
 * Generate API response codes based on module and operation
 * @param {string} module - Module name (e.g., 'EQR' for Equipment Route)
 * @param {string} operation - Operation name (e.g., 'CREATE', 'GET', 'UPDATE', 'DELETE')
 * @param {number} statusCode - HTTP status code
 * @param {string} version - API version (default: 'v1.0')
 */
const generateApiCode = (module, operation, statusCode, version = "v1.0") => {
  return `${module}${operation}-${version}-${statusCode}`;
};

// Predefined API codes for different modules
const API_CODES = {
  // Equipment Route Module
  EQUIPMENT_ROUTE: {
    CREATE_SUCCESS: "EQR001-v1.0-201",
    CREATE_ERROR: "EQR002-v1.0-400",
    GET_SUCCESS: "EQR003-v1.0-200",
    GET_ERROR: "EQR004-v1.0-404",
    GET_ALL_SUCCESS: "EQR005-v1.0-200",
    VALIDATION_ERROR: "EQR006-v1.0-400",
    DUPLICATE_ERROR: "EQR007-v1.0-409",
    FOREIGN_KEY_ERROR: "EQR008-v1.0-400",
    INTERNAL_ERROR: "EQR009-v1.0-500",
  },
  // Equipment Movement Module
  EQUIPMENT_MOVEMENT: {
    CREATE_SUCCESS: "EQM001-v1.0-201",
    CREATE_ERROR: "EQM002-v1.0-400",
    GET_SUCCESS: "EQM003-v1.0-200",
    GET_ERROR: "EQM004-v1.0-404",
    GET_ALL_SUCCESS: "EQM005-v1.0-200",
    VALIDATION_ERROR: "EQM006-v1.0-400",
    DUPLICATE_ERROR: "EQM007-v1.0-409",
    FOREIGN_KEY_ERROR: "EQM008-v1.0-400",
    INTERNAL_ERROR: "EQM009-v1.0-500",
  },
  // Equipment Header Module
  EQUIPMENT_HEADER: {
    CREATE_SUCCESS: "EQH001-v1.0-201",
    CREATE_ERROR: "EQH002-v1.0-400",
    GET_SUCCESS: "EQH003-v1.0-200",
    GET_ERROR: "EQH004-v1.0-404",
    GET_ALL_SUCCESS: "EQH005-v1.0-200",
    VALIDATION_ERROR: "EQH006-v1.0-400",
    DUPLICATE_ERROR: "EQH007-v1.0-409",
    FOREIGN_KEY_ERROR: "EQH008-v1.0-400",
    INTERNAL_ERROR: "EQH009-v1.0-500",
  },
};

module.exports = {
  successResponse,
  errorResponse,
  generateApiCode,
  API_CODES,
};
