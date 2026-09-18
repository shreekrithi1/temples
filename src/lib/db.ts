import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'mandir',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'mandirglobe',
});

export default pool;
