async (id) => {
  try {
    const query = 'DELETE FROM new_posts WHERE id = $1';
    await db.pg.query(query, [id]);
    return 'The post has been deleted';
  } catch (error) {
    throw new Error(error);
  }
};
