const path = require('path');

// Persisted at OUTPUT_PATH on Render (set OUTPUT_PATH=/data/output alongside DB_PATH=/data/pacq_deals.db).
// Falls back to the project-root output/ directory for local dev.
const OUTPUT_ROOT = process.env.OUTPUT_PATH || path.join(__dirname, '..', 'output');

module.exports = { OUTPUT_ROOT };
