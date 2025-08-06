async (sql = null) =>
  //TODO check for avability of sql
  async (param) => {
    const { rows } = await db.pg.query(sql, param);
    return rows;
  };
