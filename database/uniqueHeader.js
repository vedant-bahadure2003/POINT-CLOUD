// Helper to generate unique sequential IDs for bulk and end user records, matching PHP unique_id_generate_bulk
const { db } = require("./db");

/**
 * Generate a unique sequential ID for a table and prefix, like PHP unique_id_generate_bulk
 * @param {string} id_prefix - e.g. 'BUL', 'END'
 * @param {string} table_name - e.g. 'weblink_upload_file_information_all'
 * @param {string} id_for - e.g. 'weblink_id', 'end_user_id'
 * @returns {Promise<string>} - e.g. 'BUL-00001'
 */
async function uniqueIdGenerateBulk(id_prefix, table_name, id_for) {
  // Check if an entry exists for this table and id_for
  const [rows] = await db.execute(
    "SELECT last_id FROM unique_header_all WHERE table_name = ? AND id_for = ?",
    [table_name, id_for]
  );
  let newId;
  let numericId;

  if (rows.length === 0) {
    // Not found, insert initial - store only the numeric part (1)
    numericId = 1;
    newId = `${id_prefix}-${numericId.toString().padStart(5, "0")}`;
    await db.execute(
      "INSERT INTO unique_header_all (table_name, id_for, prefix, id_prefix, last_id, created_on, modified_on) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
      [table_name, id_for, id_prefix, id_prefix, numericId]
    );
  } else {
    // Found, increment - last_id contains only the numeric part
    const lastNumericId = parseInt(rows[0].last_id, 10);
    numericId = lastNumericId + 1;
    if (numericId > 99999) throw new Error("ID limit reached");
    newId = `${id_prefix}-${numericId.toString().padStart(5, "0")}`;
    await db.execute(
      "UPDATE unique_header_all SET last_id = ?, modified_on = NOW() WHERE table_name = ? AND id_for = ?",
      [numericId, table_name, id_for]
    );
  }
  return newId;
}

module.exports = { uniqueIdGenerateBulk };
