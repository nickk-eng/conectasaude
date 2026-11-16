const { Pool } = require('pg');

const banco = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = banco;
