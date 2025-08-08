async (table, id, entity = 'ENTITY') => {
  const Entity = class {};
  const desc = { value: entity };
  Object.defineProperty(Entity, 'name', desc);
  return async (data) => {
    const rows = await db.pg.insert(table, data);
    return Object.assign(new Entity(), rows[0]);
  };
};
