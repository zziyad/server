async () => {
  // console.info('Connect to PG');
  const database = new db.pg.Pool(config.database);
  const {
    rows: [{ now }],
  } = await database.query('SELECT now()');
  console.log(`Connected to pg at ${new Date(now).toLocaleTimeString()}`);
};
