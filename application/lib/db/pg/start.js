async () => {
  if (!npm.pg) {
    console.system('Postgres driver is not installed, skip db');
    return;
  }

  try {
    const { Pool } = npm.pg;
    const pool = new Pool({ ...config.database });
    const result = await pool.query('SELECT now() AS now');
    db.pg = pool;
    db.client = pool;
    console.system(`Connected to pg at ${result.rows[0].now}`);
  } catch (error) {
    console.error('Postgres unavailable, continuing without db:', error.message);
  }
};
