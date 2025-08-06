async () => {
  const { Pool } = npm.pg;
  // const { loadModel } = metarhia.metaschema;
  // const schemaPath = '/../NodeJS-Application/schemas';

  // const types = {
  //   string: { metadata: { pg: 'varchar' } },
  //   number: { metadata: { pg: 'integer' } },
  //   boolean: { metadata: { pg: 'boolean' } },
  //   datetime: { js: 'string', metadata: { pg: 'timestamp with time zone' } },
  //   text: { js: 'string', metadata: { pg: 'text' } },
  //   json: { js: 'schema', metadata: { pg: 'jsonb' } },
  // };

  // const model = await loadModel(
  //   node.process.cwd() + schemaPath,
  //   types,
  // );

  const { Database, Query } = metarhia.metasql;

  const options = { ...config.database };
  const pool = new Pool(options);
  db.client = await pool.connect();
  db.query = Query;
  db.pg = new Database(options);
  const {
    rows: [{ now }],
  } = await this.db.pg.query('SELECT now()');
  console.system(`Connected to pg at ${new Date(now).toLocaleTimeString()}`);
};
